-- Откат 04_territories_tbilisi.sql: убрать сектора города, пока на них нет уловов и владельцев.
delete from public.territories t where t.id like 'T%' and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
