'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { formatCoords, mapsLinks, openExternal } from '@/lib/openExternal'
import { useCatchesByTerritory, useProfile, useCanAddCatchManually, useIsSuperAdmin, useBuffs, useBuyShield, useAdminSetTerritoryKind } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { KIND_LABEL, WATER_KINDS_BY_CITY } from '@/lib/data/species'
import { cityForSectorId } from '@/lib/data/city'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import type { Territory, TerritoryCoHolder } from '@/lib/data/types'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'
import { BackButton } from '@/components/app-shell/BackButton'
import { InsufficientCoinsModal } from '@/components/app-shell/InsufficientCoinsModal'
import { CoinIcon } from '@/components/app-shell/CoinIcon'

export function statusBadge(status: Territory['status'], myTerritoryColor: string, myShare = false) {
  // myShare: a clan-mate's sector the viewer holds a part of.
  if (status === 'mine' || myShare)
    return (
      <span className="badge" style={{ background: withAlpha(myTerritoryColor, 0.16), color: darkenForBadgeText(myTerritoryColor) }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" /></svg>
        {status === 'mine' ? 'Моя' : 'Моя доля'}
      </span>
    )
  if (status === 'other') return <span className="badge badge-blue">Занята</span>
  return <span className="badge badge-neutral">Свободна</span>
}

// Щит/Прилив — shown next to statusBadge wherever it renders, since a
// protected sector being visibly protected is the whole point (a deterrent
// other players need to see, not just the owner).
export function shieldBadge(shieldUntil: string | null) {
  if (!shieldUntil || new Date(shieldUntil) <= new Date()) return null
  return (
    <span className="badge badge-shield">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z" /></svg>
      Под щитом
    </span>
  )
}

// The one person this whole screen is really about — given its own small
// "profile card" moment (ring the avatar in the brand's own orange, a
// caption above naming what they did) rather than folding them into a
// plain nav row like every other "open a profile" link in the app.
function SectorOwnerCard({
  ownerId,
  isMine,
  coHolders,
  onOpenUser,
}: {
  ownerId: string
  isMine: boolean
  coHolders: TerritoryCoHolder[]
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
          {profile?.avatarUrl ? <img src={thumbUrl(profile.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : initials}
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
      {coHolders.length > 0 && (
        <>
          <div className="sector-owner-highlight-label sector-coholders-label">
            Совладельцы · {coHolders.length} из 3
          </div>
          <div className="sector-coholders">
            {coHolders.map((h) => (
              <button key={h.id} className="sector-coholder tap-scale" onClick={() => onOpenUser(h.id)} disabled={h.isMe}>
                <span className="sector-coholder-avatar">
                  {h.avatarUrl ? <img src={thumbUrl(h.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : (h.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
                </span>
                <span className="sector-coholder-name">{h.isMe ? 'Ты' : h.displayName ?? 'Рыбак'}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// The sector's centre as plain coordinates — copy them into any maps app, or
// jump straight to a route there — so you can actually get to the water.
function SectorCoords({ lat, lng, onToast }: { lat: number; lng: number; onToast: (message: string) => void }) {
  const [mapsOpen, setMapsOpen] = useState(false)
  const coords = formatCoords(lat, lng)

  async function copy() {
    try {
      await navigator.clipboard.writeText(coords)
      onToast('Координаты скопированы')
    } catch {
      onToast('Не удалось скопировать')
    }
  }

  return (
    <div className="sector-coords">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      <span className="sector-coords-value">{coords}</span>
      <button className="sector-coords-btn tap-scale" onClick={() => void copy()}>
        Скопировать
      </button>
      <button className="sector-coords-btn primary tap-scale" onClick={() => setMapsOpen(true)}>
        Маршрут
      </button>
      {mapsOpen &&
        createPortal(
          <div className="modal-overlay" onClick={() => setMapsOpen(false)}>
            <div className="modal-card sector-maps-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Маршрут до сектора</div>
              <div className="modal-body" style={{ margin: '6px 0 14px' }}>
                {coords}
              </div>
              {mapsLinks(lat, lng).map((m) => (
                <button
                  key={m.id}
                  className="sector-maps-option tap-scale"
                  onClick={() => {
                    setMapsOpen(false)
                    openExternal(m.url)
                  }}
                >
                  {m.label}
                </button>
              ))}
              <button className="comments-dialog-cancel" onClick={() => setMapsOpen(false)}>
                Отмена
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

// Bought right when you're worried about a specific sector, not from the
// general Shop grid — it needs a target, and this screen already is one.
function ShieldButton({ territory }: { territory: Territory }) {
  const { user } = useAuth()
  const { data: myProfile } = useProfile(user?.id ?? null)
  const { data: buffs = [] } = useBuffs()
  const buyShield = useBuyShield()
  const [showInsufficient, setShowInsufficient] = useState(false)
  const price = buffs.find((b) => b.id === 'shield')?.price ?? 80
  const coins = myProfile?.coins ?? 0
  const active = territory.shieldUntil && new Date(territory.shieldUntil) > new Date()

  function handleClick() {
    if (coins < price) setShowInsufficient(true)
    else buyShield.mutate(territory.id)
  }

  return (
    <>
      <button className="btn-secondary shop-price-btn" style={{ marginTop: 12 }} disabled={buyShield.isPending} onClick={handleClick}>
        {buyShield.isPending ? (
          'Покупаем…'
        ) : active ? (
          <>
            Продлить щит · {price} <CoinIcon size={16} />
          </>
        ) : (
          <>
            Защитить сектор · {price} <CoinIcon size={16} />, 24ч
          </>
        )}
      </button>
      {showInsufficient && <InsufficientCoinsModal price={price} coins={coins} onClose={() => setShowInsufficient(false)} />}
    </>
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
// Super admin only: fixes a sector's water type in place. The chip of the
// type being saved lights up right away and the row stays locked until the
// map has reloaded with it.
function AdminKindPicker({ territory }: { territory: Territory }) {
  const setKind = useAdminSetTerritoryKind()
  const shownKind = setKind.isPending ? setKind.variables.kind : territory.kind
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>Тип водоёма (админ)</div>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {WATER_KINDS_BY_CITY[cityForSectorId(territory.id)].map((k) => (
          <button
            key={k}
            type="button"
            className={`filter-chip${shownKind === k ? ' active' : ''}`}
            aria-pressed={shownKind === k}
            disabled={setKind.isPending}
            onClick={() => k !== territory.kind && setKind.mutate({ territory, kind: k })}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {setKind.isError && <div style={{ fontSize: 12.5, color: '#D33', marginTop: 8 }}>Не удалось сменить тип — попробуй ещё раз</div>}
    </div>
  )
}

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
  onOpenClan,
  onToast,
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
  onOpenClan: (id: number) => void
  onToast: (message: string) => void
}) {
  const canAddCatchManually = useCanAddCatchManually()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: catches = [], isPending: catchesPending } = useCatchesByTerritory(territory.id)
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
              {statusBadge(territory.status, myTerritoryColor, territory.coHolders.some((h) => h.isMe))}
              {shieldBadge(territory.shieldUntil)}
              {isMostPopular && <span className="badge badge-accent">🔥 Самый популярный</span>}
            </div>
          </div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {KIND_LABEL[territory.kind]}
          </div>
          <SectorCoords lat={territory.lat} lng={territory.lng} onToast={onToast} />
          {territory.ownerId && (
            <SectorOwnerCard ownerId={territory.ownerId} isMine={territory.status === 'mine'} coHolders={territory.coHolders} onOpenUser={onOpenUser} />
          )}
          {territory.ownerId && territory.ownerClanId && (
            <button className="sector-clan-line tap-scale" onClick={() => onOpenClan(territory.ownerClanId!)}>
              <ClanCrest crest={territory.ownerClanCrest} size={26} />
              <span className="sector-clan-line-text">
                Сектор клана <b>«{territory.ownerClanName}»</b>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
          {canAddCatchManually && (
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => onAdminCatch(territory.id)}>
              Добавить улов (админ)
            </button>
          )}
          {territory.status === 'mine' && <ShieldButton territory={territory} />}
          {isSuperAdmin && <AdminKindPicker territory={territory} />}
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
                  <img src={thumbUrl(c.photoUrl, 160)} alt={c.speciesName} loading="lazy" decoding="async" />
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
          // While the list is still loading, "no catches" would contradict the
          // catch count right above it — same box, neutral text instead.
          <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>
            {catchesPending ? 'Загрузка…' : 'Пока нет уловов в этом секторе'}
          </div>
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
