-- «Легенда сезона» and «Дуэлянт» read the week's places from their own table
-- (02.11). They used to look for the «1 место» / «2 место» / «3 место»
-- medals in user_awards, but since user_awards_once a repeat place is not
-- recorded (each medal once): Mimikron was 1st in Moscow seven weeks running
-- (14.09–26.10) and has only two «1 место» rows, so the legend never came;
-- a duelist who took a sector from a repeat top-3 player got nothing either.
-- Places now go to weekly_places every Sunday whatever the medal rule says;
-- coins for a repeat place stay unpaid, as decided.

-- 1. The week's top 3 of every city.
create table public.weekly_places (
  city_prefix text not null,
  week_key text not null,          -- the week's Monday, YYYY-MM-DD in city time (= weekly_rank period_key)
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  primary key (city_prefix, week_key, user_id)
);
alter table public.weekly_places enable row level security;
-- Only the award functions (SECURITY DEFINER) read and write it; no policies.
revoke all on public.weekly_places from anon, authenticated;
grant all on public.weekly_places to service_role;

-- 2. Past weeks from the «итоги недели» notifications: every player got one
-- with their place and the week. They carry no city, but each city's
-- Sunday run has its own minute: B 20:05, T 20:06, M 21:05, P 21:06, S 21:07 UTC.
insert into public.weekly_places (city_prefix, week_key, user_id, rank)
select x.prefix, x.week_key, x.user_id, x.rank
from (
  select case to_char(n.created_at at time zone 'UTC', 'HH24:MI')
           when '20:05' then 'B' when '20:06' then 'T' when '21:05' then 'M' when '21:06' then 'P' when '21:07' then 'S'
         end as prefix,
         n.payload->>'period_key' as week_key, n.user_id, (n.payload->>'rank')::int as rank
  from public.notifications n
  where n.kind = 'weekly_result' and (n.payload->>'rank')::int <= 3
) x
where x.prefix is not null and x.week_key is not null
on conflict do nothing;

-- 3. Sunday's weekly ranks write the places too, before the medal.
do $$
declare
  v_old text := E'  loop\n    insert into public.user_awards';
  v_new text := E'  loop\n'
    || E'    -- The place itself, kept whatever user_awards_once does with the medal.\n'
    || E'    insert into public.weekly_places (city_prefix, week_key, user_id, rank)\n'
    || E'    values (p_city_prefix, to_char(v_local, ''YYYY-MM-DD''), r.uid, r.rnk)\n'
    || E'    on conflict do nothing;\n'
    || E'    insert into public.user_awards';
  v_def text := pg_get_functiondef('public.grant_weekly_rank_awards(text, text)'::regprocedure);
begin
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'grant_weekly_rank_awards: expected the award loop once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- 4. The legend: 1st place this week and the three weeks before, in this city.
create or replace function public.grant_season_legend_awards(p_city_prefix text, p_timezone text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_week_start timestamptz;
  v_this_week_key text;
  r record;
  v_streak_ok boolean;
  i int;
begin
  v_week_start := (date_trunc('week', now() at time zone p_timezone) at time zone p_timezone) - interval '7 days';
  v_this_week_key := to_char(v_week_start at time zone p_timezone, 'YYYY-MM-DD');

  for r in
    select wp.user_id as uid
    from public.weekly_places wp
    where wp.city_prefix = p_city_prefix and wp.week_key = v_this_week_key and wp.rank = 1
  loop
    v_streak_ok := true;
    for i in 1..3 loop
      if not exists (
        select 1 from public.weekly_places
        where city_prefix = p_city_prefix and user_id = r.uid and rank = 1
          and week_key = to_char((v_week_start - (i * interval '7 days')) at time zone p_timezone, 'YYYY-MM-DD')
      ) then
        v_streak_ok := false;
        exit;
      end if;
    end loop;

    if v_streak_ok then
      insert into public.user_awards (user_id, kind, title, subtitle, description, period_key)
      values (
        r.uid, 'season_legend', 'Легенда сезона', '4 недели подряд',
        'Ты был первым в рейтинге недели четыре недели подряд — редкая серия.',
        'legend:' || p_city_prefix || ':' || v_this_week_key
      )
      on conflict (user_id, kind, period_key) where period_key is not null do nothing;
    end if;
  end loop;
end;
$function$;

-- 5. The duelist: a sector taken from last week's top 3 of this city.
create or replace function public.grant_duelist_awards(p_city_prefix text, p_timezone text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_prev_week_key text;
  r record;
begin
  v_week_start := (date_trunc('week', now() at time zone p_timezone) at time zone p_timezone) - interval '7 days';
  v_week_end := v_week_start + interval '7 days';
  v_prev_week_key := to_char((v_week_start - interval '7 days') at time zone p_timezone, 'YYYY-MM-DD');

  for r in
    select al.id as event_id, al.user_id as uid, al.territory_id, al.previous_owner_id, p.display_name as victim_name
    from public.activity_log al
    join public.weekly_places wp
      on wp.user_id = al.previous_owner_id and wp.city_prefix = p_city_prefix
      and wp.week_key = v_prev_week_key and wp.rank <= 3
    join public.profiles p on p.id = al.previous_owner_id
    where al.kind = 'claim'
      and al.created_at >= v_week_start and al.created_at < v_week_end
      and al.territory_id like p_city_prefix || '%'
      and al.previous_owner_id is not null
  loop
    insert into public.user_awards (user_id, kind, title, subtitle, description, period_key)
    values (
      r.uid, 'duelist', 'Дуэлянт',
      'Победа над ' || r.victim_name,
      'Забрал сектор ' || r.territory_id || ' у ' || r.victim_name || ', топ-3 прошлой недели.',
      'duel:' || r.event_id
    )
    on conflict (user_id, kind, period_key) where period_key is not null do nothing;
  end loop;
end;
$function$;

-- 6. The legends that should have come: the first week that closed four 1st
-- places in a row, per player and city. The medal's trigger pays its coins
-- and sends «award_granted», as on a Sunday.
insert into public.user_awards (user_id, kind, title, subtitle, description, period_key)
select distinct on (w.user_id) w.user_id, 'season_legend', 'Легенда сезона', '4 недели подряд',
  'Ты был первым в рейтинге недели четыре недели подряд — редкая серия.',
  'legend:' || w.city_prefix || ':' || w.week_key
from public.weekly_places w
where w.rank = 1
  and (select count(*) from public.weekly_places w2
       where w2.city_prefix = w.city_prefix and w2.user_id = w.user_id and w2.rank = 1
         and w2.week_key in (to_char(w.week_key::date - 7, 'YYYY-MM-DD'), to_char(w.week_key::date - 14, 'YYYY-MM-DD'), to_char(w.week_key::date - 21, 'YYYY-MM-DD'))) = 3
order by w.user_id, w.week_key
on conflict (user_id, kind, period_key) where period_key is not null do nothing;

-- 7. The duelists that should have come (owner's go-ahead 02.11): for every
-- finished week, a capture of a sector from a player in the previous week's
-- top 3 of that city, by someone who has no «Дуэлянт» yet — the first such
-- capture each. Coins and «award_granted» come from the medal's trigger.
insert into public.user_awards (user_id, kind, title, subtitle, description, period_key)
select distinct on (al.user_id) al.user_id, 'duelist', 'Дуэлянт',
  'Победа над ' || v.display_name,
  'Забрал сектор ' || al.territory_id || ' у ' || v.display_name || ', топ-3 прошлой недели.',
  'duel:' || al.id
from public.activity_log al
cross join lateral (
  select c.city, public._city_tz(c.city) as tz
  from unnest(array['batumi','moscow','spb','sochi','tbilisi']) c(city)
  where public._city_prefix(c.city) = left(al.territory_id, 1)
) city
join public.weekly_places wp
  on wp.user_id = al.previous_owner_id and wp.city_prefix = left(al.territory_id, 1) and wp.rank <= 3
  and wp.week_key = to_char(date_trunc('week', al.created_at at time zone city.tz) - interval '7 days', 'YYYY-MM-DD')
join public.profiles v on v.id = al.previous_owner_id
where al.kind = 'claim'
  and al.previous_owner_id is not null
  and al.created_at < public._city_week_start(city.city)
  and not exists (select 1 from public.user_awards ua where ua.user_id = al.user_id and ua.kind = 'duelist')
order by al.user_id, al.created_at
on conflict (user_id, kind, period_key) where period_key is not null do nothing;
