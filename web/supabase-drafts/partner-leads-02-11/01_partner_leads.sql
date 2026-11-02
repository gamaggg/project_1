-- Заявки со страницы для бизнеса (/partners/*): форма пишет заявку в базу через маршрут /api/partner-lead
-- (ключ сервера), а не только открывает Telegram: заявка не теряется, если человек не нажал «Отправить» в Telegram.
-- Таблица закрыта от anon и authenticated целиком (RLS включена, политик нет, прав нет): читает и пишет только service_role.
-- Откат: 01_partner_leads_ROLLBACK.sql.

create table public.partner_leads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  city text not null check (city in ('batumi', 'moscow')),
  lang text not null check (lang in ('ru', 'en', 'ka')),
  name text not null check (char_length(name) between 1 and 120),
  contact text not null check (char_length(contact) between 1 and 160),
  interest text[] not null default '{}',
  comment text check (comment is null or char_length(comment) <= 1000),
  -- Хеш адреса за сутки (не сам адрес): для ограничения частоты, повторно по нему человека не найти.
  ip_hash text,
  -- Когда заявку переслали в Telegram владельцу; пусто, если пересылка не удалась.
  notified_at timestamptz
);

create index partner_leads_created_idx on public.partner_leads (created_at desc);
create index partner_leads_ip_idx on public.partner_leads (ip_hash, created_at desc);

alter table public.partner_leads enable row level security;
revoke all on public.partner_leads from anon, authenticated;
grant select, insert, update on public.partner_leads to service_role;
