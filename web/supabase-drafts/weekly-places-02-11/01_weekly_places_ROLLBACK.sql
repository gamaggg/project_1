-- Undo 01_weekly_places.sql. The legend and duelists granted by steps 6–7 stay (their coins are
-- paid); delete them by hand if they must go: delete from public.user_awards
-- where kind in ('season_legend', 'duelist') and earned_at >= '<apply time>'.
do $$
declare
  v_def text := pg_get_functiondef('public.grant_weekly_rank_awards(text, text)'::regprocedure);
  v_from int := strpos(v_def, E'    -- The place itself, kept whatever user_awards_once does with the medal.\n');
  v_to int := strpos(v_def, E'    insert into public.user_awards');
begin
  if v_from = 0 or v_to <= v_from then
    raise exception 'grant_weekly_rank_awards: weekly_places insert not found';
  end if;
  execute substr(v_def, 1, v_from - 1) || substr(v_def, v_to);
end
$$;

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
    select ua.user_id as uid
    from public.user_awards ua
    where ua.kind = 'weekly_rank' and ua.period_key = v_this_week_key and ua.title = '1 место'
  loop
    v_streak_ok := true;
    for i in 1..3 loop
      if not exists (
        select 1 from public.user_awards
        where user_id = r.uid and kind = 'weekly_rank' and title = '1 место'
          and period_key = to_char((v_week_start - (i * interval '7 days')) at time zone p_timezone, 'YYYY-MM-DD')
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
    join public.user_awards ua
      on ua.user_id = al.previous_owner_id and ua.kind = 'weekly_rank' and ua.period_key = v_prev_week_key
      and ua.title in ('1 место', '2 место', '3 место')
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

drop table public.weekly_places;
