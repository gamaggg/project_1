-- The four functions as they were on 18.10.2026, before the clan war by sign-up
-- (the race of every clan, every member). Run this file to go back.

CREATE OR REPLACE FUNCTION public._clan_race_state(p_clan_id bigint, p_week_start timestamp with time zone)
 RETURNS TABLE(meters integer, finish integer, finished_at timestamp with time zone, members integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with c as (select cl.city from public.clans cl where cl.id = p_clan_id),
  m as (
    select greatest(3, count(*))::int as n, count(*)::int as real_n
    from public.clan_members cm where cm.clan_id = p_clan_id and cm.left_at is null
  ),
  ev as (
    select e.user_id, e.at, e.meters, (e.at at time zone public._city_tz((select city from c)))::date as day
    from public._clan_week_events(p_clan_id, p_week_start) e
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
$function$;

CREATE OR REPLACE FUNCTION public.get_clan_race(p_city text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ws timestamptz := public._city_week_start(p_city);
  v_my_clan bigint;
  v_today int := 0;
  v_tz text := public._city_tz(p_city);
  v_rowers jsonb := '[]'::jsonb;
begin
  select cm.clan_id into v_my_clan from public.clan_members cm join public.clans c on c.id = cm.clan_id
  where cm.user_id = v_uid and cm.left_at is null and c.city = p_city;

  if v_my_clan is not null then
    select least(150, coalesce(sum(e.meters), 0)) into v_today
    from public._clan_week_events(v_my_clan, v_ws) e
    where e.user_id = v_uid and (e.at at time zone v_tz)::date = (now() at time zone v_tz)::date;

    select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'meters', x.m) order by x.m desc, p.display_name), '[]'::jsonb)
    into v_rowers
    from (
      select c.user_id, sum(c.eff)::int as m
      from (
        select e.user_id,
          greatest(0, least(150, sum(e.meters) over w) - least(150, sum(e.meters) over w - e.meters)) as eff
        from public._clan_week_events(v_my_clan, v_ws) e
        window w as (partition by e.user_id, (e.at at time zone v_tz)::date order by e.at rows between unbounded preceding and current row)
      ) c
      group by c.user_id
      having sum(c.eff) > 0
    ) x
    join public.profiles p on p.id = x.user_id;
  end if;

  return jsonb_build_object(
    'week_start', v_ws,
    'week_end', v_ws + interval '7 days',
    'my_clan_id', v_my_clan,
    'my_today', v_today,
    'daily_cap', 150,
    'my_rowers', v_rowers,
    'clans', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.rank)
      from (
        select c.id, c.name, c.crest, s.meters, s.finish, s.finished_at, s.members,
          row_number() over (order by s.finished_at nulls last, (s.meters::numeric / s.finish) desc, c.trophies desc, c.id) as rank
        from public.clans c
        cross join lateral public._clan_race_state(c.id, v_ws) s
        where c.city = p_city and c.disbanded_at is null and not public._clan_race_voided(c.id, v_ws)
      ) r), '[]'::jsonb),
    'last_week', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'crest', c.crest, 'place', w.race_place,
        'finished', w.race_finished_at is not null, 'meters', w.race_meters, 'finish', w.race_finish) order by w.race_place)
      from public.clan_weeks w join public.clans c on c.id = w.clan_id
      where c.city = p_city and w.week_start = v_ws - interval '7 days' and w.race_place is not null and w.race_place <= 3), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.clan_race_tick(p_city text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  loop
    select * into v_prev from public.clan_weeks w where w.clan_id = r.id and w.week_start = v_ws;
    insert into public.clan_weeks (clan_id, week_start, race_meters, race_finish, race_finished_at, race_rank)
    values (r.id, v_ws, r.meters, r.finish, r.finished_at, r.rank)
    on conflict (clan_id, week_start) do update set
      race_meters = excluded.race_meters, race_finish = excluded.race_finish,
      race_finished_at = excluded.race_finished_at, race_rank = excluded.race_rank;

    -- Обогнали: место стало хуже. Не чаще раза в 3 часа на клан.
    if v_prev.race_rank is not null and r.rank > v_prev.race_rank
       and (v_prev.overtaken_notified_at is null or v_prev.overtaken_notified_at < now() - interval '3 hours') then
      select c2.name into v_ahead from public.clans c2
      cross join lateral public._clan_race_state(c2.id, v_ws) s2
      where c2.city = p_city and c2.disbanded_at is null and c2.id <> r.id and not public._clan_race_voided(c2.id, v_ws)
      order by s2.finished_at nulls last, (s2.meters::numeric / s2.finish) desc limit 1;
      perform public._clan_notify(cm.user_id, 'clan_race_overtaken', null, r.id, jsonb_build_object('rank', r.rank, 'ahead', v_ahead))
      from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null;
      update public.clan_weeks set overtaken_notified_at = now() where clan_id = r.id and week_start = v_ws;
    end if;

    if r.finished_at is not null and not coalesce(v_prev.finished_notified, false) then
      perform public._clan_notify(cm.user_id, 'clan_race_finished', null, r.id, jsonb_build_object('rank', r.rank))
      from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null;
      update public.clan_weeks set finished_notified = true where clan_id = r.id and week_start = v_ws;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.settle_clan_week(p_city text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ws timestamptz := public._city_week_start(p_city) - interval '7 days';
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
  -- Аннулированные кланы в гонке не считаются: ни места, ни монет, ни
  -- трофеев за битву кланов; сундук недели им остаётся.
  select count(*) into v_clans from public.clans c
  where c.city = p_city and c.disbanded_at is null and c.created_at < v_ws + interval '7 days'
    and not public._clan_race_voided(c.id, v_ws);

  for r in
    select x.*,
      case when x.voided then null
           else row_number() over (partition by x.voided order by x.finished_at nulls last, (x.meters::numeric / x.finish) desc, x.trophies desc, x.id)
      end as place
    from (
      select c.id, c.name, c.trophies, s.meters, s.finish, s.finished_at, public._clan_race_voided(c.id, v_ws) as voided
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
    v_won := not r.voided and v_clans >= 2 and r.place = 1;
    if r.voided then
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
        coalesce((select sum(e.meters) from public._clan_week_events(r.id, v_ws) e where e.user_id = cm.user_id), 0) as mtr
      from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null
    loop
      v_mult := public.coin_multiplier(m.user_id);
      if v_chest_coins > 0 and m.pts > 0 then
        update public.profiles set coins = coins + v_chest_coins * v_mult where id = m.user_id;
        insert into public.coin_transactions (user_id, amount, reason, label)
        values (m.user_id, v_chest_coins * v_mult, 'clan_chest', 'Сундук клана «' || r.name || '»');
        perform public._clan_notify(m.user_id, 'clan_chest_reward', null, r.id, jsonb_build_object('tier', v_tier, 'coins', v_chest_coins * v_mult));
      end if;
      if m.mtr >= 10 and not r.voided then
        if v_race_coins > 0 then
          update public.profiles set coins = coins + v_race_coins * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_race_coins * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_race_coins * v_mult, 'trophies', v_trophies));
        -- Медаль в кольцо наград профиля — тем, кто грёб за клан-победитель.
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
      'finished', r.finished_at is not null, 'voided', r.voided, 'won', v_won));
  end loop;
end;
$function$;

-- (the new functions can stay: nothing calls them once the old four are back)
