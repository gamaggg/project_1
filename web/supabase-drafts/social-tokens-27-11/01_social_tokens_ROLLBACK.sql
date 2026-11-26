-- Откат 01_social_tokens.sql: удаляет таблицу вместе с сохранённым токеном.
-- После отката бот снова берёт токен Threads из Vercel (THREADS_ACCESS_TOKEN), он живёт до 24.01.2027.
drop table if exists public.social_tokens;
