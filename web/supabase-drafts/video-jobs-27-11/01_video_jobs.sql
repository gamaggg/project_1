-- Задания на монтаж роликов из видео владельца (27.11.2026). План: docs/10 Продукт/Монтаж роликов (Reels).md
-- Владелец присылает видео SMM-боту, бот кладёт файл в корзину social-videos и создаёт строку здесь (status 'new').
-- Монтаж делается на Mac владельца (tools/reels-lab): готовый ролик загружается в ту же корзину, строка получает
-- result_path и caption_out (status 'ready'), бот присылает ролик с описанием и кнопками «Всё ок / Изменить».
-- Клиентам таблица закрыта: читает и пишет только серверный маршрут (сервисная роль) и администратор проекта.
set local lock_timeout = '3s';

create table if not exists public.video_jobs (
  id             bigint generated always as identity primary key,
  chat_id        bigint not null,
  src_path       text   not null,                                 -- путь исходника в корзине social-videos
  caption_in     text   not null default '',                      -- заметки владельца: рыба, вес, место
  status         text   not null default 'new'
                 check (status in ('new','working','ready','changes','done','failed')),
  result_path    text,                                            -- путь готового ролика в корзине
  caption_out    text,                                            -- описание с хэштегами для Instagram и др.
  feedback       text,                                            -- что владелец просит поменять
  token          text   not null,                                 -- для получения ссылки загрузки результата
  sent_at        timestamptz,                                     -- когда готовый ролик отправлен владельцу
  bot_message_id bigint,                                          -- сообщение с кнопками «Всё ок / Изменить»
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.video_jobs enable row level security;
revoke all on table public.video_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.video_jobs to service_role;

-- Корзина для видео: чтение по прямой ссылке (имена случайные, Telegram и Mac забирают файл по ссылке),
-- запись только с сервера (сервисная роль) и по одноразовой подписанной ссылке.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-videos', 'social-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
