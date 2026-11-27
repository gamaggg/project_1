-- Откат: вернуть только 'threads'. Строку tiktok сначала удалить, иначе ограничение не встанет.
set local lock_timeout = '3s';

delete from public.social_tokens where name = 'tiktok';
alter table public.social_tokens drop constraint if exists social_tokens_name_check;
alter table public.social_tokens add constraint social_tokens_name_check check (name in ('threads'));
