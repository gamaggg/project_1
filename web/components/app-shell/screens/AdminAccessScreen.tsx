'use client'

import { useCurrentAdmins } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'

// Unlike AdminActionsScreen (an append-only log of every action), this is a
// live view of who currently holds admin access — revoking someone (via
// AdminPermissionsModal, opened per-row) drops them from this list
// immediately instead of leaving a "revoked" row.
export function AdminAccessScreen({
  onBack,
  onOpenUser,
  onEditAccess,
}: {
  onBack: () => void
  onOpenUser: (id: string) => void
  onEditAccess: (id: string) => void
}) {
  const { data: admins = [], isLoading } = useCurrentAdmins()

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Доступы</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {isLoading ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : admins.length ? (
          admins.map((a) => (
            <div key={a.id} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.displayName}</div>
              {a.grantedAt && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>Доступ выдан {formatWhen(a.grantedAt)}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onOpenUser(a.id)}>
                  Профиль
                </button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onEditAccess(a.id)}>
                  Права доступа
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Нет админов с доступом</div>
        )}
      </div>
    </>
  )
}
