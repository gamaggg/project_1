'use client'

import { useAdminActions } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'

// Shared by "Доступы" (actionTypes: grant/revoke_admin) and "Последние
// действия" (no filter) — same list shape, only the query filter differs.
export function AdminActionsScreen({
  title,
  actionTypes,
  onBack,
}: {
  title: string
  actionTypes?: string[]
  onBack: () => void
}) {
  const { data: actions = [], isLoading } = useAdminActions(actionTypes)

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
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 3 }}>{a.details}</div>
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
