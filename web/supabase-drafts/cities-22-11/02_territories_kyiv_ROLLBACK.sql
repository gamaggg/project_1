-- Откат 02_territories_kyiv.sql: убрать сектора Y0001…Y3057, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'Y0001' and t.id <= 'Y3057' and length(t.id) = 5 and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
