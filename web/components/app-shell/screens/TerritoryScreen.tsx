'use client'

import { useCatchesByTerritory, useProfile, useIsAdmin, useIsSuperAdmin } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import type { Territory } from '@/lib/data/types'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'

function statusBadge(status: Territory['status'], myTerritoryColor: string) {
  if (status === 'mine')
    return (
      <span className="badge" style={{ background: withAlpha(myTerritoryColor, 0.16), color: darkenForBadgeText(myTerritoryColor) }}>
        Моя территория
      </span>
    )
  if (status === 'other') return <span className="badge badge-blue">Занята</span>
  return <span className="badge badge-neutral">Свободна</span>
}

function OwnerRow({ ownerId, isMine, onOpenUser }: { ownerId: string; isMine: boolean; onOpenUser: (id: string) => void }) {
  const { data: profile } = useProfile(ownerId)
  const initials = (profile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()
  return (
    <button className="owner-row tap-scale" onClick={() => onOpenUser(ownerId)} disabled={isMine}>
      <div className="owner-avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{isMine ? 'Твоя территория' : profile?.displayName ?? '…'}</div>
    </button>
  )
}

// View-only for regular users — a catch can only be recorded through "+"
// (geolocation), never by picking a sector by hand (see DECISIONS.md). The
// one exception is the admin-only "Добавить улов" button below, which skips
// the geolocation gate entirely (see DECISIONS.md, admin bypass).
export function TerritoryScreen({
  territory,
  onBack,
  onOpenUser,
  onOpenPhoto,
  onReportPhoto,
  onAdminCatch,
  onDeleteCatch,
  onDeleteTerritory,
  onShare,
  myTerritoryColor,
}: {
  territory: Territory
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenPhoto: (src: string) => void
  onReportPhoto: (catchId: number) => void
  onAdminCatch: (territoryId: string) => void
  onDeleteCatch: (catchId: number) => void
  onDeleteTerritory: (territoryId: string) => void
  onShare: () => void
  myTerritoryColor: string
}) {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: catches = [] } = useCatchesByTerritory(territory.id)
  const { data: ownerProfile } = useProfile(territory.ownerId ?? null)
  const recent = catches.slice(0, 3)

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div className="icon-btn tap-scale" onClick={onShare}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15V4M12 4 8 8M12 4l4 4" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
        </div>
      </div>
      <div className="screen-inner">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div className="page-title" style={{ marginTop: 2 }}>
              Территория {territory.id}
            </div>
            {statusBadge(territory.status, myTerritoryColor)}
          </div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {KIND_LABEL[territory.kind]}
          </div>
        </div>
        {territory.ownerId && (
          <OwnerRow ownerId={territory.ownerId} isMine={territory.status === 'mine'} onOpenUser={onOpenUser} />
        )}
        {isAdmin && (
          <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => onAdminCatch(territory.id)}>
            Добавить улов (админ)
          </button>
        )}
        <TerritoryThumbnailMapView
          territory={territory}
          myTerritoryColor={myTerritoryColor}
          ownerAvatarUrl={ownerProfile?.avatarUrl ?? null}
          ownerInitials={(ownerProfile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
        />
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <div className="info-grid">
            <div>
              <div className="label">Размер</div>
              <div className="value">≈600 м</div>
            </div>
            <div>
              <div className="label">Тип</div>
              <div className="value">{KIND_LABEL[territory.kind]}</div>
            </div>
            <div>
              <div className="label">Уловов</div>
              <div className="value">{territory.catchCount}</div>
            </div>
            <div>
              <div className="label">Последний улов</div>
              <div className="value">{territory.lastCatchAt ? formatWhen(territory.lastCatchAt) : '—'}</div>
            </div>
          </div>
        </div>
        <div className="section-title" style={{ marginTop: 22 }}>
          Последние уловы
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {recent.length ? (
            recent.map((c, i) => {
              const meta = formatCatchMeta(c.lengthCm, c.weightKg)
              return (
                <div
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < recent.length - 1 ? '1px solid var(--line)' : 'none' }}
                >
                  <div className="fish-thumb" style={{ width: 46, height: 46, cursor: 'pointer' }} onClick={() => onOpenPhoto(c.photoUrl)}>
                    <img src={c.photoUrl} alt={c.speciesName} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.speciesName}</div>
                    {meta && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>{meta}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>{formatWhen(c.caughtAt).split('·')[0].trim()}</div>
                    {user && !c.mine && (
                      <button className="report-flag-btn tap-scale" onClick={() => onReportPhoto(c.id)} title="Пожаловаться на фото">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 3v18M5 4h12l-2.5 4L17 12H5" />
                        </svg>
                        Пожаловаться
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button className="delete-catch-btn tap-scale" onClick={() => onDeleteCatch(c.id)} title="Удалить улов">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов на этой территории</div>
          )}
        </div>
        {isSuperAdmin && (
          <button
            className="btn-secondary"
            style={{ marginTop: 16, color: '#D33' }}
            onClick={() => onDeleteTerritory(territory.id)}
          >
            Удалить сектор
          </button>
        )}
      </div>
    </>
  )
}
