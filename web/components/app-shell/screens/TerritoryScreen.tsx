'use client'

import { useCatchesByTerritory, useProfile, useCanAddCatchManually, useIsSuperAdmin } from '@/lib/supabase/queries'
import { KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import type { Territory } from '@/lib/data/types'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'
import { BackButton } from '@/components/app-shell/BackButton'

export function statusBadge(status: Territory['status'], myTerritoryColor: string) {
  if (status === 'mine')
    return (
      <span className="badge" style={{ background: withAlpha(myTerritoryColor, 0.16), color: darkenForBadgeText(myTerritoryColor) }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" /></svg>
        Моя
      </span>
    )
  if (status === 'other') return <span className="badge badge-blue">Занята</span>
  return <span className="badge badge-neutral">Свободна</span>
}

// The one person this whole screen is really about — given its own small
// "profile card" moment (ring the avatar in the brand's own orange, a
// caption above naming what they did) rather than folding them into a
// plain nav row like every other "open a profile" link in the app.
function SectorOwnerCard({
  ownerId,
  isMine,
  onOpenUser,
}: {
  ownerId: string
  isMine: boolean
  onOpenUser: (id: string) => void
}) {
  const { data: profile } = useProfile(ownerId)
  const initials = (profile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()
  return (
    <div className="sector-owner-highlight">
      <div className="sector-owner-highlight-label">Захватил сектор</div>
      <button
        className="sector-owner-highlight-row tap-scale"
        onClick={() => onOpenUser(ownerId)}
        disabled={isMine}
      >
        <div className="sector-owner-highlight-avatar">
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sector-owner-highlight-name">{isMine ? 'Ты' : profile?.displayName ?? '…'}</div>
          {!isMine && <div className="sector-owner-highlight-sub">Смотреть профиль</div>}
        </div>
        {!isMine && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </div>
  )
}

// A sector's catches span different owners over time (unlike a profile's own
// catch list), so each row needs to say who caught it — exported for reuse by
// MyCatchesScreen's territory mode ("Все уловы" from this screen). Clickable
// through to that person's profile, except "Ты", which is already where you
// are.
export function CatcherLabel({ userId, mine, onOpenUser }: { userId: string; mine: boolean; onOpenUser: (id: string) => void }) {
  const { data: profile } = useProfile(mine ? null : userId)
  const style: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', marginBottom: 2 }
  if (mine) return <div style={style}>Ты</div>
  return (
    <div style={style}>
      {/* Rows that show this now also open the catch photo on their own
          click (TerritoryScreen/MyCatchesScreen) — stop the click here so
          tapping the name opens the profile, not the photo underneath it. */}
      <button className="activity-who-btn" onClick={(e) => { e.stopPropagation(); onOpenUser(userId) }}>
        {profile?.displayName ?? '…'}
      </button>
    </div>
  )
}

// View-only for regular users — a catch can only be recorded through "+"
// (geolocation), never by picking a sector by hand (see DECISIONS.md). The
// one exception is the admin-only "Добавить улов" button below, which skips
// the geolocation gate entirely (see DECISIONS.md, admin bypass).
//
// Map-led composition: a full-bleed hero map with the identity card docked
// over its bottom edge (the "place card" convention from map-first apps),
// stats as a borderless divided strip, catches as plain hairline rows — no
// nested cards. Picked from a 3-way live comparison (see git history for
// TerritoryScreenVariants.tsx, the two not chosen).
export function TerritoryScreen({
  territory,
  isMostPopular,
  onBack,
  onOpenUser,
  onOpenPhoto,
  onAdminCatch,
  onDeleteTerritory,
  onShare,
  onOpenAllCatches,
  myTerritoryColor,
}: {
  territory: Territory
  isMostPopular: boolean
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenPhoto: (catchId: number) => void
  onAdminCatch: (territoryId: string) => void
  onDeleteTerritory: (territoryId: string) => void
  onShare: () => void
  onOpenAllCatches: () => void
  myTerritoryColor: string
}) {
  const canAddCatchManually = useCanAddCatchManually()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: catches = [] } = useCatchesByTerritory(territory.id)
  const { data: ownerProfile } = useProfile(territory.ownerId ?? null)
  const recent = catches.slice(0, 3)

  return (
    <div className="screen-inner" style={{ padding: 0 }}>
      <div className="sector-hero-map">
        <TerritoryThumbnailMapView
          territory={territory}
          myTerritoryColor={myTerritoryColor}
          ownerAvatarUrl={ownerProfile?.avatarUrl ?? null}
          ownerInitials={(ownerProfile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
        />
        <div className="sector-hero-map-icons">
          <BackButton onClick={onBack} registerNative={false} />
          <div className="icon-btn tap-scale" onClick={onShare}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M12 4 8 8M12 4l4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 20px 100px' }}>
        <div className="sector-dock-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            {/* "Сектор" and the id forced onto their own lines so the id
                never ellipsizes, regardless of how much width the badge
                column on the right takes up. */}
            <div className="page-title" style={{ marginTop: 2 }}>
              Сектор
              <br />
              {territory.id}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              {statusBadge(territory.status, myTerritoryColor)}
              {isMostPopular && <span className="badge badge-accent">🔥 Самый популярный</span>}
            </div>
          </div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {KIND_LABEL[territory.kind]}
          </div>
          {territory.ownerId && (
            <SectorOwnerCard ownerId={territory.ownerId} isMine={territory.status === 'mine'} onOpenUser={onOpenUser} />
          )}
          {canAddCatchManually && (
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => onAdminCatch(territory.id)}>
              Добавить улов (админ)
            </button>
          )}
        </div>

        <div className="sector-stat-strip">
          <div>
            <div className="value">{territory.catchCount}</div>
            <div className="label">Уловов</div>
          </div>
          <div>
            <div className="value">{territory.lastCatchAt ? formatWhen(territory.lastCatchAt) : '—'}</div>
            <div className="label">Последний</div>
          </div>
          <div>
            <div className="value">≈600 м</div>
            <div className="label">Размер</div>
          </div>
          <div>
            <div className="value">{KIND_LABEL[territory.kind]}</div>
            <div className="label">Тип</div>
          </div>
        </div>

        <div className="section-title-row" style={{ marginTop: 22 }}>
          <div className="section-title">Последние уловы</div>
          {catches.length > recent.length && (
            <button className="section-link" onClick={onOpenAllCatches}>
              Все уловы
            </button>
          )}
        </div>
        {recent.length ? (
          recent.map((c) => {
            const meta = formatCatchMeta(c.lengthCm, c.weightKg)
            return (
              // Whole row opens the catch photo now — report/delete moved
              // into CatchPhotoScreen itself, where they get a real touch
              // target instead of being crammed into this thin row (that
              // used to cause mis-taps landing on "Пожаловаться" instead
              // of the photo). CatcherLabel still stops its own click from
              // bubbling here, so tapping the name opens the profile.
              <div key={c.id} className="sector-row-plain tap-scale" style={{ cursor: 'pointer' }} onClick={() => onOpenPhoto(c.id)}>
                <div className="fish-thumb" style={{ width: 46, height: 46 }}>
                  <img src={c.photoUrl} alt={c.speciesName} />
                </div>
                <div style={{ flex: 1 }}>
                  <CatcherLabel userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.speciesName}</div>
                  {meta && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>{meta}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>{formatWhen(c.caughtAt).split('·')[0].trim()}</div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов в этом секторе</div>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary" style={{ marginTop: 24, color: '#D33' }} onClick={() => onDeleteTerritory(territory.id)}>
            Удалить сектор
          </button>
        )}
      </div>
    </div>
  )
}
