-- Откат 02_territories_odesa.sql: убрать сектора O0001…O1236, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'O0001' and t.id <= 'O1236' and length(t.id) = 5 and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
