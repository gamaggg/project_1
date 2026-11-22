-- Откат 02_territories_yerevan.sql: убрать сектора E0001…E1700, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'E0001' and t.id <= 'E1700' and length(t.id) = 5 and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
