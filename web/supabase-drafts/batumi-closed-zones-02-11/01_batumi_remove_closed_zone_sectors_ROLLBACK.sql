-- Откат 01_batumi_remove_closed_zone_sectors.sql: вернуть эти 11 секторов Батуми на карту.
update public.territories
set is_deleted = false
where id in ('B1930','B2025','B2072','B2073','B2118','B2119','B2120','B2166','B2213','B2875','B2876');
