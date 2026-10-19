-- Москва: 19 секторов, которые не проходят новые правила построения секторов (19.10.2026):
-- «река» под землёй или водоём не по берегу / слишком мелкий. Проверено по OSM скриптом
-- tools/fishing-hex/build_hex_city.mjs moscow_check: из 814 секторов первой генерации
-- не прошли 27, из них 8 владелец уже удалил вручную (admin_actions: delete_territory),
-- остальные 19 здесь. Ни у одного нет владельца, уловов, общих владений, горячих
-- секторов, записей в ленте и уведомлений (проверено 19.10.2026).
-- Сектор не стирается, а помечается is_deleted = true — как делает админский «удалить»:
-- приложение скрывает его на карте (queries.ts фильтрует по is_deleted).
-- Откат: 00_moscow_remove_hidden_sectors_ROLLBACK.sql
update public.territories
set is_deleted = true
where id in ('M0567','M0622','M0753','M0767','M0835','M1098','M1232','M1670','M1783','M1784',
             'M1932','M2194','M2213','M2506','M2564','M3242','M3362','M3373','M3427')
  and is_deleted = false
  and owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = territories.id)
  and not exists (select 1 from public.territory_shares s where s.territory_id = territories.id);
