-- Горячие сектора (14.11.2026): первый сектор теперь не «самый популярный», а случайный
-- из тех, где за 30 дней 5 и больше уловов. Второй, как и раньше, — сосед первого
-- (центр ближе 800 м, свободный в приоритете). Если в городе нет ни одного сектора
-- с 5+ уловами за 30 дней, горячих секторов на этой неделе там нет.
-- Остальное без изменений: не бывает горячим две недели подряд (8 дней), конец —
-- воскресенье 23:59:59 по городу. Откат: 01_pick_hot_random_ROLLBACK.sql.
create or replace function public.pick_hot_sectors(p_city text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tz text := public._city_tz(p_city);
  v_prefix text := public._city_prefix(p_city);
  v_local_now timestamp := now() at time zone v_tz;
  v_ends timestamptz;
  v_popular text;
  v_neighbor text;
  v_n int := 0;
begin
  if exists (select 1 from public.hot_sectors where city = p_city and ends_at > now()) then
    return 0;
  end if;
  -- Sunday 23:59:59 of this week, local time — or of next week when less than a day is left.
  v_ends := ((date_trunc('week', v_local_now) + interval '7 days' - interval '1 second') at time zone v_tz);
  if v_ends - now() < interval '1 day' then
    v_ends := v_ends + interval '7 days';
  end if;

  -- A random sector among those with 5+ catches in 30 days.
  select x.id into v_popular
  from (
    select t.id
    from public.territories t
    join public.catches c on c.territory_id = t.id and c.caught_at > now() - interval '30 days'
    where t.id like v_prefix || '%' and not t.is_deleted
      and not exists (select 1 from public.hot_sectors h where h.territory_id = t.id and h.ends_at > now() - interval '8 days')
    group by t.id
    having count(*) >= 5
  ) x
  order by random()
  limit 1;

  if v_popular is not null then
    insert into public.hot_sectors (territory_id, city, kind, starts_at, ends_at) values (v_popular, p_city, 'popular', now(), v_ends);
    v_n := v_n + 1;
  end if;

  -- The second one touches the first: hex centres of neighbours are 600 m apart and
  -- the next ring is over 1 km away, so «under 800 m» is exactly the six around it.
  -- A free neighbour if there is one (something to take), otherwise any.
  if v_popular is not null then
    select f.id into v_neighbor
    from public.territories f
    join public.territories p on p.id = v_popular
    where f.id like v_prefix || '%' and not f.is_deleted and f.id <> p.id
      and sqrt(power((f.lat - p.lat) * 111.0, 2) + power((f.lng - p.lng) * 111.0 * cos(radians(p.lat)), 2)) < 0.8
      and not exists (select 1 from public.hot_sectors h where h.territory_id = f.id and h.ends_at > now() - interval '8 days')
    order by (f.owner_id is null) desc, random()
    limit 1;
  end if;

  if v_neighbor is not null then
    insert into public.hot_sectors (territory_id, city, kind, starts_at, ends_at) values (v_neighbor, p_city, 'neighbor', now(), v_ends);
    v_n := v_n + 1;
  end if;
  return v_n;
end;
$function$;

insert into supabase_migrations.schema_migrations (version, name, statements)
values (to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS'), 'hot_sectors_random_5plus', array[current_query()]);
