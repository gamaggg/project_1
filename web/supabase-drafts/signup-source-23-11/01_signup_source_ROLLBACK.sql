-- Откат 01_signup_source.sql: удаляет функцию и таблицу вместе с записанными метками.
drop function if exists public.set_signup_source(text);
drop table if exists public.signup_sources;
