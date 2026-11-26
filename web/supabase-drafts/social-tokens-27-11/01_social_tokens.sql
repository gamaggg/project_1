-- Токены соцсетей, которые обновляются сами (27.11.2026). План: docs/10 Продукт/Продвижение в соцсетях.md
-- Сейчас там только токен Threads (живёт 60 дней): бот раз в час проверяет срок и, когда осталось меньше
-- 30 дней, получает новый токен по старому и записывает сюда. До первого обновления используется токен из Vercel.
-- Клиентам таблица закрыта: читает и пишет только серверный маршрут (сервисная роль).
set local lock_timeout = '3s';

create table if not exists public.social_tokens (
  name         text primary key check (name in ('threads')),
  token        text not null check (length(token) > 20),
  expires_at   timestamptz not null,
  refreshed_at timestamptz not null default now()
);

alter table public.social_tokens enable row level security;
revoke all on table public.social_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.social_tokens to service_role;
