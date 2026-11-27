-- Токен TikTok в таблице social_tokens (27.11.2026). Там лежит токен обновления (живёт год, меняется при каждом использовании).
-- Таблица та же, что для Threads (черновик social-tokens-27-11): разрешаем в ней вторую строку, name = 'tiktok'.
set local lock_timeout = '3s';

alter table public.social_tokens drop constraint if exists social_tokens_name_check;
alter table public.social_tokens add constraint social_tokens_name_check check (name in ('threads', 'tiktok'));
