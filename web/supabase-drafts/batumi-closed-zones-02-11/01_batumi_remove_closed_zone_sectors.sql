-- Батуми: 11 секторов в местах, где рыбачить нельзя (02.11.2026). Проверено по правилу новых
-- городов (tools/fishing-hex/build_hex_city.mjs, п. 4: центр соты в закрытой зоне OSM), выбор
-- владельца на карте tools/fishing-hex/map_batumi_pick.html:
--   Мтирала, национальный парк (OSM relation/7621483): B1930 B2025 B2072 B2073 B2118 B2119 B2120 B2166 B2213
--   Нефтетерминал Кулеви (OSM way/458091356):          B2875 B2876 (добавлены владельцем вручную 08.10.2026)
-- Остальные 62 сектора с центром в закрытой зоне (Колхети, Мачахела, базы береговой охраны) и все,
-- что задевают зону краем, владелец оставил.
-- Ни у одного нет владельца, уловов, щита, общих владений, горячих дней и легенд (проверено 02.11.2026).
-- Сектор не стирается, а помечается is_deleted = true, как делает админский «удалить».
-- Откат: 01_batumi_remove_closed_zone_sectors_ROLLBACK.sql
update public.territories
set is_deleted = true
where id in ('B1930','B2025','B2072','B2073','B2118','B2119','B2120','B2166','B2213','B2875','B2876')
  and is_deleted = false
  and owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = territories.id)
  and not exists (select 1 from public.territory_shares s where s.territory_id = territories.id);
