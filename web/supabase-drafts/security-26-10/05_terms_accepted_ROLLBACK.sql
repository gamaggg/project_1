-- Откат 05_terms_accepted.sql (записанные даты пропадут).
set local lock_timeout = '10s';
lock table public.profiles_with_stats in access exclusive mode;
drop trigger if exists profiles_stamp_terms on public.profiles;
drop function if exists public._stamp_terms_accepted();
alter table public.profiles drop column if exists terms_accepted_at, drop column if exists terms_version;
