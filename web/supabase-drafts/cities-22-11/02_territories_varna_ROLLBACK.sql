-- Откат 02_territories_varna.sql: убрать сектора V0001…V1458, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'V0001' and t.id <= 'V1458' and length(t.id) = 5 and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
