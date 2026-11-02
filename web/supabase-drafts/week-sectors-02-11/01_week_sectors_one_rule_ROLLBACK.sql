-- Back to the old counts: sectors by territories.claimed_at in the week, the
-- recap's angler/you by capture events and your place by catches.
create or replace function public._weekly_sector_counts(p_week_start timestamp with time zone, p_week_end timestamp with time zone, p_city_prefix text)
 returns table(uid uuid, cnt bigint)
 language sql
 stable
 set search_path to 'public'
as $function$
  select x.uid, count(*)::bigint
  from (
    select t.owner_id as uid, t.id
    from public.territories t
    where t.is_deleted = false
      and t.owner_id is not null
      and t.claimed_at >= p_week_start
      and t.claimed_at < p_week_end
      and t.id like p_city_prefix || '%'
    union
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

do $$
declare
  v_def text := pg_get_functiondef('public.get_city_week_recap(text, integer, uuid)'::regprocedure);
  v_rated_start int := strpos(v_def, E'    rated as (\n');
  v_rated_end int := strpos(v_def, E'    per_user as (\n');
begin
  if v_rated_start = 0 or v_rated_end <= v_rated_start then
    raise exception 'get_city_week_recap: rated CTE not found';
  end if;
  v_def := substr(v_def, 1, v_rated_start - 1) || substr(v_def, v_rated_end);
  v_def := replace(v_def, '''captures'', coalesce((select r.sectors from rated r where r.user_id = u.user_id), 0))', '''captures'', (select count(*) from claims cl where cl.user_id = u.user_id))');
  v_def := replace(v_def, 'u.n desc, coalesce((select r.sectors from rated r where r.user_id = u.user_id), 0) desc, u.first_at asc', 'u.n desc, (select count(*) from claims cl where cl.user_id = u.user_id) desc, u.first_at asc');
  v_def := replace(v_def, '''captures'', coalesce((select r.sectors from rated r where r.user_id = v_me), 0),', '''captures'', (select count(*) from claims where user_id = v_me),');
  v_def := replace(v_def, '''place'', (select r.rnk from rated r where r.user_id = v_me),', '''place'', (select place from per_user where user_id = v_me),');
  execute v_def;
end
$$;

delete from public.rating_places r
where r.week_start >= (select min(public._city_week_start(c)) from unnest(array['batumi','moscow','spb','sochi','tbilisi']) c);
