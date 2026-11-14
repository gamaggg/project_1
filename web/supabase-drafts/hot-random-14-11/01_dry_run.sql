-- Прогон без последствий: новая функция + 30 выборов на каждый город, в конце исключение,
-- всё откатывается. Перед выбором текущие горячие сектора «заканчиваются» (ends_at в прошлое),
-- чтобы функция работала, а правило «не две недели подряд» их по-прежнему исключало.
-- Сюда вставляется create or replace из 01_pick_hot_random.sql (без строки schema_migrations).
do $t$
declare
  c text;
  i int;
  v_pop text;
  v_nb text;
  v_cnt int;
  v_km numeric;
  v_maxkm numeric;
  v_pops text[];
  v_bad int;
  v_none int;
  v_nonb int;
  v_freenb int;
  v_out text := '';
begin
  update public.hot_sectors set ends_at = now() - interval '1 second' where ends_at > now();
  for c in select id from public.city_config order by id loop
    v_pops := '{}'; v_bad := 0; v_none := 0; v_nonb := 0; v_freenb := 0; v_maxkm := 0;
    for i in 1..30 loop
      perform public.pick_hot_sectors(c);
      v_pop := null; v_nb := null;
      select territory_id into v_pop from public.hot_sectors where city = c and starts_at = now() and kind = 'popular';
      select territory_id into v_nb from public.hot_sectors where city = c and starts_at = now() and kind = 'neighbor';
      if v_pop is null then
        v_none := v_none + 1;
      else
        v_pops := array_append(v_pops, v_pop);
        select count(*) into v_cnt from public.catches where territory_id = v_pop and caught_at > now() - interval '30 days';
        if v_cnt < 5 then v_bad := v_bad + 1; end if;
        if v_nb is null then
          v_nonb := v_nonb + 1;
        else
          select sqrt(power((f.lat - p.lat) * 111.0, 2) + power((f.lng - p.lng) * 111.0 * cos(radians(p.lat)), 2))
            into v_km
          from public.territories f, public.territories p where f.id = v_nb and p.id = v_pop;
          v_maxkm := greatest(v_maxkm, v_km);
          if (select owner_id is null from public.territories where id = v_nb) then v_freenb := v_freenb + 1; end if;
        end if;
      end if;
      delete from public.hot_sectors where city = c and starts_at = now();
    end loop;
    v_out := v_out || format('%s: без горячих=%s, разных первых=%s, первых с <5 уловами=%s, без соседа=%s, сосед свободный=%s, сосед дальше всего км=%s; ',
      c, v_none, (select count(distinct x) from unnest(v_pops) x), v_bad, v_nonb, v_freenb, round(v_maxkm, 2));
  end loop;
  raise exception 'DRY RUN: %', v_out;
end $t$;
