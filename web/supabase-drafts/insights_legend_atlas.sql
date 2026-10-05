-- Большое обновление, пачка 3 (только новое): «Что клюёт здесь», легенда сектора, атлас рыб.

-- ===== Легенда сектора: больше всех уловов на секторе за 30 дней, минимум 3 =====
-- Ничья — у того, кто начал ловить здесь раньше. Уловы заблокированных не считаются.
create function public._sector_legend(p_territory_id text)
 returns table(user_id uuid, catches int)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select c.user_id, count(*)::int
  from public.catches c
  join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
  where c.territory_id = p_territory_id and c.caught_at > now() - interval '30 days'
  group by c.user_id
  having count(*) >= 3
  order by count(*) desc, min(c.caught_at) asc
  limit 1;
$function$;
revoke all on function public._sector_legend(text) from public, anon, authenticated;

-- ===== Что клюёт здесь: уловы сектора за 30 дней; если их меньше 3 — все сектора
-- того же типа воды в городе. Плюс легенда сектора и сколько поймал сам смотрящий. =====
create function public.get_sector_insights(p_territory_id text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_prefix text := left(p_territory_id, 1);
  v_tz text := public._city_tz(case when left(p_territory_id, 1) = 'M' then 'moscow' else 'batumi' end);
  v_scope text := 'sector';
  v_out jsonb;
begin
  select t.kind::text into v_kind from public.territories t where t.id = p_territory_id;
  if v_kind is null then
    raise exception 'unknown sector';
  end if;

  if (select count(*) from public.catches c
      join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
      where c.territory_id = p_territory_id and c.caught_at > now() - interval '30 days') < 3 then
    v_scope := 'kind';
  end if;

  with src as (
    select c.species, c.method, c.bait, c.caught_at
    from public.catches c
    join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
    where c.caught_at > now() - interval '30 days'
      and case when v_scope = 'sector' then c.territory_id = p_territory_id
               else c.territory_id in (select t.id from public.territories t
                                       where t.kind::text = v_kind and t.id like v_prefix || '%' and not t.is_deleted)
          end
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
         and c.caught_at > now() - interval '30 days') end
  ) into v_out;
  return v_out;
end;
$function$;

-- ===== Атлас рыб: все виды города, что поймал игрок, рекорды и сезон по городу =====
create function public.get_species_atlas(p_city text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text := case when p_city = 'moscow' then 'M' else 'B' end;
  v_categories text[] := case when p_city = 'moscow' then array['peaceful', 'predator'] else array['marine', 'freshwater'] end;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  return (
    with city_catches as (
      select c.*
      from public.catches c
      join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
      where c.territory_id like v_prefix || '%'
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'key', s.key,
      'category', s.category,
      'mine', (select count(*) from city_catches c where c.species = s.key and c.user_id = v_uid),
      'first_at', (select min(c.caught_at) from city_catches c where c.species = s.key and c.user_id = v_uid),
      'best', (select jsonb_build_object('catch_id', c.id, 'length_cm', c.length_cm, 'weight_kg', c.weight_kg, 'photo_url', c.photo_url, 'caught_at', c.caught_at)
               from city_catches c where c.species = s.key and c.user_id = v_uid
               order by c.length_cm desc nulls last, c.weight_kg desc nulls last, c.caught_at desc limit 1),
      'city_count', (select count(*) from city_catches c where c.species = s.key),
      'anglers', (select count(distinct c.user_id) from city_catches c where c.species = s.key),
      'record', (select jsonb_build_object('catch_id', c.id, 'length_cm', c.length_cm, 'user_id', c.user_id, 'name', p.display_name)
                 from city_catches c join public.profiles p on p.id = c.user_id
                 where c.species = s.key and c.length_cm is not null
                 order by c.length_cm desc, c.caught_at asc limit 1),
      'months', (select jsonb_agg(coalesce(m.n, 0) order by g.m)
                 from generate_series(1, 12) g(m)
                 left join (select extract(month from c.caught_at)::int as mo, count(*)::int as n
                            from city_catches c where c.species = s.key group by 1) m on m.mo = g.m),
      'top_sectors', coalesce((select jsonb_agg(x.territory_id order by x.n desc)
                               from (select c.territory_id, count(*) as n from city_catches c where c.species = s.key
                                     group by c.territory_id order by count(*) desc limit 3) x), '[]'::jsonb)
    ) order by s.category, s.name), '[]'::jsonb)
    from public.species s
    where s.category = any (v_categories)
  );
end;
$function$;

revoke all on function public.get_sector_insights(text) from public;
revoke all on function public.get_species_atlas(text) from public, anon;
grant execute on function public.get_sector_insights(text) to anon, authenticated, service_role;
grant execute on function public.get_species_atlas(text) to authenticated, service_role;

-- Легенда видна на карточке сектора на карте без отдельного запроса: legend_id в конце
-- territories_with_stats (CREATE OR REPLACE сохраняет права; текст сверен по контрольной сумме).
-- Подзапрос встроен, а не вызов _sector_legend: функцию с SECURITY DEFINER Postgres не встраивает,
-- и 2192 отдельных вызова на каждую загрузку карты были бы заметно медленнее. Правило то же.
do $$
declare
  v_def text := pg_get_viewdef('public.territories_with_stats'::regclass, true);
begin
  if md5(v_def) <> 'dab27d335dc6bd6003aca7665ab1fd99' then
    raise exception 'territories_with_stats changed since inspection';
  end if;
  v_def := rtrim(v_def, E'; \n');
  v_def := replace(v_def, 'AS hot_until',
    'AS hot_until, ( SELECT c.user_id FROM catches c JOIN profiles lp ON lp.id = c.user_id AND NOT COALESCE(lp.is_blocked, false) WHERE c.territory_id = t.id AND c.caught_at > (now() - ''30 days''::interval) GROUP BY c.user_id HAVING count(*) >= 3 ORDER BY (count(*)) DESC, (min(c.caught_at)) LIMIT 1) AS legend_id');
  execute 'create or replace view public.territories_with_stats as ' || v_def;
end $$;
