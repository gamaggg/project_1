---
tags:
  - архитектура
  - telegram
  - схема
aliases:
  - "Telegram-бот"
  - "Очереди Telegram"
source: "DOCS.md § «Отправка уведомлений в Telegram»"
updated: 2026-10-07
---
# Уведомления в Telegram

Бот **@catchrangebot**. Всё, что уходит в Telegram, сначала пишется в очередь в Postgres; `pg_cron` по расписанию дёргает маршруты `/api/telegram/*` на Vercel, они отправляют и отмечают строки. Входящие сообщения (`/start`, `/stop`, ответы поддержки) приходят в `webhook`.

```plantuml-svg
@startuml
skinparam shadowing false
skinparam roundCorner 10
skinparam defaultFontName Helvetica
skinparam defaultFontSize 13
skinparam ArrowColor #555555
skinparam BorderColor #888888
skinparam componentStyle rectangle
left to right direction

package "Postgres: очереди" {
  component "notifications" as n
  component "telegram_outbox" as o
  component "announcements" as a
  component "telegram_broadcast_queue" as bq
  component "telegram_bot_starts" as bs
  component "onboarding_messages" as om
  component "fishing_sessions" as fs
}
package "pg_cron → HTTP" {
  component "telegram-send\nкаждую минуту" as j1
  component "telegram-send-followups\n10 мин" as j3
  component "telegram-send-onboarding\n15 мин" as j4
  component "telegram-fishing\n5 мин" as j5
  component "forecast-alert-*\n19:00 по городу" as j6
}
package "Vercel: /api/telegram" {
  component "send-notifications" as r1
  component "send-broadcasts" as r2
  component "send-followups" as r3
  component "send-onboarding" as r4
  component "fishing" as r5
  component "forecast-alert" as r6
  component "webhook" as wh
}
cloud "Telegram Bot API\n@catchrangebot" as tg

n --> o : триггер\nqueue_telegram_notification
a --> bq : рассылка объявления
j1 --> r1
j1 --> r2
j3 --> r3
j4 --> r4
j5 --> r5
j6 --> r6
o <.. r1
bq <.. r2
bs <.. r3
om <.. r4
fs <.. r5
r1 --> tg
r2 --> tg
r3 --> tg
r4 --> tg
r5 --> tg
r6 --> tg
tg --> wh : /start, /stop,\nответы поддержки
@enduml
```

- Очереди `telegram_outbox` (уведомления) и `telegram_broadcast_queue` (рассылка объявлений) разбирают маршруты Vercel `app/api/telegram/send-notifications` и `send-broadcasts`.
- **Отправка уведомлений без дублей (с 03.11.2026).** `send-notifications` перед отправкой каждой строки «занимает» её: двигает `deliver_after` на 3 минуты вперёд условным `update` (строка ещё не отправлена и уже пора), и запуск, который не получил строку, её пропускает. Раньше выборка не была замком: пока один запуск ждал медленный Telegram, запуск следующей минуты брал ту же строку и отправлял снова (03.11 игроку пришло девять копий «забрал твой сектор»). Запрос к Telegram ограничен 15 секундами. Не пришёл ответ в срок или пришёл 504: Telegram мог принять сообщение, потеря только ответа, поэтому повтора нет, строка закрывается с пометкой «not retried, may have been delivered» в `last_error`. Прочие ошибки (502, 5xx) повторяются до трёх раз с паузой 3 минуты, 429 и 403 как раньше. `send-broadcasts` так не защищён (см. журнал 03.11).
- Их зовёт одна задача pg_cron `telegram-send` раз в минуту, и каждый маршрут только если в его очереди есть что отправлять (`where exists (…)` с теми же условиями, что в маршруте). Пустые минуты не тратят ни запросов к Supabase, ни вызовов Vercel.
- Прежние задачи `telegram-send-notifications` и `telegram-send-broadcasts` выключены (`active = false`), но не удалены. Откат: `select cron.unschedule('telegram-send')` и включить их обратно через `cron.alter_job(…, active := true)`. `telegram-send-followups` (раз в 10 минут) работает как раньше.
- В командах задач лежит секретный заголовок `CRON_SECRET`. Целиком их не выводить: при просмотре маскировать `Bearer …`.
- **Включены по умолчанию.** Бот может писать только тем, кто нажимал /start. Им уведомления включаются сами, если игрок ни разу не выбирал: триггер `profiles_tg_default_on` срабатывает, когда к аккаунту привязывается Telegram с /start, а `telegram_bot_starts_default_on` — когда привязанный игрок впервые нажимает /start. Время включения пишется в `profiles.tg_auto_enabled_at`.
- **Выбор игрока главнее.** Переключатель в профиле (`set_telegram_notifications`), команда `/stop` в боте и «Подключить уведомления» из профиля пишут `tg_choice_at`. После этого уведомления сами больше не включаются, в том числе при новой привязке Telegram. Заблокировавшим бота (`tg_unreachable_at`) не включаются никогда.
- **Первое сообщение объясняет.** Включённому по умолчанию первое уведомление приходит с припиской «Выключить — команда /stop или «Уведомления в Telegram» в профиле» (`send-notifications`), после чего ставится `tg_auto_notice_at`.
- **Улов друга — одно сообщение на серию.** `queue_telegram_notification` не ставит в очередь `follow_catch`, если от того же рыбака тому же игроку уже было такое уведомление за последние 3 часа (тот же разрыв, что у серий в ленте). В «Активности» каждый улов по-прежнему отдельно.
- `/stop` выключает только уведомления из игры. Объявления супер-админа (`admin_post_announcement`) уходят всем, кто нажимал /start.
- **«Тебя обогнали в рейтинге недели» (с 02.11.2026, `rating_overtaken`).** Задача pg_cron `rating-tick` (`3-59/10 * * * *`) зовёт `rating_tick(город)` для пяти городов. Функция считает рейтинг недели города так же, как `get_weekly_leaderboard` (сектора за неделю, потом уловы, потом более старый аккаунт; все, у кого есть хоть что-то за неделю), и сравнивает с прошлым подсчётом в `rating_places` (город, неделя, игрок, место, `notified_at`). Уведомление получает тот, кто был в первой десятке, опустился ниже, это его город в профиле, он не заблокирован и ему не писали об этом 3 часа. `actor_id` — кто теперь стоит прямо над ним (имя и аватар в «Активности», «впереди …» в Telegram). Первый подсчёт недели (понедельник) ни с чем не сравнивается и молчит; недели старше двух удаляются. Кнопка в Telegram — «Открыть рейтинг» (`?rating=1`, рейтинг недели города профиля). Миграция и откат: `web/supabase-drafts/rating-overtaken-02-11/`.

## См. также
- [[Фоновые задачи (pg_cron)]]
- [[API-маршруты]]
- [[Авторизация]]
