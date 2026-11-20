-- «Что клюёт здесь»: period switch «Всё время» / «30 дней».
-- get_sector_insights gets an optional p_days (DEFAULT 90 = exactly the old
-- behaviour, so the client deployed right now, which sends only
-- p_territory_id, keeps working the same):
--   p_days = 90 (default)  — old rule: last 90 days if 3+ catches there, else all time
--                           (scope 'sector' / 'sector_all');
--   p_days > 0, not 90     — strictly the last p_days days, may be empty (scope 'days');
--   p_days = 0 or null     — all time (scope 'all').
-- Legend and my_count are untouched (the legend is a 90-day rule).
-- DROP + CREATE (the argument list changes): DEFAULT kept, grants repeated
-- exactly as live (authenticated, service_role; no anon, no PUBLIC).
set local lock_timeout = '3s';

drop function public.get_sector_insights(text);

create function public.get_sector_insights(p_territory_id text, p_days integer default 90)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_tz text := public._city_tz(public._prefix_city(left(p_territory_id, 1)));
  v_days int := greatest(coalesce(p_days, 0), 0);
  v_scope text;
  v_out jsonb;
begin
  select t.kind::text into v_kind from public.territories t where t.id = p_territory_id;
  if not found then
    raise exception 'unknown sector';
  end if;

  if v_days = 0 then
    v_scope := 'all';
  elsif v_days <> 90 then
    v_scope := 'days';
  elsif (select count(*) from public.catches c
      join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
      where c.territory_id = p_territory_id and c.caught_at > now() - interval '90 days') >= 3 then
    v_scope := 'sector';
  else
    v_scope := 'sector_all';
  end if;

  with src as (
    select c.species, c.method, c.bait, c.caught_at
    from public.catches c
    join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
    where c.territory_id = p_territory_id
      and (v_scope in ('all', 'sector_all') or c.caught_at > now() - make_interval(days => v_days))
  )
  select jsonb_build_object(
    'scope', v_scope,
    'days', v_days,
    'kind', v_kind,
    'total', (select count(*) from src),
    'species', coalesce((select jsonb_agg(jsonb_build_object('key', x.species, 'count', x.n) order by x.n desc, x.species)
                         from (select species, count(*) as n from src group by species order by count(*) desc, species limit 5) x), '[]'::jsonb),
    'hours', (select jsonb_agg(coalesce(h.n, 0) order by g.h)
              from generate_series(0, 23) g(h)
              left join (select extract(hour from caught_at at time zone v_tz)::int as hr, count(*)::int as n from src group by 1) h on h.hr = g.h),
    'methods', coalesce((select jsonb_agg(jsonb_build_object('name', x.method, 'count', x.n) order by x.n desc)
                         from (select method, count(*) as n from src where method is not null group by method order by count(*) desc limit 3) x), '[]'::jsonb),
    'baits', coalesce((select jsonb_agg(jsonb_build_object('name', x.bait, 'count', x.n) order by x.n desc)
                       from (select bait, count(*) as n from src where bait is not null group by bait order by count(*) desc limit 3) x), '[]'::jsonb),
    'last_catch_at', (select max(c.caught_at) from public.catches c where c.territory_id = p_territory_id),
    'legend', (select jsonb_build_object('id', l.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url, 'count', l.catches)
               from public._sector_legend(p_territory_id) l join public.profiles p on p.id = l.user_id),
    'my_count', case when v_uid is null then null else
      (select count(*) from public.catches c where c.territory_id = p_territory_id and c.user_id = v_uid
         and c.caught_at > now() - interval '90 days') end
  ) into v_out;
  return v_out;
end;
$function$;

revoke all on function public.get_sector_insights(text, integer) from public, anon;
grant execute on function public.get_sector_insights(text, integer) to authenticated, service_role;
