-- Бот согласования публикаций в соцсетях (23.11.2026). План: docs/10 Продукт/Продвижение в соцсетях.md
-- Одна строка = одна публикация (одно видео или пост может уйти на несколько площадок сразу).
-- Строки готовит Claude; бот за час до выхода шлёт превью владельцу с кнопками «Принять / Изменить / Отменить».
-- Без «Принять» пост не выходит. Клиентам таблица закрыта: работают только серверные маршруты (сервисная роль).
set local lock_timeout = '3s';

create table if not exists public.social_posts (
  id               bigint generated always as identity primary key,
  platforms        text[] not null check (
                     cardinality(platforms) > 0
                     and platforms <@ array['tiktok','instagram','instagram_story','threads','youtube','facebook']),
  kind             text not null default 'post' check (kind in ('reel','post','story','carousel','quiz')),
  scheduled_at     timestamptz not null,
  -- draft: готов, превью ещё не ушло · sent: превью у владельца · approved: принят · changes: просит правку ·
  -- cancelled: отменён · expired: время вышло без ответа · reminded: пора выкладывать вручную ·
  -- published: вышел · failed: не вышел из-за ошибки
  status           text not null default 'draft' check (status in
                     ('draft','sent','approved','changes','cancelled','expired','reminded','published','failed')),
  body             text not null default '',
  -- Текст для отдельной площадки, если он не такой, как body (Facebook — на грузинском): {"facebook": "…"}
  captions         jsonb not null default '{}'::jsonb check (jsonb_typeof(captions) = 'object'),
  -- [{"type": "photo"|"video", "url": "https://…"}]
  media            jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  feedback         text,
  tg_message_id    bigint,
  preview_sent_at  timestamptz,
  decided_at       timestamptz,
  published_at     timestamptz,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists social_posts_due on public.social_posts (scheduled_at) where status in ('draft','sent','approved');

alter table public.social_posts enable row level security;
revoke all on table public.social_posts from public, anon, authenticated;
grant select, insert, update, delete on table public.social_posts to service_role;

-- Раз в 5 минут дёргать /api/social-bot/tick, но только когда есть работа (или раз в час — проверить вебхук бота).
-- Команда собирается из уже работающей задачи telegram-fishing: тот же адрес сайта и тот же заголовок
-- с секретом, только другой путь и условие. Секрет в миграцию не переписывается руками.
select cron.schedule(
  'social-bot-tick',
  '*/5 * * * *',
  replace(
    replace((select command from cron.job where jobname = 'telegram-fishing'), '/api/telegram/fishing', '/api/social-bot/tick'),
    E'\n  );',
    E'\n  )\n  where extract(minute from now())::int < 5 or exists (select 1 from public.social_posts p\n    where (p.status = ''draft'' and p.scheduled_at <= now() + interval ''60 minutes'')\n       or (p.status in (''sent'', ''approved'') and p.scheduled_at <= now()));'
  )
);
