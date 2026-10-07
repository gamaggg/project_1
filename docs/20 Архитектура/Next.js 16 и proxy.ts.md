---
tags:
  - архитектура
aliases:
  - "proxy.ts"
  - "middleware"
source: "DOCS.md § «Next.js 16: `proxy.ts`, не `middleware.ts` — и почему его здесь нет»"
updated: 2026-10-07
---
# Next.js 16 и proxy.ts

В Next.js 16 файл-конвенция `middleware.ts` переименована в `proxy.ts` (экспорт функции `proxy` вместо `middleware`), механика (cookies, `NextResponse`, matcher) не изменилась. Это узнали из `node_modules/next/dist/docs/` (версия в проекте новее тренировочных данных модели — см. `AGENTS.md`, который Next.js сам кладёт в свежий проект и просит свериться с локальными доксами перед тем как писать код).

Самого файла в проекте больше нет: стандартный для Supabase SSR middleware, обновляющий сессию на каждом запросе, выбивал пользователей из аккаунта — см. [[Указатель решений|DECISIONS.md]], «`proxy.ts` удалён». Не возвращать.
