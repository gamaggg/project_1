---
tags:
  - архитектура
aliases:
  - "API"
  - "/api"
updated: 2026-10-07
---
# API-маршруты

Серверные маршруты Next.js на Vercel (`web/app/api/**/route.ts`). Всё остальное клиент делает напрямую в Supabase (select и RPC под RLS).

| Маршрут | Кто вызывает | Что делает |
|---|---|---|
| `/api/auth/telegram` | Mini App при запуске | проверяет `initData`, выдаёт токен входа ([[Авторизация]]) |
| `/api/auth/telegram/link` | Mini App, вошедший по email | привязывает Telegram к аккаунту |
| `/api/auth/complete-email-link` | смена email | завершает подтверждение нового адреса |
| `/api/telegram/link-token` | профиль → «Подключить Telegram» | ссылка `t.me/<бот>?start=link_…` |
| `/api/telegram/webhook` | Telegram | `/start`, `/stop`, ответы поддержки, кнопки |
| `/api/telegram/send-notifications` | pg_cron `telegram-send` | отправляет `telegram_outbox` |
| `/api/telegram/send-broadcasts` | pg_cron `telegram-send` | рассылки объявлений |
| `/api/telegram/send-followups` | pg_cron, 10 мин | инфографика после `/start` |
| `/api/telegram/send-onboarding` | pg_cron, 15 мин | напоминания до первого улова |
| `/api/telegram/fishing` | pg_cron, 5 мин | «Ещё на рыбалке?» |
| `/api/telegram/forecast-alert` | pg_cron, 19:00 | «Завтра хороший клёв» ([[Прогноз клёва]]) |
| `/api/support/notify` | новое обращение в поддержку | пересылает супер-админам в бота |
| `/api/recognize-fish` | экран подтверждения улова | прокси к Fishial: вид рыбы по фото |
| `/api/catch-conditions` | карточка улова | погода в час улова из Open-Meteo, кэш в `catch_conditions` |
| `/api/version` | открытое приложение | версия деплоя, по ней старая вкладка перезагружается |

Маршруты, которые дёргает `pg_cron`, требуют `Authorization: Bearer <CRON_SECRET>` ([[Фоновые задачи (pg_cron)]]).
