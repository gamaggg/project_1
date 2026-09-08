'use client'

import { useReports, useAdminDeleteCatch, useDismissReport } from '@/lib/supabase/queries'

export function AdminReportsScreen({
  onBack,
  onOpenPhoto,
  onOpenUser,
  onOpenTerritory,
}: {
  onBack: () => void
  onOpenPhoto: (src: string) => void
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
}) {
  const { data: reports = [], isLoading } = useReports()
  const deleteCatch = useAdminDeleteCatch()
  const dismissReport = useDismissReport()

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Жалобы на фото</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {isLoading ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : reports.length ? (
          reports.map((r) => (
            <div key={r.id} className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 12 }}>
              <div className="fish-thumb" style={{ width: 56, height: 56, cursor: 'pointer', flex: '0 0 auto' }} onClick={() => onOpenPhoto(r.photoUrl)}>
                <img src={r.photoUrl} alt={r.speciesName ?? ''} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.reason}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  <button className="activity-who-btn" onClick={() => onOpenTerritory(r.territoryId)}>
                    Территория {r.territoryId}
                  </button>
                  {r.speciesName ? ` · ${r.speciesName}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                  Пожаловался:{' '}
                  <button className="activity-who-btn" onClick={() => onOpenUser(r.reporterId)}>
                    {r.reporterName}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, padding: '9px 0', fontSize: 13 }}
                    disabled={deleteCatch.isPending}
                    onClick={() => deleteCatch.mutate(r.catchId)}
                  >
                    Удалить улов
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, padding: '9px 0', fontSize: 13 }}
                    disabled={dismissReport.isPending}
                    onClick={() => dismissReport.mutate(r.id)}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Жалоб нет</div>
        )}
      </div>
    </>
  )
}
