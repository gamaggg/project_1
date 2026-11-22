-- Откат 02_territories_kazan.sql: убрать сектора K0001…K2458, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'K0001' and t.id <= 'K2458' and length(t.id) = 5 and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
