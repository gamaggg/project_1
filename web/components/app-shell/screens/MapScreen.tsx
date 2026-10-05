'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { MapView } from '@/components/app-shell/MapView'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import type { Territory } from '@/lib/data/types'
import { CITIES, type CityId } from '@/lib/data/city'
import { formatWhen } from '@/lib/format'
import { getCurrentCoords, useGeolocationPermission } from '@/lib/geolocation'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { LaurelIcon } from '@/components/app-shell/SectorInsights'
import { ForecastChip } from '@/components/app-shell/BiteForecast'
import { NearestFreeCard, NearestFreeIcon, findNearestFree, type NearestFreeState } from '@/components/app-shell/NearestFree'
import { sectorHoldersCapturerFirst } from '@/lib/data/sectorHolders'
import { mostPopularSectorId } from '@/lib/data/sectorOrder'
import { MapRacePill } from '@/components/app-shell/ClanRace'
import { TreasuryChip } from '@/components/app-shell/TreasuryChip'
import { HOT_FLAME_SVG } from '@/lib/map/hotFlame'
import { useI18n } from '@/lib/i18n'
import { formatWeekdayTime } from '@/lib/i18n/format'
import { useNow } from '@/lib/useNow'

// Native scrollIntoView({behavior:'smooth'}) paces itself by distance, not
// time — fine for the carousel's own drag-driven scrolling, but a map tap
// can jump from the first sector to the last one, and that native scroll
// then visibly grinds along for seconds. A fixed short duration keeps a
// map-triggered jump feeling equally snappy regardless of how far apart the
// two sectors are.
function scrollToCardFast(row: HTMLElement, card: HTMLElement, duration = 280) {
  const start = row.scrollLeft
  const max = row.scrollWidth - row.clientWidth
  const target = Math.max(0, Math.min(max, card.offsetLeft - (row.clientWidth - card.offsetWidth) / 2))
  const distance = target - start
  if (Math.abs(distance) < 1) return
  const startTime = performance.now()
  function step(now: number) {
    const t = Math.min(1, (now - startTime) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    row.scrollLeft = start + distance * eased
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function statusBadge(status: Territory['status'], myTerritoryColor: string, myShare = false) {
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

// How many cards either side of the centered one get their contents rendered.
// Only one is ever on screen (cards are full-row width), so this is purely
// headroom for a fast flick landing a few cards over before the next scroll
// event fires.
const SHEET_WINDOW = 3

function shieldBadge(shieldUntil: string | null) {
  if (!shieldUntil || new Date(shieldUntil) <= new Date()) return null
  return (
    <span className="badge badge-shield">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z" /></svg>
      Под щитом
    </span>
  )
}

// showTerritory: fly to a sector and bring its carousel card up, exactly as
// a tap on it on the map would — for «open on the map» from a sector screen.
export type MapScreenHandle = LeafletMapHandle & { showTerritory: (id: string) => void }

// forwardRef so FishZoneApp can fly the map to a geolocated sector (from the
// "+" handler) even while the camera screen is showing — the map stays
// mounted the whole time, it's just visually hidden (see .screen CSS).
export const MapScreen = forwardRef<
  MapScreenHandle,
  {
    territories: Territory[]
    myTerritoryColor: string
    onOpenTerritory: (id: string) => void
    selectedIds?: Set<string>
    onLongPressTerritory?: (id: string) => void
    onDeleteSelected?: () => void
    onCancelSelection?: () => void
    pendingAddDrafts?: { corners: [number, number][] }[]
    onLongPressEmptyMap?: (lat: number, lng: number) => void
    onClickEmptyMap?: (lat: number, lng: number) => void
    onConfirmAdd?: () => void
    onCancelAdd?: () => void
    city: CityId
    onOpenClan?: (id: number) => void
    // Regatta plaque — only passed for someone in a clan (see MapRacePill).
    race?: { city: CityId; clanId: number; onOpen: () => void } | null
    // The app's toast — Казна says what happened through it.
    onToast?: (msg: string) => void
    // No catches yet: the «Ближайший свободный сектор» button shows.
    newbie?: boolean
    // Bumped by the onboarding's last step («Найти свободный сектор рядом»)
    // to run the same search as the button once the map is up.
    nearestFreeRequest?: number
  }
>(function MapScreen(
  {
    territories,
    myTerritoryColor,
    onOpenTerritory,
    selectedIds,
    onLongPressTerritory,
    onDeleteSelected,
    onCancelSelection,
    pendingAddDrafts,
    onLongPressEmptyMap,
    onClickEmptyMap,
    onConfirmAdd,
    onCancelAdd,
    city,
    onOpenClan,
    race,
    onToast,
    newbie,
    nearestFreeRequest,
  },
  forwardedRef
) {
  // `tr`, not `t`: the carousel below names each sector `t`.
  const { t: tr, lang } = useI18n()
  // Казна only asks the server once there's something to earn from.
  const holdsSector = territories.some((s) => s.status === 'mine' || s.coHolders.some((h) => h.isMe))
  const now = useNow()
  const isHot = (s: Territory) => !!s.hotUntil && new Date(s.hotUntil).getTime() > now
  // «Кланы» layer toggle — remembered per device, a pure viewing preference.
  const [clanLayer, setClanLayer] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('range:map-clan-layer') === '1'
    } catch {
      return false
    }
  })
  function setLayer(on: boolean) {
    setClanLayer(on)
    try {
      window.localStorage.setItem('range:map-clan-layer', on ? '1' : '0')
    } catch {}
  }
  // Clans holding sectors in this city, biggest first — the clan legend.
  const clanStandings = (() => {
    if (!clanLayer) return []
    const byClan = new Map<number, { id: number; name: string; crest: unknown; count: number }>()
    for (const t of territories) {
      if (!t.ownerClanId || t.status === 'free') continue
      const entry = byClan.get(t.ownerClanId) ?? { id: t.ownerClanId, name: t.ownerClanName ?? 'Клан', crest: t.ownerClanCrest, count: 0 }
      entry.count++
      byClan.set(t.ownerClanId, entry)
    }
    return [...byClan.values()].sort((a, b) => b.count - a.count)
  })()
  const soloCount = clanLayer ? territories.filter((t) => t.status !== 'free' && t.ownerId && !t.ownerClanId).length : 0
  const mapRef = useRef<LeafletMapHandle>(null)
  const geoPermission = useGeolocationPermission()
  useImperativeHandle(forwardedRef, () => ({
    flyToTerritory: (id: string) => mapRef.current?.flyToTerritory(id),
    showUserLocation: (lat: number, lng: number) => mapRef.current?.showUserLocation(lat, lng),
    flyToLocation: (lat: number, lng: number) => mapRef.current?.flyToLocation(lat, lng),
    flyToCity: (center: [number, number], zoom: number) => mapRef.current?.flyToCity(center, zoom),
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    showTerritory: (id: string) => {
      handlePolygonSelect(id)
      mapRef.current?.flyToTerritory(id)
    },
  }))
  // Skips the fly-over on the very first render — the map already opens
  // straight at CITIES[city]'s own center/zoom (see the init effect below,
  // fallbackCenter/fallbackZoom), so there's nowhere to "arrive from" yet.
  const cityMounted = useRef(false)
  useEffect(() => {
    if (!cityMounted.current) {
      cityMounted.current = true
      return
    }
    mapRef.current?.flyToCity(CITIES[city].center, CITIES[city].zoom)
  }, [city])

  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set by a real touch/wheel gesture starting on the carousel, consumed (and
  // cleared) the next time a scroll settles — distinguishes an actual swipe
  // from the browser just firing 'scroll' because `territories` re-sorted out
  // from under the current scrollLeft (it's sorted by catch count; realtime
  // now reorders it for every connected client, not just the one who caught
  // something — see DECISIONS.md). Without this, another user's catch could
  // reshuffle the cards under a client that never touched the carousel, and
  // whichever card ended up nearest the old scrollLeft would yank their map
  // to an unrelated sector.
  const userScrollRef = useRef(false)

  // Self-contained "locate me" button — just recenters the map on the
  // visitor's position, unrelated to the "+" catch flow (no sector matching,
  // no camera). Silently no-ops on denial/error, same as the geolocation used
  // elsewhere never throws.
  async function handleLocate() {
    const coords = await getCurrentCoords()
    if (!coords) return
    mapRef.current?.showUserLocation(coords.lat, coords.lng)
    mapRef.current?.flyToLocation(coords.lat, coords.lng)
  }

  function markUserScroll() {
    userScrollRef.current = true
  }

  const [freeNav, setFreeNav] = useState<NearestFreeState | null>(null)
  const freeBusy = useRef(false)
  function showFree(id: string) {
    handlePolygonSelect(id)
    mapRef.current?.flyToTerritory(id)
  }
  async function startNearestFree() {
    if (freeBusy.current) return
    freeBusy.current = true
    const found = await findNearestFree(territories, city)
    freeBusy.current = false
    if (!found) {
      onToast?.(tr('nearest.none'))
      return
    }
    if (found.located) mapRef.current?.showUserLocation(found.origin.lat, found.origin.lng)
    else onToast?.(tr('nearest.noLocation'))
    setFreeNav(found)
    showFree(found.items[0].id)
  }
  function nextFree() {
    if (!freeNav) return
    const index = (freeNav.index + 1) % freeNav.items.length
    setFreeNav({ ...freeNav, index })
    showFree(freeNav.items[index].id)
  }
  useEffect(() => {
    if (nearestFreeRequest) void startNearestFree()
    // Only a new request runs it — not every re-render of the sectors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestFreeRequest])

  const sheetRowRef = useRef<HTMLDivElement>(null)
  // A fast fixed-duration scroll (see scrollToCardFast) barely reads as
  // "something moved" when the target card was already near the viewport —
  // the id text changing is easy to miss entirely. This flashes a ring
  // around whichever card a map tap landed on, independent of the scroll
  // itself, so the "which one did I just pick" question has an answer even
  // when the scroll distance was tiny or zero.
  const [justSelectedId, setJustSelectedId] = useState<string | null>(null)
  // Separate from justSelectedId on purpose — that one self-clears the
  // instant its one-shot pulse animation ends (see onAnimationEnd below),
  // so it can't double as "which sector is the map border highlighting"
  // for longer than that pulse lasts.
  const [highlightedSectorId, setHighlightedSectorId] = useState<string | null>(null)
  // A plain tap on a sector used to jump straight into its full screen — too
  // heavy for "just checking if there's fish there". The sheet carousel
  // below already shows exactly that summary per sector (id/status/catch
  // count), just never driven by a map tap (only the reverse: scrolling the
  // carousel flies the map, see handleScroll) — so a tap now brings that
  // card into view instead, and its own "Подробнее о секторе" button (still
  // onOpenTerritory, unchanged) is the explicit way to actually drill in.
  function handlePolygonSelect(id: string) {
    if (selectedIds && selectedIds.size > 0) {
      // Active bulk-selection (super admin, long-press to start) — a plain
      // tap toggles the selection like before, no preview involved.
      onOpenTerritory(id)
      return
    }
    // Ahead of the scroll, not as a result of it: the card has to have its
    // contents by the time the animation lands on it.
    const targetIndex = territories.findIndex((t) => t.id === id)
    if (targetIndex >= 0) setCenterIndex(targetIndex)
    const row = sheetRowRef.current
    const card = row?.querySelector<HTMLElement>(`[data-id="${id}"]`)
    if (row && card) scrollToCardFast(row, card)
    setJustSelectedId(id)
    setHighlightedSectorId(id)
  }

  // Which carousel card's contents are actually rendered (see the sheet's
  // own comment below). Updated synchronously on every scroll event, unlike
  // the debounced fly-to below — a card has to be filled in *before* it
  // scrolls into view, not 120ms after.
  const [centerIndex, setCenterIndex] = useState(0)
  const cardPitchRef = useRef(0)

  // Arithmetic rather than measuring every card: they're all `flex:0 0 100%`,
  // so one pitch (card width + row gap) describes the whole strip, and this
  // runs on each scroll event where a 560-card measuring loop would not.
  function updateCenterIndex(wrap: HTMLDivElement) {
    if (!cardPitchRef.current) {
      const first = wrap.querySelector<HTMLElement>('.map-sheet-card')
      const second = first?.nextElementSibling as HTMLElement | null
      cardPitchRef.current = first && second ? second.offsetLeft - first.offsetLeft : (first?.offsetWidth ?? 0)
    }
    const pitch = cardPitchRef.current
    if (!pitch) return
    const idx = Math.max(0, Math.min(territories.length - 1, Math.round(wrap.scrollLeft / pitch)))
    setCenterIndex((cur) => (cur === idx ? cur : idx))
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const wrap = e.currentTarget
    updateCenterIndex(wrap)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      const wasUserScroll = userScrollRef.current
      userScrollRef.current = false
      if (!wasUserScroll) return
      const cards = wrap.querySelectorAll<HTMLElement>('.map-sheet-card')
      let closest = 0
      let min = Infinity
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft - wrap.scrollLeft)
        if (d < min) {
          min = d
          closest = i
        }
      })
      const t = territories[closest]
      if (t) mapRef.current?.flyToTerritory(t.id)
    }, 120)
  }

  // The cards come freshest catch first (see useTerritories), so the most
  // caught sector is looked up rather than taken from the front. Null in an
  // empty city, so no arbitrary sector is called "most popular".
  const mostPopularId = useMemo(() => mostPopularSectorId(territories), [territories])

  return (
    <div className="screen-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {(geoPermission === 'prompt' || geoPermission === 'denied') && (
        <div className="map-geo-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>
            <path d="M12 21c-4-4.5-7-8-7-11a7 7 0 0 1 14 0c0 3-3 6.5-7 11z" />
            <circle cx="12" cy="10" r="2.3" />
          </svg>
          <div className="map-geo-banner-text">Геолокация выключена — включи её и мы найдём тебя на карте</div>
          <button className="map-geo-banner-btn tap-scale" onClick={handleLocate}>
            Разрешить
          </button>
        </div>
      )}
      <div className="map-wrap">
        <MapView
          ref={mapRef}
          territories={territories}
          myTerritoryColor={myTerritoryColor}
          onSelect={handlePolygonSelect}
          selectedIds={selectedIds}
          onLongPressTerritory={onLongPressTerritory}
          pendingAddDrafts={pendingAddDrafts}
          onLongPressEmptyMap={onLongPressEmptyMap}
          onClickEmptyMap={onClickEmptyMap}
          fallbackCenter={CITIES[city].center}
          fallbackZoom={CITIES[city].zoom}
          highlightedId={highlightedSectorId}
          clanLayer={clanLayer}
        />
        {/* Map chrome, top: ONE panel on a single edge instead of pieces
            floating at different sizes — brand + «Игроки | Кланы» on the
            first line, what the colours mean right under it, and for clan
            members the clan battle as the panel's own orange footer. */}
        <div className="map-hud">
          <div className="map-hud-bar">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, next/image's optimizer is overkill here */}
            <img src="/brand/logo_2.svg" alt="RANGE" className="map-hud-logo" />
            <TreasuryChip enabled={holdsSector} onToast={(msg) => onToast?.(msg)} />
            <div className="map-layer-switch" role="radiogroup" aria-label="Раскраска карты">
              <button type="button" role="radio" aria-checked={!clanLayer} className={`map-layer-opt${!clanLayer ? ' on' : ''}`} onClick={() => setLayer(false)}>
                Игроки
              </button>
              <button type="button" role="radio" aria-checked={clanLayer} className={`map-layer-opt${clanLayer ? ' on' : ''}`} onClick={() => setLayer(true)}>
                Кланы
              </button>
            </div>
          </div>
          {/* One line either way, so the panel keeps its height when the
              layer flips. Clans show as their crests — the same crests the
              sectors carry on that layer. */}
          <div className="map-legend-row">
            {clanLayer ? (
              <>
                {clanStandings.slice(0, 3).map((c) => (
                  <button key={c.id} className="map-legend-item map-legend-clan" onClick={() => onOpenClan?.(c.id)} title={c.name} aria-label={`${c.name}: секторов ${c.count}`}>
                    <ClanCrest crest={c.crest} size={16} />
                    <b>{c.count}</b>
                  </button>
                ))}
                {clanStandings.length === 0 && <span className="map-legend-item">Кланов пока нет</span>}
                <span className="map-legend-item">
                  <span className="legend-dot hex-aspect hex-shape" style={{ background: '#9A9CA3' }} />
                  Без клана {soloCount}
                </span>
              </>
            ) : (
              <>
                <span className="map-legend-item">
                  <span className="legend-dot hex-aspect hex-shape" style={{ background: myTerritoryColor }} />
                  Мои
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot hex-aspect hex-shape" style={{ background: 'var(--blue)' }} />
                  Чужие
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot hex-aspect hex-shape" style={{ background: '#B9BBC2' }} />
                  Свободные
                </span>
              </>
            )}
            <ForecastChip city={city} />
          </div>
          {race && !selectedIds?.size && !pendingAddDrafts?.length && <MapRacePill city={race.city} clanId={race.clanId} onOpen={race.onOpen} />}
        </div>
        {selectedIds && selectedIds.size > 0 && (
          <div className="map-selection-bar">
            <span>Выбрано: {selectedIds.size}</span>
            <button className="map-selection-bar-btn delete" onClick={onDeleteSelected}>
              Удалить
            </button>
            <button className="map-selection-bar-btn cancel" onClick={onCancelSelection}>
              Отмена
            </button>
          </div>
        )}
        {pendingAddDrafts && pendingAddDrafts.length > 0 && (
          <div className="map-selection-bar">
            <span>Новых: {pendingAddDrafts.length}</span>
            <button className="map-selection-bar-btn add" onClick={onConfirmAdd}>
              Создать
            </button>
            <button className="map-selection-bar-btn cancel" onClick={onCancelAdd}>
              Отмена
            </button>
          </div>
        )}
        <div className="map-controls">
          <div className="map-control-group">
            <button className="map-control-btn tap-scale" onClick={() => mapRef.current?.zoomIn()} aria-label="Приблизить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.3" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button className="map-control-btn tap-scale" onClick={() => mapRef.current?.zoomOut()} aria-label="Отдалить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.3" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
          <button className="map-control-btn map-control-locate tap-scale" onClick={handleLocate} aria-label="Моё местоположение">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3E7BFA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
          {newbie && (
            <button className="map-control-btn map-control-locate tap-scale" onClick={() => void startNearestFree()} aria-label={tr('nearest.button')} title={tr('nearest.button')}>
              <NearestFreeIcon />
            </button>
          )}
        </div>
        <div className="map-sheet-container">
          {freeNav && <NearestFreeCard state={freeNav} onNext={nextFree} onOpen={onOpenTerritory} onClose={() => setFreeNav(null)} />}
          <div className="map-sheet-row" ref={sheetRowRef} onScroll={handleScroll} onPointerDown={markUserScroll} onWheel={markUserScroll}>
            {territories.map((t, i) => (
              <div
                className={`map-sheet-card${t.id === justSelectedId ? ' map-sheet-card-pulse' : ''}`}
                key={t.id}
                data-id={t.id}
                onAnimationEnd={() => setJustSelectedId((cur) => (cur === t.id ? null : cur))}
              >
                {/* Every card keeps its wrapper (fixed `flex:0 0 100%` width),
                    so scroll offsets, snap points and the [data-id] lookup in
                    handlePolygonSelect are exactly what they'd be with all of
                    them filled in — only the contents are windowed. Filling
                    all ~560 cost ~5000 DOM nodes on the home screen for one
                    visible card, which is what made the map jank (and, in
                    Telegram's iOS WebView, crash) on phones. */}
                {Math.abs(i - centerIndex) <= SHEET_WINDOW && (
                <>
                {isHot(t) && (
                  <div className="map-sheet-hot">
                    <span className="map-sheet-hot-flame" aria-hidden dangerouslySetInnerHTML={{ __html: HOT_FLAME_SVG }} />
                    <b>{tr('hot.badge')}</b>
                    <span>· {tr('hot.until', { time: formatWeekdayTime(t.hotUntil!, lang) })}</span>
                    <span className="map-sheet-hot-bonus">×2</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, flex: '0 0 auto' }}>{t.id}</div>
                  {t.legendId && (
                    <span className="map-sheet-legend" title={tr('legend.title')} aria-label={tr('legend.title')}>
                      <LaurelIcon size={17} />
                    </span>
                  )}
                  {t.status !== 'free' && t.ownerDisplayName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 auto' }}>
                      {/* Shared by clan-mates: every holder's face, stacked, in
                          place of the name — four avatars and a name don't
                          fit a phone-width row (names are on the sector screen).
                          Whoever captured it last comes first. */}
                      <div
                        className="avatar-stack"
                        title={t.coHolders.length ? sectorHoldersCapturerFirst(t).map((h) => h.displayName ?? 'Рыбак').join(', ') : undefined}
                      >
                        {sectorHoldersCapturerFirst(t).map((h) => (
                          <div key={h.id} className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                            {h.avatarUrl ? <img src={thumbUrl(h.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : (h.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      {t.coHolders.length === 0 && (
                        <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.ownerDisplayName}
                        </span>
                      )}
                      {t.ownerClanCrest != null && <ClanCrest crest={t.ownerClanCrest} size={16} title={t.ownerClanName ?? undefined} />}
                    </div>
                  )}
                  {shieldBadge(t.shieldUntil)}
                  {t.id === mostPopularId && !isHot(t) && (
                    <span className="badge badge-accent" title="Самый популярный сектор" style={{ flex: '0 0 auto' }}>
                      🔥
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', flex: '0 0 auto' }}>{statusBadge(t.status, myTerritoryColor, t.coHolders.some((h) => h.isMe))}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  <span>Уловов {t.catchCount}</span>
                  <span>{t.lastCatchAt ? 'Последний улов: ' + formatWhen(t.lastCatchAt) : 'Пока нет уловов'}</span>
                </div>
                <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => onOpenTerritory(t.id)}>
                  Подробнее о секторе
                </button>
                </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
  }
)
