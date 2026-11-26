---
tags:
  - функции
  - seo
updated: 2026-11-27
---
# SEO и индексация

Как сайт catchrange.com виден поисковикам и что проверять. Проверка 27.11.2026 описана в [[Журнал изменений]].

## Что индексируется
- **Главная `/`** (`app/(app)/page.tsx`): само приложение, рисуется в браузере. С сервера приходят title, description, canonical, превью, микроразметка WebSite + Organization и скрытая навигация (`.sr-only`) на лендинг и политику, чтобы поисковик нашёл их по ссылкам. H1 появляется после загрузки JS (экран приветствия «Лови Занимай Владей»).
- **Лендинг `/about`, `/about/en`, `/about/ka`**: серверная страница, это и есть то, что ищется. hreflang на три языка, микроразметка SoftwareApplication + FAQPage. Тексты в `lib/data/landing.{ru,en,ka}.ts`.
- **Политика `/privacy`, `/privacy/en`, `/privacy/ka`**.
- **Не индексируются намеренно**: `/partners/*` (страницы для магазинов, ссылку дают лично; `noindex, nofollow` в `app/(app)/partners/PartnersView.tsx`, решение владельца 27.11.2026), `/api/` (закрыт в robots), превью-страницы (`*-preview`, в продакшене 404).

## Где что лежит
- Домен для canonical, sitemap, robots, превью: `SITE_URL` в `web/lib/site.ts`. Абсолютный, поэтому localhost в продакшен не попадает.
- `web/app/robots.ts`, `web/app/sitemap.ts` (без lastmod: дата запроса вводила бы Google в заблуждение).
- Картинка превью: `web/app/opengraph-image.jpg` и `twitter-image.jpg` (1200×630, ~170 КБ) с подписью в `*.alt.txt`. Страницы, где свой `openGraph`/`twitter` (лендинг, партнёры), указывают её явно через `OG_IMAGE` из `lib/site.ts`: иначе Next.js её не подставляет.
- Коды Search Console и Яндекс Вебмастера: `verification` в `web/app/layout.tsx` (подключены 26.10.2026).

## Лёгкие страницы
- Корневой `app/layout.tsx` даёт только html, шрифты, метаданные, скрипт Telegram, аналитику и `app/base.css` (цвета и базовые правила).
- Всё приложение (провайдеры, `globals.css` и остальные стили) подключает `app/(app)/layout.tsx`. В группе `(app)` лежат главная, `/partners/*` и превью-страницы. `/about` и `/privacy` вне её: около 177 КБ JS и 30 КБ CSS.
- Новую страницу для поиска класть вне `(app)`, если ей не нужно приложение.

## Число городов
- Лендинг берёт названия городов из словаря по `CityId` (`lib/data/landing.{ru,en,ka}.ts`), число и списки считаются сами; без названия нового города сборка не пройдёт. Описание главной: `CITIES_RU_SUMMARY`.
- Внутриигровой FAQ (`lib/data/faq*.ts`) при новом городе правят руками.

## Хостинг и доступ для Googlebot
- DNS в Cloudflare, но только DNS: A-записи ведут прямо в Vercel, прокси выключен. WAF, «Under Attack» и боты Cloudflare трафик не трогают. Если когда-нибудь включить оранжевое облако, проверить, что Googlebot не получает проверку.
- HTTPS принудительный (Vercel: http → https 308, HSTS 2 года).
- `www.catchrange.com` → `catchrange.com`: 308, настроено в Vercel → Domains (27.11.2026).
- `*.vercel.app` (в том числе старый `web-flame-mu-44.vercel.app`) → `catchrange.com`: 308 из `next.config.ts` (`redirects`), только в продакшен-сборке и кроме `/api/`.

## Как проверить
- Сервер глазами Googlebot: `curl -A 'Googlebot/2.1' https://catchrange.com/about` и смотреть `<title>`, `robots`, `canonical`, `og:image`, H1.
- Скорость: pagespeed.web.dev (у общего API бывает исчерпана дневная квота).
- Индексация и ошибки: Google Search Console и Яндекс Вебмастер (владелец).
