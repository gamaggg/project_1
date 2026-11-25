'use client'

import { SkeletonRows } from '@/components/app-shell/Skeleton'
import { useState } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useCatchesByTerritory, useProfile, useCanAddCatchManually, useIsSuperAdmin, useAdminSetTerritoryKind, useSlotState, useUseFreeShield } from '@/lib/supabase/queries'
import { useI18n, useT } from '@/lib/i18n'
import { formatWeekdayTime } from '@/lib/i18n/format'
import { useNow } from '@/lib/useNow'
import { SectorInsightsCard, SectorLegendRow } from '@/components/app-shell/SectorInsights'
import { SectorDefenseAside } from '@/components/app-shell/SectorDefense'
import { SectorForecastCard } from '@/components/app-shell/BiteForecast'
import { RouteModal } from '@/components/app-shell/RouteModal'
import { HOT_FLAME_SVG } from '@/lib/map/hotFlame'
import { useAuth } from '@/components/providers/AuthProvider'
import { KIND_LABEL, WATER_KINDS_BY_CITY } from '@/lib/data/species'
import { CITIES, cityForSectorId } from '@/lib/data/city'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import type { Territory } from '@/lib/data/types'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { CountUp } from '@/components/app-shell/CoinCountUp'
import { useDoubleCoinsUntil } from '@/components/app-shell/DoubleCoinsChip'
import { tn, currentLocale } from '@/lib/i18n'
import { Clan2SectorHqCardLazy, Clan2SectorHqRibbonLazy } from '@/components/clan2/live/lazy'
import { useClan2Enabled } from '@/lib/clan2/live/flag'
import { nameInitials } from '@/lib/initials'
import { SectorBadgeInfo, type SectorBadgeKind } from '@/components/app-shell/SectorBadgeInfo'
import { SectorHoldersCard } from '@/components/app-shell/SectorHoldersCard'

// The hero map's height (globals.css, .sector-hero-map) and what covers it: the dock card overlaps its bottom 26px.
const HERO_FIT = { baseHeight: 320, gap: 60, bottomCover: 26 }

export function statusBadge(status: Territory['status'], myTerritoryColor: string, myShare = false) {
  // myShare: a clan-mate's sector the viewer holds a part of.
  if (status === 'mine' || myShare)
    return (
      <span className="badge" style={{ background: withAlpha(myTerritoryColor, 0.16), color: darkenForBadgeText(myTerritoryColor) }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" /></svg>
        {status === 'mine' ? tn('map.mine') : tn('map.myShare')}
      </span>
    )
  if (status === 'other') return <span className="badge badge-blue">{tn('sector.taken')}</span>
  return <span className="badge badge-neutral">{tn('map.free')}</span>
}

// Щит/Прилив — shown next to statusBadge, since a protected sector being
// visibly protected is the whole point (a deterrent other players need to
// see, not just the owner) — with how long it still holds: whole hours, the
// last three with minutes, the last one in minutes. Counts down on its own.
function ShieldBadge({ shieldUntil }: { shieldUntil: string | null }) {
  const now = useNow(30_000)
  const left = shieldUntil ? new Date(shieldUntil).getTime() - now : 0
  if (left <= 0) return null
  const minutes = Math.max(1, Math.ceil(left / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const time = h === 0 ? tn('fmt.minShort', { count: m }) : h < 3 && m > 0 ? `${tn('fmt.hourShort', { count: h })} ${tn('fmt.minShort', { count: m })}` : tn('fmt.hourShort', { count: h })
  return (
    <span className="badge badge-shield" title={tn('sector.shieldTitle', { when: new Date(shieldUntil!).toLocaleString(currentLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z" /></svg>
      {/* Always the short form «Щит · 2 ч 45 мин»: the long one didn't fit
          beside the sector id on an iPhone with its bigger text. */}
      <span>{tn('sector.shieldShort', { time })}</span>
    </span>
  )
}

// Shields aren't sold: they only drop in the Shop's slots, wait in a reserve,
// and are put on a sector here — the one screen with a sector to put them on.
// A hot sector is open to everyone until the week ends: use_free_shield
// refuses it (HOT_SECTOR), so the button stays visible but locked, with why —
// also when the sector turned hot while this screen was open.
function ShieldButton({ territory, hot }: { territory: Territory; hot: boolean }) {
  const { data: slotState } = useSlotState()
  const useFreeShield = useUseFreeShield()
  const freeShields = slotState?.freeShields ?? 0
  const t = useT()
  const now = useNow(30_000)

  if (freeShields === 0) return null
  // A clan HQ under siege (HQ_SIEGE, 20.11.2026): a shield would not lift the siege and would pass to whoever takes
  // the sector, so the server refuses it before taking it from the reserve.
  const siege = /HQ_SIEGE/.test(useFreeShield.error?.message ?? '')
  // 24.11.2026: no shield over a shield (SHIELD_ACTIVE) — the next one goes on once this one ends.
  const shieldUp = (!!territory.shieldUntil && new Date(territory.shieldUntil).getTime() > now) || /SHIELD_ACTIVE/.test(useFreeShield.error?.message ?? '')
  const locked = hot || siege || shieldUp || /HOT_SECTOR/.test(useFreeShield.error?.message ?? '')
  return (
    <>
      <button
        className={`btn-primary${locked ? ' shield-locked' : ''}`}
        style={{ marginTop: 12 }}
        disabled={locked || useFreeShield.isPending}
        onClick={() => useFreeShield.mutate(territory.id)}
      >
        {t('territory.freeShield')} · {t('territory.freeShieldLeft', { count: freeShields })}
      </button>
      {locked && <div className="shield-hot-note">{t(siege ? 'territory.freeShieldSiege' : shieldUp && !hot ? 'territory.freeShieldActive' : 'territory.freeShieldHot')}</div>}
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
  if (mine) return <div style={style}>{tn('sector.you')}</div>
  return (
    <div style={style}>
      {/* Rows that show this now also open the catch photo on their own
          click (TerritoryScreen/MyCatchesScreen) — stop the click here so
          tapping the name opens the profile, not the photo underneath it. */}
      <button className="activity-who-btn" onClick={(e) => { e.stopPropagation(); onOpenUser(userId) }}>
        {profile?.displayName ?? <span className="skel" style={{ display: 'inline-block', width: 64, height: 9, verticalAlign: 'middle' }} />}
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
  onShowOnMap,
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
  // Absent for a sector outside the city the map is showing.
  onShowOnMap?: (id: string) => void
}) {
  const canAddCatchManually = useCanAddCatchManually()
  const clan2On = useClan2Enabled()
  const { t: tr, lang } = useI18n()
  const now = useNow()
  const hot = !!territory.hotUntil && new Date(territory.hotUntil).getTime() > now
  const shieldOn = !!territory.shieldUntil && new Date(territory.shieldUntil).getTime() > now
  const myShare = territory.coHolders.some((h) => h.isMe)
  const [badgeInfo, setBadgeInfo] = useState<SectorBadgeKind | null>(null)
  const [routeOpen, setRouteOpen] = useState(false)
  // With «Двойные монеты» on, a catch here pays ×3 instead of ×2 (confirm_catch).
  const doubled = useDoubleCoinsUntil() !== null
  // Казна: every sector held earns its holders 8 coins a day (×3 while hot).
  const holdsThis = territory.status === 'mine' || territory.coHolders.some((h) => h.isMe)
  const isSuperAdmin = useIsSuperAdmin()
  const { data: catches = [], isPending: catchesPending } = useCatchesByTerritory(territory.id)
  const { data: ownerProfile } = useProfile(territory.ownerId ?? null)
  const { user } = useAuth()
  const { data: myProfile } = useProfile(user?.id ?? null)
  const recent = catches.slice(0, 3)

  return (
    <div className="screen-inner" style={{ padding: 0 }}>
      <div className="sector-hero-map">
        <TerritoryThumbnailMapView
          territory={territory}
          myTerritoryColor={myTerritoryColor}
          ownerAvatarUrl={ownerProfile?.avatarUrl ?? null}
          ownerInitials={nameInitials(ownerProfile?.displayName ?? tn('common.angler'), 2)}
          claimFx
          fit={HERO_FIT}
        />
        {onShowOnMap && (
          // The whole hero map is the tap target for «На карте».
          <button type="button" className="sector-hero-map-open" aria-label={tn('sector.showOnMap')} onClick={() => onShowOnMap(territory.id)} />
        )}
        {/* «Маршрут» rides on the map (24.11): the coordinates block under the title is gone, the map is enough. */}
        <div className="sector-hero-map-chips">
          <button type="button" className="sector-hero-map-chip" onClick={() => setRouteOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="6" cy="19" r="2" />
              <circle cx="18" cy="5" r="2" />
              <path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H12" />
            </svg>
            {tn('sector.route')}
          </button>
          {onShowOnMap && (
            <button type="button" className="sector-hero-map-chip" onClick={() => onShowOnMap(territory.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
                <path d="M9 4v13M15 6.5v13" />
              </svg>
              {tn('sector.onMap')}
            </button>
          )}
        </div>
        {routeOpen && <RouteModal lat={territory.lat} lng={territory.lng} onClose={() => setRouteOpen(false)} />}
        {clan2On && <Clan2SectorHqRibbonLazy id={territory.id} />}
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
      <div style={{ padding: '0 20px calc(var(--nav-h, 82px) + 18px)' }}>
        <div className="sector-dock-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            {/* "Сектор" and the id forced onto their own lines so the id
                never ellipsizes, regardless of how much width the badge
                column on the right takes up. */}
            <div className="page-title" style={{ marginTop: 2, flexShrink: 0 }}>
              {tn('sector.sector')}
              <br />
              {territory.id}
            </div>
            {/* sector-head-badges: the column takes what the title leaves; a
                badge too long for it ends in «…» inside the card. */}
            <div className="sector-head-badges">
              {/* Each badge opens a small card saying what it means (24.11). */}
              <button type="button" className="badge-tap" onClick={() => setBadgeInfo('status')}>
                {statusBadge(territory.status, myTerritoryColor, myShare)}
              </button>
              {shieldOn && (
                <button type="button" className="badge-tap" onClick={() => setBadgeInfo('shield')}>
                  <ShieldBadge shieldUntil={territory.shieldUntil} />
                </button>
              )}
              {isMostPopular && (
                <button type="button" className="badge-tap" onClick={() => setBadgeInfo('popular')}>
                  <span className="badge badge-accent">
                    <span>{tn('sector.mostPopular')}</span>
                  </span>
                </button>
              )}
            </div>
            {badgeInfo && <SectorBadgeInfo kind={badgeInfo} territory={territory} myShare={myShare} onClose={() => setBadgeInfo(null)} />}
          </div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {KIND_LABEL[territory.kind]}
          </div>
          {clan2On && <Clan2SectorHqCardLazy id={territory.id} onOpenClan={onOpenClan} />}
          {hot && (
            <div className="sector-hot">
              <div className="sector-hot-head">
                <span className="sector-hot-flame" aria-hidden dangerouslySetInnerHTML={{ __html: HOT_FLAME_SVG }} />
                <span className="sector-hot-title">{tr('hot.badge')}</span>
                <span className="sector-hot-until">
                  {tr('hot.until', { time: formatWeekdayTime(territory.hotUntil!, lang, CITIES[cityForSectorId(territory.id)].timezone) })}
                </span>
              </div>
              {/* What it pays, as three numbers to take in at a glance. */}
              <div className="sector-hot-perks">
                <div className="sector-hot-perk">
                  <b>×{doubled ? 3 : 2}</b>
                  <span>{tr(doubled ? 'hot.perkCatchDoubled' : 'hot.perkCatch')}</span>
                </div>
                <div className="sector-hot-perk">
                  <b>×3</b>
                  <span>{tr('hot.perkTreasury')}</span>
                </div>
                <div className="sector-hot-perk">
                  <b>
                    +100 <CoinIcon size={16} />
                  </b>
                  <span>{tr('hot.perkHold')}</span>
                </div>
              </div>
              <div className="sector-hot-note">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2.5 19.5 5.3V11c0 4.6-3.2 8.2-7.5 10.5C7.7 19.2 4.5 15.6 4.5 11V5.3z" />
                  <path d="m4 4 16 16" />
                </svg>
                {tr('hot.noShield')}
              </div>
            </div>
          )}
          <SectorHoldersCard territory={territory} onOpenUser={onOpenUser} onOpenClan={onOpenClan} />
          <SectorLegendRow
            territory={territory}
            onOpenUser={onOpenUser}
            onOpenPhoto={onOpenPhoto}
            aside={territory.ownerId ? <SectorDefenseAside territory={territory} myClanId={myProfile?.clanId ?? null} /> : undefined}
          />
          {holdsThis && (
            <div className="sector-income">
              <CoinIcon size={16} />
              {tr('treasury.perDay', { count: hot ? 24 : 8 })}
            </div>
          )}
          {canAddCatchManually && (
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => onAdminCatch(territory.id)}>
              Добавить улов (админ)
            </button>
          )}
          {/* The owner, or a clan-mate holding a share of it (use_free_shield
              allows both). */}
          {(territory.status === 'mine' || territory.coHolders.some((h) => h.isMe)) && <ShieldButton territory={territory} hot={hot} />}
          {isSuperAdmin && <AdminKindPicker territory={territory} />}
        </div>

        <div className="sector-stat-strip">
          <div>
            <div className="value">
              <CountUp key={territory.id} value={territory.catchCount} />
            </div>
            <div className="label">{tn('sector.catchesLabel')}</div>
          </div>
          <div>
            <div className="value">{territory.lastCatchAt ? formatWhen(territory.lastCatchAt) : '—'}</div>
            <div className="label">{tn('sector.lastLabel')}</div>
          </div>
          <div>
            <div className="value">{tn('sector.sizeValue')}</div>
            <div className="label">{tn('sector.sizeLabel')}</div>
          </div>
          <div>
            <div className="value">{KIND_LABEL[territory.kind]}</div>
            <div className="label">{tn('sector.typeLabel')}</div>
          </div>
        </div>

        {/* The latest catches come first, right under the sector's numbers; the forecast and the insights follow. */}
        <div className="section-title-row" style={{ marginTop: 22 }}>
          <div className="section-title">{tn('profile.recentCatches')}</div>
          {catches.length > recent.length && (
            <button className="section-link" onClick={onOpenAllCatches}>
              {tn('profile.allCatches')}
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
          // catch count right above it — the rows' shape instead.
          catchesPending && territory.catchCount > 0 ? (
            <SkeletonRows count={Math.min(3, territory.catchCount)} className="sector-skel" />
          ) : (
            <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>
              {catchesPending ? '' : tn('sector.noCatchesHere')}
            </div>
          )
        )}

        <SectorForecastCard territory={territory} city={cityForSectorId(territory.id)} />
        <SectorInsightsCard territory={territory} />

        {isSuperAdmin && (
          <button className="btn-secondary" style={{ marginTop: 24, color: '#D33' }} onClick={() => onDeleteTerritory(territory.id)}>
            Удалить сектор
          </button>
        )}
      </div>
    </div>
  )
}
