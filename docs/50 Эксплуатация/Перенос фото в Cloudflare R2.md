---
tags:
  - эксплуатация
  - план
updated: 2026-11-13
---
# Перенос фото в Cloudflare R2

Решено 13.11.2026: фото уловов, дневника, аватары, фото объявлений и панорамы «Где это?» переезжают из Supabase Storage
в Cloudflare R2 и открываются с `https://photos.catchrange.com`. DNS домена catchrange.com переносится с Vercel на
Cloudflare (сайт остаётся на Vercel). Скриншоты поддержки (приватные, ~2 МБ) остаются в Supabase.

Зачем: в Supabase 1 ГБ файлов и 5 ГБ трафика в месяц, фото — почти всё это (712 МБ на 13.11, +12–14 МБ в день).
В R2 бесплатно 10 ГБ, 1 млн записей и 10 млн чтений в месяц, трафик бесплатный всегда.
Связано: [[Нагрузка на бесплатный Supabase — план]], [[Лимиты сервисов]].

## Что делает владелец (один раз)

### 1. Аккаунт и R2
1. Войти в cloudflare.com в **тот же аккаунт, где настроена капча Turnstile** (она у нас с 20.10, см. [[Защита входа (капча)]]). Узнать его: раздел **Turnstile** → виджет catchrange.com, Site Key `0x4AAA…Gl1K` (как `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Новый аккаунт не нужен.
2. Слева **R2 Object Storage** → включить R2. Cloudflare попросит привязать карту: без неё R2 не включить, но в пределах 10 ГБ денег не спишут.
3. **Create bucket** → имя `range-photos`, расположение — Automatic (или Eastern Europe, если предложит), класс Standard.

### 2. Домен catchrange.com на Cloudflare
1. В Cloudflare: **Add a domain** → `catchrange.com` → план **Free**. Cloudflare сам подтянет записи. Проверить, что есть:
   - `A  catchrange.com → 216.198.79.1` (Vercel);
   - `CNAME  www → cname.vercel-dns.com`;
   - у обеих записей облако **серое** (DNS only) — Vercel сам выдаёт сертификат, оранжевое облако ему мешает.
   Лишнее, что Cloudflare мог подтянуть (например, `*` или поддомены, которые мы не используем), — удалить.
2. Cloudflare покажет два своих адреса NS (вида `xxx.ns.cloudflare.com`).
3. В Vercel: **Domains** → `catchrange.com` → **Nameservers** → **Edit** → вписать два адреса Cloudflare → сохранить. (Домен куплен через Vercel, регистратор Name.com, поэтому меняется прямо там.)
4. Подождать, пока Cloudflare напишет «Active» (обычно от 10 минут до пары часов). Сайт всё это время работает.
5. Проверить: `https://catchrange.com` открывается, `https://catchrange.com/api/version` отвечает, бот отвечает.

### 3. Адрес для фото
1. R2 → `range-photos` → **Settings** → **Custom Domains** → **Connect Domain** → `photos.catchrange.com` → подтвердить.
2. Там же **Public Development URL (r2.dev)** — оставить выключенным.
3. **CORS policy** → Edit → вставить:
```json
[
  {
    "AllowedOrigins": ["https://catchrange.com", "http://localhost:3300"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "cache-control", "content-length"],
    "MaxAgeSeconds": 86400
  }
]
```

### 4. Ключи
1. R2 → **Manage R2 API Tokens** (или Account API Tokens) → **Create API token** → права **Object Read & Write** → только бакет `range-photos` → создать.
2. Cloudflare покажет **Access Key ID**, **Secret Access Key** и адрес вида `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Секрет показывается один раз.
3. Вписать в `web/.env.local` и в Vercel (Settings → Environment Variables, Production и Preview):
```
R2_ACCOUNT_ID=<ACCOUNT_ID из адреса>
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
R2_BUCKET=range-photos
```
4. `NEXT_PUBLIC_PHOTO_BASE_URL` пока **не добавлять**: это переключатель, его включаем в самом конце, после переноса файлов.

## Что делает Claude
1. Код за переключателем (пока `NEXT_PUBLIC_PHOTO_BASE_URL` не задан, всё работает по-старому): подпись запросов к R2 без новых пакетов; маршрут выдачи ссылок на загрузку (проверка игрока и лимитов); загрузка фото и миниатюр (160 и 480 px — R2 не уменьшает фото на лету, как Supabase); копия фото в дневник на сервере; миниатюры в лентах, картинки историй и итогов недели, кэш офлайн-режима, панорамы, ночная чистка — под новый адрес.
2. Черновик миграции: `confirm_catch` и дневник принимают фото с нового адреса; лимит загрузок (40 в час, 120 в сутки) и проверка на накрутки считают новые загрузки; откаты, прогон.
3. Скрипт переноса: все файлы из Supabase в R2 по тем же путям, миниатюры к старым фото, сверка, что каждый файл открывается по новому адресу.
4. Переключение: миграция замены адресов в базе (с откатом), `NEXT_PUBLIC_PHOTO_BASE_URL=https://photos.catchrange.com`, выкладка, проверка. Файлы в Supabase удаляются через неделю после переезда, копии остаются.

## Что сделано в Cloudflare (13.11.2026)
- Аккаунт — тот же, что у капчи (`af10c19265ae62e8742d567ab47de809`). Подписка R2 оформлена владельцем: $0 в месяц, оплата только сверх 10 ГБ / 1 млн записей / 10 млн чтений.
- Бакет `range-photos`, Eastern Europe (EEUR), Standard. S3: `https://af10c19265ae62e8742d567ab47de809.r2.cloudflarestorage.com/range-photos`. Публичный r2.dev выключен.
- CORS: PUT/GET/HEAD с `https://catchrange.com` и `http://localhost:3300`, заголовки `content-type`, `cache-control`.
- Зона catchrange.com добавлена, план Free, Bot Preference Sync выключен (не трогать robots.txt). Все 14 записей — **DNS only**, как были у Vercel: A `catchrange.com`, `www`, `*` → 216.198.79.x / 64.29.17.x (Vercel), CAA (letsencrypt, pki.goog, sectigo), CNAME `_domainconnect`, почта Resend/Amazon SES (`send` MX и SPF, `resend._domainkey`, `_dmarc`).
- Серверы имён Cloudflare: `lina.ns.cloudflare.com`, `rohin.ns.cloudflare.com`. DNSSEC у домена выключен (проверено), серверы Cloudflare уже отвечают верными записями.
- В Vercel (Domains → catchrange.com → Nameservers) серверы имён заменены на Cloudflare; реестр .com показывает Cloudflare, зона в Cloudflare **Active**, сайт и `/api/version` отвечают. Vercel по-прежнему хостит сайт (записи A указывают на него, DNS only).
- `photos.catchrange.com` подключён к бакету (Custom Domain, **Active**): несуществующий файл — 404 от R2, тестовый файл открылся с `cache-control: public, max-age=31536000, immutable` и был удалён.
- Ключ R2: Account API token «range-photos (catchrange.com)», права Object Read & Write только на `range-photos`, бессрочный. Значения вписал владелец: в `web/.env.local` (через скрипт, спрашивающий их в терминале со скрытым вводом) и в Vercel (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Secret; `R2_ACCOUNT_ID`, `R2_BUCKET` — Config; Production и Preview).
- Проверено с ключом: запись, чтение, список, загрузка по одноразовой ссылке (как приложение), копирование, удаление; CORS — `catchrange.com` и `localhost:3300` пропускаются, чужой адрес — 403.
- Период R2 — с 13-го по 13-е. Счётчики R2 на экране «Лимиты сервисов» (раздел «Cloudflare R2»): место пишет ночная чистка, операции — строки `service_limits_manual` после /limits.

## Переключение (порядок)
1. «Комит и пуш» — код с маршрутами `/api/photos/*` и пониманием адресов R2 (переключатель ещё выключен, у игроков ничего не меняется). Проверить `/api/version`.
2. «применяй» → `07_photos_on_r2.sql` (можно днём: со старым адресом всё как было).
3. Ночью: `scripts/move-photos-to-r2.mjs --apply` (докопировать то, что появилось с прошлого раза) → `--verify` должен сказать «READY».
4. «применяй» → `08_photo_urls_to_r2.sql` (адреса в базе на photos.catchrange.com).
5. В Vercel `NEXT_PUBLIC_PHOTO_BASE_URL=https://photos.catchrange.com` (Production и Preview) + выкладка (пустой коммит по команде владельца). С этого момента новые фото идут в R2.
6. Проверка: улов с фото (на телефоне — владелец), лента и миниатюры, аватар, дневник, история улова, итоги недели, «Где это?»; скрипт `--verify` ещё раз и повтор 08 (если между 4 и 5 старая версия успела загрузить фото в Supabase).
7. Тексты: политика конфиденциальности ru/en/ka («Supabase — … хранение фото, Ирландия» → фото в Cloudflare R2, Восточная Европа), строка «Место для фотографий» Supabase на экране лимитов, заметки «Лимиты сервисов», «База данных».
8. Через неделю: удалить фото из корзин Supabase (catch-photos, avatars, announcement-photos, geo-panoramas), копии оставить локально.

## Где что в коде
- `lib/photoUrl.ts` — адрес, миниатюры (`.t160.jpg`, `.t480.jpg`), переключатель `NEXT_PUBLIC_PHOTO_BASE_URL`.
- `lib/server/r2.ts` — подпись запросов S3 (SigV4) без пакетов; проверено на официальных примерах AWS.
- `app/api/photos/upload` (одноразовые ссылки на загрузку, проверка игрока и лимитов), `app/api/photos/copy-to-diary`.
- `lib/supabase/storage.ts` — загрузка в R2 при включённом переключателе; `lib/photoThumbs.ts` — миниатюры в приложении.
- `lib/supabase/imageUrl.ts` (`thumbUrl`), `lib/recap.ts`, `app/api/story/[catchId]`, `public/sw.js`, `lib/geo.ts`, `scripts/geo-import.mjs`, ночная чистка (`lib/server/orphanPhotos.ts`, `/api/cron/cleanup-photos`) — понимают R2.
- `scripts/move-photos-to-r2.mjs` — перенос файлов с миниатюрами и сверкой (`--apply`, `--verify`).
- Черновики базы: `web/supabase-drafts/db-load-13-11/07_photos_on_r2.sql` (+ откат), `08_photo_urls_to_r2.sql` (+ откат: возвращает адрес Supabase только тем фото, чей файл там ещё есть). Прогоны: 07 — с тестом пути улова (11 шагов); 08 — 1 347 уловов, 48 записей дневника, 62 аватара, 10 объявлений, после замены ни одного адреса Supabase, откат возвращает всё символ в символ, 0,7 с.
- Экран «Лимиты сервисов»: раздел «Cloudflare R2» (`lib/data/serviceLimits.ts`: `r2_storage`, `r2_class_a`, `r2_class_b`); место пишет `/api/cron/cleanup-photos` каждую ночь; команда /limits читает панель R2 (`.claude/skills/limits/SKILL.md`, шаг 3а).

## Ход работ
- 13.11.2026 — решение, карта мест, инструкция. Код за переключателем, черновик 07 с прогоном (тест пути улова, 11 шагов). Cloudflare: R2, бакет, CORS, зона. Дальше: NS в Vercel, домен photos.catchrange.com, ключи, перенос файлов, 08, переключение. Лимиты R2 — на экран «Лимиты сервисов» (просьба владельца).
- 13.11.2026 — DNS на Cloudflare, домен активен; photos.catchrange.com работает; ключ R2 вписан владельцем; доступ, CORS и загрузка по одноразовой ссылке проверены; черновик 08 с прогоном; R2 на экране лимитов и в /limits. Начато копирование всех файлов в R2 (в Supabase ничего не меняется). Не выложено и не применено: код, 07, 08, переключатель.
- 13.11.2026, 16:50 — копирование закончено, `--verify`: «READY» — 1 401 фото уловов, 98 аватаров, 10 картинок постов, 368 панорам в R2 того же размера, у каждой фотографии обе миниатюры, всё открывается с photos.catchrange.com. В бакете 4 895 файлов, 786,8 МБ: оригиналы 677,1 МБ, миниатюры 160 px — 14 МБ (≈10 КБ), 480 px — 95,6 МБ (≈65 КБ). Перед переключением докопировать то, что загрузят до него (тот же скрипт, повторно).
