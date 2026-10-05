-- Легенда сектора: окно 90 дней вместо 30 (решение пользователя 05.10).
-- Меняются три места, и все — объекты пачки 3, которые прод ещё не вызывает:
--   _sector_legend, my_count в get_sector_insights («у тебя здесь N уловов» — то же окно),
--   legend_id в territories_with_stats. «Что клюёт здесь» остаётся за 30 дней.

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
  having count(*) >= 3
  order by count(*) desc, min(c.caught_at) asc
  limit 1;
$function$;

do $$
declare
  v_fn text := pg_get_functiondef('public.get_sector_insights(text)'::regprocedure);
  v_old text := 'and c.caught_at > now() - interval ''30 days'') end';
  v_view text := pg_get_viewdef('public.territories_with_stats'::regclass, true);
begin
  if (length(v_fn) - length(replace(v_fn, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'get_sector_insights changed since inspection';
  end if;
  execute replace(v_fn, v_old, 'and c.caught_at > now() - interval ''90 days'') end');

  if md5(v_view) <> '834f8cc9f0e67664492de0bc8b314a71' then
    raise exception 'territories_with_stats changed since inspection';
  end if;
  v_view := rtrim(v_view, E'; \n');
  execute 'create or replace view public.territories_with_stats as ' || replace(v_view, '''30 days''::interval', '''90 days''::interval');
end $$;
