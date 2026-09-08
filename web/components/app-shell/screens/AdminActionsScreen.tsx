'use client'

import type { ReactNode } from 'react'
import { useAdminActions } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'
import type { AdminAction } from '@/lib/data/types'

// `details` is a free-text sentence assembled server-side (see the admin_*
// RPCs in DECISIONS.md) that happens to embed the territory id and/or target
// user's display name verbatim — find those known substrings and swap them
// for clickable buttons instead of re-deriving the sentence client-side.
function linkifyDetails(
  a: AdminAction,
  onOpenTerritory: (id: string) => void,
  onOpenUser: (id: string) => void
): ReactNode {
  const spans: { index: number; length: number; node: ReactNode }[] = []
  if (a.territoryId) {
    const idx = a.details.indexOf(a.territoryId)
    if (idx !== -1) {
      spans.push({
        index: idx,
        length: a.territoryId.length,
        node: (
          <button key="territory" className="activity-who-btn" onClick={() => onOpenTerritory(a.territoryId!)}>
            {a.territoryId}
          </button>
        ),
      })
    }
  }
  if (a.targetUserId && a.targetUserName) {
    const idx = a.details.indexOf(a.targetUserName)
    if (idx !== -1) {
      spans.push({
        index: idx,
        length: a.targetUserName.length,
        node: (
          <button key="user" className="activity-who-btn" onClick={() => onOpenUser(a.targetUserId!)}>
            {a.targetUserName}
          </button>
        ),
      })
    }
  }
  spans.sort((x, y) => x.index - y.index)
  const parts: ReactNode[] = []
  let cursor = 0
  spans.forEach((s) => {
    if (s.index > cursor) parts.push(a.details.slice(cursor, s.index))
    parts.push(s.node)
    cursor = s.index + s.length
  })
  if (cursor < a.details.length) parts.push(a.details.slice(cursor))
  return parts
}

// "Последние действия" — full unfiltered log of every admin action. See
// AdminAccessScreen for "Доступы" (a live list, not a log).
export function AdminActionsScreen({
  title,
  onBack,
  onOpenUser,
  onOpenTerritory,
}: {
  title: string
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
}) {
  const { data: actions = [], isLoading } = useAdminActions()

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {isLoading ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : actions.length ? (
          actions.map((a) => (
            <div key={a.id} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.adminName}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 3 }}>{linkifyDetails(a, onOpenTerritory, onOpenUser)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>{formatWhen(a.createdAt)}</div>
            </div>
          ))
        ) : (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока пусто</div>
        )}
      </div>
    </>
  )
}
