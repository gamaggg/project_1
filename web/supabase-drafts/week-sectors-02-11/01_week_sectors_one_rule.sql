-- One count of «sectors of the week» for the weekly rating and the week
-- recap (02.11). A sector of the week is
--   * a sector you captured that week (a 'claim' in activity_log) and still
--     hold, or
--   * a share in a clanmate's sector you joined that week.
-- Fishing on your own sector is not a capture. It used to count: an owner's
-- catch moves territories.claimed_at to now (confirm_catch), and the rating
-- went by claimed_at — Mimikron's M4059 (his since 23.10) counted for the
-- week of 26.10 after he fished there on 01.11. The recap counted capture
-- events instead and missed the clan shares: 6 there, 8 in the rating, 7 right.
--
-- _weekly_sector_counts feeds the rating (get_weekly_leaderboard), the weekly
-- places and medals (grant_weekly_rank_awards, notify_weekly_results) and
-- rating_tick, so they all follow. get_city_week_recap now takes the angler's
-- and your own sectors and your place in the city from the same rating.
-- Awards already granted stay as they are.

-- 1. The count.
create or replace function public._weekly_sector_counts(p_week_start timestamp with time zone, p_week_end timestamp with time zone, p_city_prefix text)
 returns table(uid uuid, cnt bigint)
 language sql
 stable
 set search_path to 'public'
as $function$
  select x.uid, count(*)::bigint
  from (
    -- Captured this week and still held: fishing on your own sector is not a capture.
    select t.owner_id as uid, t.id
    from public.territories t
    where t.is_deleted = false
      and t.owner_id is not null
      and t.id like p_city_prefix || '%'
      and exists (
        select 1 from public.activity_log a
        where a.territory_id = t.id and a.user_id = t.owner_id and a.kind = 'claim'
          and a.created_at >= p_week_start and a.created_at < p_week_end
      )
    union
    -- A share in a clanmate's sector joined this week.
    select s.user_id, t.id
    from public.territory_shares s
    join public.territories t on t.id = s.territory_id
    where t.is_deleted = false
      and s.joined_at >= p_week_start
      and s.joined_at < p_week_end
      and t.id like p_city_prefix || '%'
  ) x
  group by x.uid;
$function$;

-- 2. The recap: the angler's and your sectors and your place from the rating.
do $$
declare
  v_def text := pg_get_functiondef('public.get_city_week_recap(text, integer, uuid)'::regprocedure);
  v_pairs text[][] := array[
    [E'    per_user as (\n',
     E'    rated as (\n' ||
     E'      -- The weekly rating as the app shows it (get_weekly_leaderboard):\n' ||
     E'      -- sectors of the week, then catches, then the older account.\n' ||
     E'      select p.id as user_id, coalesce(s.cnt, 0)::int as sectors,\n' ||
     E'             row_number() over (order by coalesce(s.cnt, 0) desc, coalesce(c.cnt, 0) desc, p.created_at asc)::int as rnk\n' ||
     E'      from public.profiles p\n' ||
     E'      left join public._weekly_sector_counts(v_from, v_to, v_prefix) s on s.uid = p.id\n' ||
     E'      left join (select k.user_id as uid, count(*) as cnt from public.catches k\n' ||
     E'                 where left(k.territory_id, 1) = v_prefix and k.caught_at >= v_from and k.caught_at < v_to\n' ||
     E'                 group by k.user_id) c on c.uid = p.id\n' ||
     E'      where coalesce(s.cnt, 0) > 0 or coalesce(c.cnt, 0) > 0\n' ||
     E'    ),\n' ||
     E'    per_user as (\n'],
    ['''captures'', (select count(*) from claims cl where cl.user_id = u.user_id))',
     '''captures'', coalesce((select r.sectors from rated r where r.user_id = u.user_id), 0))'],
    ['u.n desc, (select count(*) from claims cl where cl.user_id = u.user_id) desc, u.first_at asc',
     'u.n desc, coalesce((select r.sectors from rated r where r.user_id = u.user_id), 0) desc, u.first_at asc'],
    ['''captures'', (select count(*) from claims where user_id = v_me),',
     '''captures'', coalesce((select r.sectors from rated r where r.user_id = v_me), 0),'],
    ['''place'', (select place from per_user where user_id = v_me),',
     '''place'', (select r.rnk from rated r where r.user_id = v_me),']
  ];
  i int;
begin
  for i in 1 .. array_length(v_pairs, 1) loop
    if (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]) <> 1 then
      raise exception 'get_city_week_recap: fragment % not found exactly once', i;
    end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end
$$;

-- 3. Places counted by the old rule must not read as «тебя обогнали»: the
-- next rating_tick of this week starts from scratch, silently.
delete from public.rating_places r
where r.week_start >= (select min(public._city_week_start(c)) from unnest(array['batumi','moscow','spb','sochi','tbilisi']) c);
