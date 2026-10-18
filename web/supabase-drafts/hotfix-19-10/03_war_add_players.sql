-- Clan battle by sign-up: players can be ADDED to the roster after the start (never
-- removed). An added player's metres count from the moment of adding, and the finish
-- grows by 200 m for each (the race state already counts the roster). Not possible once
-- the clan has finished. Leader / co-leader only.

alter table public.clan_war_members add column if not exists added_at timestamptz not null default now();
-- The roster picked at the start counts from the start itself.
update public.clan_war_members m set added_at = w.started_at
from public.clan_wars w where w.id = m.war_id and m.added_at <= w.started_at + interval '1 minute';

-- The events that count: the roster's, each from the moment the player joined it.
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
  where public._clan_war_mode(p_week_start) and e.at >= greatest(w.started_at, m.added_at)
$$;

-- The roster screen also needs to know who is already in (for «Добавить игроков»).
create or replace function public.get_clan_war_candidates(p_clan_id bigint default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_me public.clan_members;
  v_clan public.clans;
  v_prev timestamptz;
  v_ws timestamptz;
  v_tz text;
begin
  v_me := public._clan_membership(v_uid, p_clan_id);
  if v_me.id is null or public._clan_role_rank(v_me.role) < 3 then raise exception 'CLAN:not_allowed'; end if;
  select * into v_clan from public.clans c where c.id = v_me.clan_id and c.disbanded_at is null;
  if not found then raise exception 'CLAN:no_clan'; end if;
  v_tz := public._city_tz(v_clan.city);
  v_ws := public._city_week_start(v_clan.city);
  v_prev := v_ws - interval '7 days';

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', cm.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'role', cm.role,
      'catches', coalesce(w.catches, 0), 'meters', coalesce(w.meters, 0), 'last_catch_at', lc.at,
      'in_roster', exists (select 1 from public.clan_wars cw join public.clan_war_members wm on wm.war_id = cw.id
                           where cw.clan_id = v_clan.id and cw.week_start = v_ws and wm.user_id = cm.user_id)
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

create or replace function public.add_clan_war_players(p_clan_id bigint, p_user_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_me public.clan_members;
  v_clan public.clans;
  v_ws timestamptz;
  v_war public.clan_wars;
  v_ids uuid[];
  v_new uuid[];
  v_size int;
  r record;
begin
  v_me := public._clan_membership(v_uid, p_clan_id);
  if v_me.id is null or public._clan_role_rank(v_me.role) < 3 then raise exception 'CLAN:not_allowed'; end if;
  select * into v_clan from public.clans c where c.id = v_me.clan_id and c.disbanded_at is null;
  if not found then raise exception 'CLAN:no_clan'; end if;
  v_ws := public._city_week_start(v_clan.city);
  if not public._clan_war_mode(v_ws) then raise exception 'CLAN:war_not_open'; end if;
  select * into v_war from public.clan_wars w where w.clan_id = v_clan.id and w.week_start = v_ws;
  if v_war.id is null then raise exception 'CLAN:war_not_started'; end if;
  if public._clan_race_voided(v_clan.id, v_ws) then raise exception 'CLAN:not_allowed'; end if;
  -- A clan that already crossed the line cannot have its finish moved away.
  if exists (select 1 from public._clan_race_state(v_clan.id, v_ws) s where s.finished_at is not null) then raise exception 'CLAN:war_finished'; end if;

  v_ids := array(select distinct u from unnest(coalesce(p_user_ids, '{}')) as u);
  if (select count(*) from public.clan_members cm where cm.clan_id = v_clan.id and cm.left_at is null and cm.user_id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'CLAN:war_bad_roster';
  end if;
  v_new := array(select u from unnest(v_ids) as u
                 where not exists (select 1 from public.clan_war_members m where m.war_id = v_war.id and m.user_id = u));
  if coalesce(cardinality(v_new), 0) = 0 then raise exception 'CLAN:war_nothing_to_add'; end if;

  insert into public.clan_war_members (war_id, user_id, added_at) select v_war.id, u, now() from unnest(v_new) as u;
  select count(*) into v_size from public.clan_war_members where war_id = v_war.id;
  insert into public.clan_events (clan_id, kind, actor_id, payload) values (v_clan.id, 'war_added', v_uid, jsonb_build_object('count', cardinality(v_new), 'size', v_size));

  for r in select u from unnest(v_new) as u where u <> v_uid loop
    perform public._clan_notify(r.u, 'clan_war_started', v_uid, v_clan.id, jsonb_build_object('size', v_size, 'week_end', v_ws + interval '7 days'));
  end loop;
  return jsonb_build_object('added', cardinality(v_new), 'size', v_size);
end;
$$;
grant execute on function public.add_clan_war_players(bigint, uuid[]) to authenticated, service_role;
revoke execute on function public.add_clan_war_players(bigint, uuid[]) from public, anon;
