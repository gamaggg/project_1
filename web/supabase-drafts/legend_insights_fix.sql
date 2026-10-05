-- Правки пачки 3 (решения пользователя 05.10); прод эти объекты ещё не вызывает.
-- 1) Легенда сектора: 90 дней вместо 30 и минимум 10 уловов вместо 3.
-- 2) «Что клюёт здесь» — только уловы этого сектора (никаких «всех секторов того же типа» и соседей):
--    3+ улова здесь за 90 дней → они; иначе все уловы сектора за всё время (0 — блок не показывается).
--    my_count — за 90 дней, как у легенды.

create or replace function public._sector_legend(p_territory_id text)
 returns table(user_id uuid, catches int)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select c.user_id, count(*)::int
  from public.catches c
  join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
  where c.territory_id = p_territory_id and c.caught_at > now() - interval '90 days'
  group by c.user_id
  having count(*) >= 10
  order by count(*) desc, min(c.caught_at) asc
  limit 1;
$function$;

create or replace function public.get_sector_insights(p_territory_id text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_tz text := public._city_tz(case when left(p_territory_id, 1) = 'M' then 'moscow' else 'batumi' end);
  v_scope text;
  v_out jsonb;
begin
  select t.kind::text into v_kind from public.territories t where t.id = p_territory_id;
  if not found then
    raise exception 'unknown sector';
  end if;

  if (select count(*) from public.catches c
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
      and (v_scope = 'sector_all' or c.caught_at > now() - interval '90 days')
  )
  select jsonb_build_object(
    'scope', v_scope,
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

-- legend_id в territories_with_stats: то же правило (в представлении ровно одно окно и одно HAVING).
do $$
declare
  v_view text := pg_get_viewdef('public.territories_with_stats'::regclass, true);
begin
  if md5(v_view) <> '834f8cc9f0e67664492de0bc8b314a71' then
    raise exception 'territories_with_stats changed since inspection';
  end if;
  v_view := rtrim(v_view, E'; \n');
  v_view := replace(v_view, '''30 days''::interval', '''90 days''::interval');
  v_view := replace(v_view, 'HAVING count(*) >= 3', 'HAVING count(*) >= 10');
  execute 'create or replace view public.territories_with_stats as ' || v_view;
end $$;
