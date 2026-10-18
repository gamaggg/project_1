-- Clan war by sign-up (from the week starting Monday 19.10.2026).
--
-- Before: every clan of a city raced automatically, every member's metres counted.
-- Now: the leader or a co-leader opens the war for the week («Участвовать в битве
-- кланов»), picks the roster (3 players up to the whole clan) and confirms. From that
-- moment only the roster's metres count, the finish is 200 m × roster size, only the
-- roster gets the race rewards. A clan that did not open the war does not race that
-- week. The roster is locked once the war is started; it can be started any time
-- until the week ends (Sunday 24:00 city time). The weekly chest is unchanged: it
-- still counts every member of every clan.
--
-- Weeks that start before the cut-over (_clan_war_mode) are computed exactly as before,
-- so the settlement of the week that ends on the night of 19.10 is not affected.

-- ----------------------------------------------------------------- tables
create table if not exists public.clan_wars (
  id bigserial primary key,
  clan_id bigint not null references public.clans(id) on delete cascade,
  week_start timestamptz not null,
  started_at timestamptz not null default now(),
  started_by uuid references public.profiles(id) on delete set null,
  unique (clan_id, week_start)
);
create table if not exists public.clan_war_members (
  war_id bigint not null references public.clan_wars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (war_id, user_id)
);
alter table public.clan_wars enable row level security;
alter table public.clan_war_members enable row level security;
-- Read and written only through the functions below.
revoke all on public.clan_wars, public.clan_war_members from anon, authenticated;
revoke all on sequence public.clan_wars_id_seq from anon, authenticated;

-- ----------------------------------------------------------------- helpers
-- The first week that runs by sign-up: the one that starts on Monday 19.10.2026
-- 00:00 in Batumi (UTC+4) — Moscow's week starts three hours later, still after it.
create or replace function public._clan_war_mode(p_week_start timestamptz)
returns boolean language sql immutable as $$
  select p_week_start >= timestamptz '2026-10-18 20:00:00+00'
$$;

-- Is this clan in the race that week? Always before the cut-over.
create or replace function public._clan_in_race(p_clan_id bigint, p_week_start timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select not public._clan_war_mode(p_week_start)
    or exists (select 1 from public.clan_wars w where w.clan_id = p_clan_id and w.week_start = p_week_start)
$$;

-- Does this player row for the race (roster)? Everyone before the cut-over.
create or replace function public._clan_war_has(p_clan_id bigint, p_week_start timestamptz, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public._clan_war_mode(p_week_start)
    or exists (
      select 1 from public.clan_wars w join public.clan_war_members m on m.war_id = w.id
      where w.clan_id = p_clan_id and w.week_start = p_week_start and m.user_id = p_user_id)
$$;

-- The events that count for the race: all of the clan's week events before the
-- cut-over, afterwards only the roster's, from the moment the war was started.
create or replace function public._clan_war_events(p_clan_id bigint, p_week_start timestamptz)
returns table(user_id uuid, at timestamptz, kind text, meters integer, points integer)
language sql stable security definer set search_path = public as $$
  select e.user_id, e.at, e.kind, e.meters, e.points
  from public._clan_week_events(p_clan_id, p_week_start) e
  where not public._clan_war_mode(p_week_start)
  union all
  select e.user_id, e.at, e.kind, e.meters, e.points
  from public._clan_week_events(p_clan_id, p_week_start) e
  join public.clan_wars w on w.clan_id = p_clan_id and w.week_start = p_week_start
  join public.clan_war_members m on m.war_id = w.id and m.user_id = e.user_id
  where public._clan_war_mode(p_week_start) and e.at >= w.started_at
$$;
revoke execute on function public._clan_in_race(bigint, timestamptz), public._clan_war_has(bigint, timestamptz, uuid),
  public._clan_war_events(bigint, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------- race state
-- Same as before, but the events are the war's and the finish is by the roster.
create or replace function public._clan_race_state(p_clan_id bigint, p_week_start timestamp with time zone)
returns table(meters integer, finish integer, finished_at timestamp with time zone, members integer)
language sql stable security definer set search_path to 'public' as $$
  with c as (select cl.city from public.clans cl where cl.id = p_clan_id),
  m as (
    select
      case when public._clan_war_mode(p_week_start)
        then (select greatest(3, count(*))::int from public.clan_wars w join public.clan_war_members wm on wm.war_id = w.id
              where w.clan_id = p_clan_id and w.week_start = p_week_start)
        else (select greatest(3, count(*))::int from public.clan_members cm where cm.clan_id = p_clan_id and cm.left_at is null)
      end as n,
      case when public._clan_war_mode(p_week_start)
        then (select count(*)::int from public.clan_wars w join public.clan_war_members wm on wm.war_id = w.id
              where w.clan_id = p_clan_id and w.week_start = p_week_start)
        else (select count(*)::int from public.clan_members cm where cm.clan_id = p_clan_id and cm.left_at is null)
      end as real_n
  ),
  ev as (
    select e.user_id, e.at, e.meters, (e.at at time zone public._city_tz((select city from c)))::date as day
    from public._clan_war_events(p_clan_id, p_week_start) e
  ),
  capped as (
    select ev.at,
      greatest(0, least(150, sum(ev.meters) over w) - least(150, sum(ev.meters) over w - ev.meters)) as eff
    from ev
    window w as (partition by ev.user_id, ev.day order by ev.at rows between unbounded preceding and current row)
  ),
  run as (
    select capped.at, sum(capped.eff) over (order by capped.at rows between unbounded preceding and current row) as cum
    from capped
  )
  select
    coalesce((select sum(eff) from capped), 0)::int,
    (select n from m) * 200,
    (select min(run.at) from run where run.cum >= (select n from m) * 200),
    (select real_n from m);
$$;

-- ----------------------------------------------------------------- the board
create or replace function public.get_clan_race(p_city text)
returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_ws timestamptz := public._city_week_start(p_city);
  v_mode boolean := public._clan_war_mode(v_ws);
  v_my_clan bigint;
  v_my_role text;
  v_today int := 0;
  v_tz text := public._city_tz(p_city);
  v_rowers jsonb := '[]'::jsonb;
  v_war public.clan_wars;
  v_roster jsonb := '[]'::jsonb;
  v_active int := 0;
begin
  select cm.clan_id, cm.role into v_my_clan, v_my_role
  from public.clan_members cm join public.clans c on c.id = cm.clan_id
  where cm.user_id = v_uid and cm.left_at is null and c.city = p_city;

  if v_my_clan is not null then
    select * into v_war from public.clan_wars w where w.clan_id = v_my_clan and w.week_start = v_ws;
    select count(*) into v_active from public.clan_members cm where cm.clan_id = v_my_clan and cm.left_at is null;

    select least(150, coalesce(sum(e.meters), 0)) into v_today
    from public._clan_war_events(v_my_clan, v_ws) e
    where e.user_id = v_uid and (e.at at time zone v_tz)::date = (now() at time zone v_tz)::date;

    select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'meters', x.m) order by x.m desc, p.display_name), '[]'::jsonb)
    into v_rowers
    from (
      select c.user_id, sum(c.eff)::int as m
      from (
        select e.user_id,
          greatest(0, least(150, sum(e.meters) over w) - least(150, sum(e.meters) over w - e.meters)) as eff
        from public._clan_war_events(v_my_clan, v_ws) e
        window w as (partition by e.user_id, (e.at at time zone v_tz)::date order by e.at rows between unbounded preceding and current row)
      ) c
      group by c.user_id
      having sum(c.eff) > 0
    ) x
    join public.profiles p on p.id = x.user_id;

    if v_war.id is not null then
      select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url) order by p.display_name), '[]'::jsonb)
      into v_roster
      from public.clan_war_members m join public.profiles p on p.id = m.user_id where m.war_id = v_war.id;
    end if;
  end if;

  return jsonb_build_object(
    'week_start', v_ws,
    'week_end', v_ws + interval '7 days',
    'my_clan_id', v_my_clan,
    'my_today', v_today,
    'daily_cap', 150,
    'my_rowers', v_rowers,
    -- Sign-up mode: the week runs by sign-up, whether this clan is in, who can open it.
    'war_mode', v_mode,
    'my_role', v_my_role,
    'my_clan_active', v_active,
    'my_war', case when v_war.id is null then null else jsonb_build_object(
      'started_at', v_war.started_at, 'roster', v_roster, 'size', jsonb_array_length(v_roster),
      'me_in', exists (select 1 from public.clan_war_members m where m.war_id = v_war.id and m.user_id = v_uid)) end,
    'can_start', v_mode and v_my_clan is not null and v_war.id is null and v_active >= 3 and public._clan_role_rank(v_my_role) >= 3,
    'clans', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.rank)
      from (
        select c.id, c.name, c.crest, s.meters, s.finish, s.finished_at, s.members,
          row_number() over (order by s.finished_at nulls last, (s.meters::numeric / s.finish) desc, c.trophies desc, c.id) as rank
        from public.clans c
        cross join lateral public._clan_race_state(c.id, v_ws) s
        where c.city = p_city and c.disbanded_at is null and not public._clan_race_voided(c.id, v_ws)
          and public._clan_in_race(c.id, v_ws)
      ) r), '[]'::jsonb),
    'last_week', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'crest', c.crest, 'place', w.race_place,
        'finished', w.race_finished_at is not null, 'meters', w.race_meters, 'finish', w.race_finish) order by w.race_place)
      from public.clan_weeks w join public.clans c on c.id = w.clan_id
      where c.city = p_city and w.week_start = v_ws - interval '7 days' and w.race_place is not null and w.race_place <= 3), '[]'::jsonb)
  );
end;
$$;

-- ----------------------------------------------------------------- who to pick
-- The members for the roster screen with last week's activity: catches, metres
-- (with the daily cap, as in the race) and the last catch. Leader / co-leader only.
create or replace function public.get_clan_war_candidates(p_clan_id bigint default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_me public.clan_members;
  v_clan public.clans;
  v_prev timestamptz;
  v_tz text;
begin
  v_me := public._clan_membership(v_uid, p_clan_id);
  if v_me.id is null or public._clan_role_rank(v_me.role) < 3 then raise exception 'CLAN:not_allowed'; end if;
  select * into v_clan from public.clans c where c.id = v_me.clan_id and c.disbanded_at is null;
  if not found then raise exception 'CLAN:no_clan'; end if;
  v_tz := public._city_tz(v_clan.city);
  v_prev := public._city_week_start(v_clan.city) - interval '7 days';

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', cm.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'role', cm.role,
      'catches', coalesce(w.catches, 0), 'meters', coalesce(w.meters, 0), 'last_catch_at', lc.at
    ) order by coalesce(w.meters, 0) desc, coalesce(w.catches, 0) desc, p.display_name)
    from public.clan_members cm
    join public.profiles p on p.id = cm.user_id
    left join lateral (
      select max(k.caught_at) as at from public.catches k where k.user_id = cm.user_id
    ) lc on true
    left join lateral (
      select count(*) filter (where e.kind = 'catch')::int as catches, coalesce(sum(eff), 0)::int as meters
      from (
        select e.kind,
          greatest(0, least(150, sum(e.meters) over w) - least(150, sum(e.meters) over w - e.meters)) as eff
        from public._clan_week_events(v_clan.id, v_prev) e
        where e.user_id = cm.user_id
        window w as (partition by (e.at at time zone v_tz)::date order by e.at rows between unbounded preceding and current row)
      ) e
    ) w on true
    where cm.clan_id = v_clan.id and cm.left_at is null and coalesce(p.is_blocked, false) = false
  ), '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------- start the war
create or replace function public.start_clan_war(p_clan_id bigint, p_user_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_me public.clan_members;
  v_clan public.clans;
  v_ws timestamptz;
  v_ids uuid[];
  v_n int;
  v_war bigint;
  r record;
begin
  v_me := public._clan_membership(v_uid, p_clan_id);
  if v_me.id is null or public._clan_role_rank(v_me.role) < 3 then raise exception 'CLAN:not_allowed'; end if;
  select * into v_clan from public.clans c where c.id = v_me.clan_id and c.disbanded_at is null;
  if not found then raise exception 'CLAN:no_clan'; end if;
  v_ws := public._city_week_start(v_clan.city);
  if not public._clan_war_mode(v_ws) then raise exception 'CLAN:war_not_open'; end if;
  if exists (select 1 from public.clan_wars w where w.clan_id = v_clan.id and w.week_start = v_ws) then raise exception 'CLAN:war_exists'; end if;
  if public._clan_race_voided(v_clan.id, v_ws) then raise exception 'CLAN:not_allowed'; end if;

  v_ids := array(select distinct u from unnest(coalesce(p_user_ids, '{}')) as u);
  v_n := cardinality(v_ids);
  if v_n < 3 then raise exception 'CLAN:war_roster_small'; end if;
  if (select count(*) from public.clan_members cm where cm.clan_id = v_clan.id and cm.left_at is null and cm.user_id = any(v_ids)) <> v_n then
    raise exception 'CLAN:war_bad_roster';
  end if;

  begin
    insert into public.clan_wars (clan_id, week_start, started_by) values (v_clan.id, v_ws, v_uid) returning id into v_war;
  exception when unique_violation then
    raise exception 'CLAN:war_exists';
  end;
  insert into public.clan_war_members (war_id, user_id) select v_war, u from unnest(v_ids) as u;
  insert into public.clan_events (clan_id, kind, actor_id, payload) values (v_clan.id, 'war_started', v_uid, jsonb_build_object('size', v_n));

  -- «Your clan is in the battle, you are in the roster» — to the roster, but not to whoever started it.
  for r in select u from unnest(v_ids) as u where u <> v_uid loop
    perform public._clan_notify(r.u, 'clan_war_started', v_uid, v_clan.id, jsonb_build_object('size', v_n, 'week_end', v_ws + interval '7 days'));
  end loop;
  return jsonb_build_object('war_id', v_war, 'size', v_n);
end;
$$;
grant execute on function public.get_clan_war_candidates(bigint), public.start_clan_war(bigint, uuid[]) to authenticated, service_role;
revoke execute on function public.get_clan_war_candidates(bigint), public.start_clan_war(bigint, uuid[]) from public, anon;

-- ----------------------------------------------------------------- the tick (overtaken / finished)
create or replace function public.clan_race_tick(p_city text)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_ws timestamptz := public._city_week_start(p_city);
  r record;
  v_prev public.clan_weeks;
  v_ahead text;
begin
  for r in
    select c.id, c.name, s.meters, s.finish, s.finished_at,
      row_number() over (order by s.finished_at nulls last, (s.meters::numeric / s.finish) desc, c.trophies desc, c.id) as rank
    from public.clans c
    cross join lateral public._clan_race_state(c.id, v_ws) s
    where c.city = p_city and c.disbanded_at is null and not public._clan_race_voided(c.id, v_ws)
      and public._clan_in_race(c.id, v_ws)
  loop
    select * into v_prev from public.clan_weeks w where w.clan_id = r.id and w.week_start = v_ws;
    insert into public.clan_weeks (clan_id, week_start, race_meters, race_finish, race_finished_at, race_rank)
    values (r.id, v_ws, r.meters, r.finish, r.finished_at, r.rank)
    on conflict (clan_id, week_start) do update set
      race_meters = excluded.race_meters, race_finish = excluded.race_finish,
      race_finished_at = excluded.race_finished_at, race_rank = excluded.race_rank;

    -- Overtaken: the place got worse. At most once in 3 hours per clan.
    if v_prev.race_rank is not null and r.rank > v_prev.race_rank
       and (v_prev.overtaken_notified_at is null or v_prev.overtaken_notified_at < now() - interval '3 hours') then
      select c2.name into v_ahead from public.clans c2
      cross join lateral public._clan_race_state(c2.id, v_ws) s2
      where c2.city = p_city and c2.disbanded_at is null and c2.id <> r.id and not public._clan_race_voided(c2.id, v_ws)
        and public._clan_in_race(c2.id, v_ws)
      order by s2.finished_at nulls last, (s2.meters::numeric / s2.finish) desc limit 1;
      perform public._clan_notify(cm.user_id, 'clan_race_overtaken', null, r.id, jsonb_build_object('rank', r.rank, 'ahead', v_ahead))
      from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null and public._clan_war_has(r.id, v_ws, cm.user_id);
      update public.clan_weeks set overtaken_notified_at = now() where clan_id = r.id and week_start = v_ws;
    end if;

    if r.finished_at is not null and not coalesce(v_prev.finished_notified, false) then
      perform public._clan_notify(cm.user_id, 'clan_race_finished', null, r.id, jsonb_build_object('rank', r.rank))
      from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null and public._clan_war_has(r.id, v_ws, cm.user_id);
      update public.clan_weeks set finished_notified = true where clan_id = r.id and week_start = v_ws;
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------- settlement
-- The weekly settlement, split in two so a week can be settled by its start
-- (the wrapper keeps the cron's call as it was).
create or replace function public._settle_clan_week_at(p_city text, p_ws timestamptz)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_ws timestamptz := p_ws;
  v_tz text := public._city_tz(p_city);
  v_clans int;
  r record;
  m record;
  v_points int;
  v_members int;
  v_tier int;
  v_chest_coins int;
  v_race_coins int;
  v_trophies int;
  v_xp int;
  v_mult int;
  v_won boolean;
begin
  -- Annulled clans and (from the sign-up weeks) clans that did not open the war
  -- are not in the race: no place, no coins, no trophies for the battle; the weekly chest stays.
  select count(*) into v_clans from public.clans c
  where c.city = p_city and c.disbanded_at is null and c.created_at < v_ws + interval '7 days'
    and not public._clan_race_voided(c.id, v_ws) and public._clan_in_race(c.id, v_ws);

  for r in
    select x.*,
      case when x.voided or not x.in_race then null
           else row_number() over (partition by (x.voided or not x.in_race) order by x.finished_at nulls last, (x.meters::numeric / x.finish) desc, x.trophies desc, x.id)
      end as place
    from (
      select c.id, c.name, c.trophies, s.meters, s.finish, s.finished_at, public._clan_race_voided(c.id, v_ws) as voided,
        public._clan_in_race(c.id, v_ws) as in_race
      from public.clans c
      cross join lateral public._clan_race_state(c.id, v_ws) s
      where c.city = p_city and c.disbanded_at is null and c.created_at < v_ws + interval '7 days'
    ) x
  loop
    if exists (select 1 from public.clan_weeks w where w.clan_id = r.id and w.week_start = v_ws and w.settled_at is not null) then
      continue;
    end if;

    select count(*) into v_members from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null;
    select coalesce(sum(e.points), 0) into v_points from public._clan_week_events(r.id, v_ws) e;
    v_tier := public._chest_tier(v_points, v_members);
    v_chest_coins := case v_tier when 1 then 20 when 2 then 45 when 3 then 80 when 4 then 120 when 5 then 170 else 0 end;
    v_won := not r.voided and r.in_race and v_clans >= 2 and r.place = 1;
    if r.voided or not r.in_race then
      v_race_coins := 0;
      v_trophies := 0;
      v_xp := v_tier * 15;
    else
      v_race_coins := (case when r.finished_at is not null then 80 else 0 end)
        + (case when v_clans >= 2 then case r.place when 1 then 120 when 2 then 60 when 3 then 30 else 0 end else 0 end);
      v_trophies := (case when r.finished_at is not null then 10 else 0 end)
        + (case when v_clans >= 2 then case r.place when 1 then 30 when 2 then 15 when 3 then 5 else 0 end else 0 end);
      v_xp := v_tier * 15 + (case when r.finished_at is not null then 40 else 0 end)
        + (case when v_clans >= 2 then case r.place when 1 then 30 when 2 then 20 when 3 then 10 else 0 end else 0 end);
    end if;

    for m in
      select cm.user_id,
        coalesce((select sum(e.points) from public._clan_week_events(r.id, v_ws) e where e.user_id = cm.user_id), 0) as pts,
        coalesce((select sum(e.meters) from public._clan_war_events(r.id, v_ws) e where e.user_id = cm.user_id), 0) as mtr
      from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null
    loop
      v_mult := public.coin_multiplier(m.user_id);
      if v_chest_coins > 0 and m.pts > 0 then
        update public.profiles set coins = coins + v_chest_coins * v_mult where id = m.user_id;
        insert into public.coin_transactions (user_id, amount, reason, label)
        values (m.user_id, v_chest_coins * v_mult, 'clan_chest', 'Сундук клана «' || r.name || '»');
        perform public._clan_notify(m.user_id, 'clan_chest_reward', null, r.id, jsonb_build_object('tier', v_tier, 'coins', v_chest_coins * v_mult));
      end if;
      -- Race rewards: whoever rowed (10 m+) — in the sign-up weeks only the roster has metres.
      if m.mtr >= 10 and not r.voided and r.in_race then
        if v_race_coins > 0 then
          update public.profiles set coins = coins + v_race_coins * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_race_coins * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_race_coins * v_mult, 'trophies', v_trophies));
        if v_won then
          insert into public.user_awards (user_id, kind, title, subtitle, description, period_key)
          values (m.user_id, 'clan_race_winner', 'Победитель битвы кланов', 'Клан «' || r.name || '»',
            'Клан «' || r.name || '» победил в битве кланов недели '
              || to_char(v_ws at time zone v_tz, 'DD.MM') || '–' || to_char((v_ws + interval '6 days') at time zone v_tz, 'DD.MM') || '.',
            to_char(v_ws at time zone v_tz, 'YYYY-MM-DD'))
          on conflict (user_id, kind, period_key) where period_key is not null do nothing;
        end if;
      end if;
    end loop;

    update public.clans set xp = xp + v_xp, trophies = greatest(0, trophies + v_trophies) where id = r.id;
    insert into public.clan_weeks (clan_id, week_start, chest_points, chest_tier, race_meters, race_finish, race_finished_at, race_place, race_coins, race_trophies, race_won, settled_at)
    values (r.id, v_ws, v_points, v_tier, r.meters, r.finish, r.finished_at, r.place, v_race_coins, v_trophies, v_won, now())
    on conflict (clan_id, week_start) do update set
      chest_points = excluded.chest_points, chest_tier = excluded.chest_tier, race_meters = excluded.race_meters,
      race_finish = excluded.race_finish, race_finished_at = excluded.race_finished_at, race_place = excluded.race_place,
      race_coins = excluded.race_coins, race_trophies = excluded.race_trophies, race_won = excluded.race_won, settled_at = now();
    insert into public.clan_events (clan_id, kind, payload)
    values (r.id, 'week_result', jsonb_build_object('place', r.place, 'tier', v_tier, 'trophies', v_trophies, 'xp', v_xp,
      'finished', r.finished_at is not null, 'voided', r.voided, 'won', v_won, 'in_race', r.in_race));
  end loop;
end;
$$;
revoke execute on function public._settle_clan_week_at(text, timestamptz) from public, anon, authenticated;

create or replace function public.settle_clan_week(p_city text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._settle_clan_week_at(p_city, public._city_week_start(p_city) - interval '7 days');
end;
$$;

-- ----------------------------------------------------------------- reminders
-- «Open the war» to the leader and the co-leaders of a clan that has not started it.
-- p_slot: 'start' (Monday morning) or 'last' (Sunday noon, the last hours).
create or replace function public.clan_war_reminder(p_city text, p_slot text)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_ws timestamptz := public._city_week_start(p_city);
  r record;
begin
  if not public._clan_war_mode(v_ws) then return; end if;
  for r in
    select c.id, cm.user_id
    from public.clans c
    join public.clan_members cm on cm.clan_id = c.id and cm.left_at is null and cm.role in ('leader', 'co_leader')
    where c.city = p_city and c.disbanded_at is null
      and (select count(*) from public.clan_members x where x.clan_id = c.id and x.left_at is null) >= 3
      and not exists (select 1 from public.clan_wars w where w.clan_id = c.id and w.week_start = v_ws)
      and not exists (select 1 from public.notifications n
                      where n.user_id = cm.user_id and n.kind = 'clan_war_reminder' and n.created_at >= v_ws and n.payload->>'slot' = p_slot)
  loop
    perform public._clan_notify(r.user_id, 'clan_war_reminder', null, r.id, jsonb_build_object('slot', p_slot, 'week_end', v_ws + interval '7 days'));
  end loop;
end;
$$;
revoke execute on function public.clan_war_reminder(text, text) from public, anon, authenticated;
