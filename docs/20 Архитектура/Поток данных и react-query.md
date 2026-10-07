---
tags:
  - архитектура
aliases:
  - "react-query"
source: "DOCS.md § «Поток данных / react-query»"
updated: 2026-10-07
---
# Поток данных и react-query

`lib/supabase/queries.ts` — все хуки читают напрямую из Supabase JS SDK на клиенте (`'use client'`) и кешируются `@tanstack/react-query`. Сектора, уловы и свои уведомления обновляются сразу при изменении: канал реального времени `useRealtimeSync` (`postgres_changes` по `territories`, `catches`, `notifications` своего игрока). Поэтому данные считаются свежими 2 минуты (`staleTime` в `QueryProvider.tsx`): при возврате в приложение перезапрашивается только то, что старше. Раньше было 15 секунд, и каждый возврат из чата Telegram давал ~15 запросов — основная часть запросов к API и логов Supabase (см. CHANGELOG, «Логи Supabase»). Свои действия по-прежнему сами инвалидируют нужные ключи (например, `useConfirmCatch` — `territories`/`catches`/`activity`).
