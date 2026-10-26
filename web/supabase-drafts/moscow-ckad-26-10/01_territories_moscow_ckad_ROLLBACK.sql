-- Откат 01_territories_moscow_ckad.sql: убрать сектора M4598…M8035, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'M4598' and t.id <= 'M8035' and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
