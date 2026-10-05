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
