-- Откат 02_territories_anapa.sql: убрать сектора A0001…A0249, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'A0001' and t.id <= 'A0249' and length(t.id) = 5 and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
