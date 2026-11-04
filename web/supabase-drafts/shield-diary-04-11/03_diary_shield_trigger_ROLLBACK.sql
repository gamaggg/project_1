-- Откат 03_diary_shield_trigger.sql: триггер и функция убираются, записи дневника остаются как есть.
drop trigger if exists diary_shield_catch on public.diary_catches;
drop function if exists public._diary_shield_catch_to_catches();
