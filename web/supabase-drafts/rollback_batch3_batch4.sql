-- Откат пачек 3 и 4 большого обновления (если понадобится).
-- Колонка legend_id в territories_with_stats остаётся: CREATE OR REPLACE VIEW не умеет убирать
-- колонки, а DROP + CREATE потерял бы права. Она безвредна — старый клиент её не запрашивает,
-- и она не зависит от удаляемых функций.

-- пачка 4
drop function if exists public.get_city_pulse(text);
drop function if exists public.log_app_events(uuid, uuid, jsonb);
drop function if exists public.get_app_stats(integer, text);
drop table if exists public.diary_catches;
drop table if exists public.diary_days;
drop table if exists public.app_events;

-- пачка 3
drop function if exists public.get_sector_insights(text);
drop function if exists public._sector_legend(text);

-- legend_insights_fix.sql: вернуть прежнее — пересоздать _sector_legend и get_sector_insights из insights_legend.sql,
-- а в представлении заменить '90 days' → '30 days' и >= 10 → >= 3 (md5 сверить заново).
-- (md5 представления после применения сверить заново).

-- catch_conditions.sql
drop table if exists public.catch_conditions;
