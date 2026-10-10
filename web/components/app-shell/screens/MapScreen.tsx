'use client'

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFirstSteps } from '@/lib/supabase/queries'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { MapView } from '@/components/app-shell/MapView'
import type { GeoMarks, LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import type { Territory } from '@/lib/data/types'
import { CITIES, cityForSectorId, type CityId } from '@/lib/data/city'
import { formatWhen } from '@/lib/format'
import { getCurrentCoords, nearestTerritory, useGeolocationPermission, watchLiveLocation, type Coords } from '@/lib/geolocation'
import { observeScreenActive } from '@/lib/observeScreenActive'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { DefenseShields } from '@/components/app-shell/SectorDefense'
import { FirstStepsPill } from '@/components/app-shell/FirstSteps'
import { ForecastChip } from '@/components/app-shell/BiteForecast'
import { RecapBanner } from '@/components/recap/WeekRecap'
import { NearestFreeCard, NearestFreeIcon, findNearestFree, type NearestFreeState } from '@/components/app-shell/NearestFree'
import { sectorHoldersCapturerFirst } from '@/lib/data/sectorHolders'
import { mostPopularSectorId } from '@/lib/data/sectorOrder'
import { MapRacePill } from '@/components/app-shell/ClanRace'
import { TreasuryChip } from '@/components/app-shell/TreasuryChip'
import { SlotsSticker } from '@/components/app-shell/SlotsSticker'
import { GeoSticker } from '@/components/app-shell/GeoSticker'
import { HudBoosts } from '@/components/app-shell/HudBoosts'
import { HOT_FLAME_SVG } from '@/lib/map/hotFlame'
import { useI18n } from '@/lib/i18n'
import { formatWeekdayTime } from '@/lib/i18n/format'
import { useNow } from '@/lib/useNow'

function statusBadge(status: Territory['status'], myTerritoryColor: string, myShare = false) {
  // myShare: a clan-mate's sector the viewer holds a part of.
  if (status === 'mine' || myShare)
    return (
      <span className="badge" style={{ background: withAlpha(myTerritoryColor, 0.16), color: darkenForBadgeText(myTerritoryColor) }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" /></svg>
        {status === 'mine' ? 'Моя' : 'Моя доля'}
      </span>
    )
  // Someone else's: no pill — their face beside the id already says it, and
  // the pill was what squeezed that name out of a phone-width row.
  if (status === 'other') return null
  return <span className="badge badge-neutral">Свободна</span>
}

// Under a shield: the icon and how long is left («18 ч»), not «Под щитом» —
// the words took the room the owner's name needs.
function shieldBadge(shieldUntil: string | null) {
  const left = shieldUntil ? new Date(shieldUntil).getTime() - Date.now() : 0
  if (left <= 0) return null
  const minutes = Math.max(1, Math.ceil(left / 60_000))
  const time = minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч`
  return (
    <span className="badge badge-shield" style={{ flex: '0 0 auto' }} title="Под щитом">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z" /></svg>
      {time}
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
    // A tap on a holder's face (or the owner's name) on the sector card.
    onOpenUser: (id: string) => void
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
    // The slots sticker (SlotsSticker) opens the slots screen.
    onOpenSlots?: () => void
    // The «Где это?» sticker (GeoSticker) opens the game.
    onOpenGeo?: () => void
    // No catches yet: the «Ближайший свободный сектор» button shows.
    newbie?: boolean
    // Bumped by the onboarding's last step («Найти свободный сектор рядом»)
    // to run the same search as the button once the map is up.
    nearestFreeRequest?: number
    // Catches saved without a connection, still waiting to go out.
    offlinePending?: { count: number; syncing: boolean }
    // «Где это?» played on this map (GeoMapOverlay): a tap picks the sector
    // instead of opening its card, the map's own chrome steps aside, and
    // the picked / right sectors are drawn on it.
    geo?: (GeoMarks & { onPick?: (id: string) => void }) | null
  }
>(function MapScreen(
  {
    territories,
    myTerritoryColor,
    onOpenTerritory,
    onOpenUser,
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
    onOpenSlots,
    onOpenGeo,
    newbie,
    nearestFreeRequest,
    offlinePending,
    geo = null,
  },
  forwardedRef
) {
  // `tr`, not `t`: the carousel below names each sector `t`.
  const { t: tr, lang } = useI18n()
  // Казна only asks the server once there's something to earn from.
  const holdsSector = territories.some((s) => s.status === 'mine' || s.coHolders.some((h) => h.isMe))
  const now = useNow()
  const { data: firstSteps } = useFirstSteps()
  const firstStepsShown = !!firstSteps && firstSteps.eligible && !firstSteps.claimed
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
  // The dot on the map follows the player while the map is the screen in
  // front (the GPS is let go on every other screen and in the background).
  const rootRef = useRef<HTMLDivElement>(null)
  const [mapActive, setMapActive] = useState(true)
  useEffect(() => (rootRef.current ? observeScreenActive(rootRef.current, setMapActive) : undefined), [])
  // The sector the player is standing in, if any — its card goes first (no
  // label on it: the outline on the map and the player's dot say it). Otherwise the sheet opens on the freshest catch, the
  // order useTerritories already gives. A new fix only moves the dot; the
  // screen re-renders when the sector itself changes.
  const [hereId, setHereId] = useState<string | null>(null)
  const lastFixRef = useRef<Coords | null>(null)
  const territoriesRef = useRef(territories)
  territoriesRef.current = territories
  useEffect(() => {
    if (!mapActive) return
    return watchLiveLocation((c) => {
      lastFixRef.current = c
      mapRef.current?.showUserLocation(c.lat, c.lng)
      setHereId(nearestTerritory(c.lat, c.lng, territoriesRef.current)?.id ?? null)
    })
  }, [mapActive])
  useEffect(() => {
    const c = lastFixRef.current
    if (c) setHereId(nearestTerritory(c.lat, c.lng, territories)?.id ?? null)
  }, [territories])
  const cards = useMemo(() => {
    const here = hereId ? territories.find((t) => t.id === hereId) : undefined
    return here ? [here, ...territories.filter((t) => t.id !== hereId)] : territories
  }, [territories, hereId])
  useImperativeHandle(forwardedRef, () => ({
    flyToTerritory: (id: string) => mapRef.current?.flyToTerritory(id),
    showUserLocation: (lat: number, lng: number) => mapRef.current?.showUserLocation(lat, lng),
    flyToLocation: (lat: number, lng: number) => mapRef.current?.flyToLocation(lat, lng),
    flyToCity: (center: [number, number], zoom: number) => mapRef.current?.flyToCity(center, zoom),
    flyToView: (center: [number, number], zoom: number) => mapRef.current?.flyToView(center, zoom),
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    focusTerritories: (ids: string[]) => mapRef.current?.focusTerritories(ids),
    showArea: (points: [number, number][], minZoom: number) => mapRef.current?.showArea(points, minZoom),
    territoriesOutline: (ids: string[]) => mapRef.current?.territoriesOutline(ids) ?? null,
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

  // When the player last picked a sector —
  // walking into another sector doesn't yank the sheet away from that.
  const lastBrowseRef = useRef(0)

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

  // A ring flashed round the card when a map tap changes it, on top of the
  // contents' own change — «which one did I just pick» answered either way.
  const [justSelectedId, setJustSelectedId] = useState<string | null>(null)
  // Separate from justSelectedId on purpose — that one self-clears the
  // instant its one-shot pulse animation ends (see onAnimationEnd below),
  // so it can't double as "which sector is the map border highlighting"
  // for longer than that pulse lasts.
  const [highlightedSectorId, setHighlightedSectorId] = useState<string | null>(null)
  // A plain tap on a sector used to jump straight into its full screen — too
  // heavy for "just checking if there's fish there". It puts that sector on
  // the card at the bottom instead (id, holder, catches), and the card's own
  // "Подробнее о секторе" (onOpenTerritory) is the way in.
  function handlePolygonSelect(id: string) {
    if (geo) {
      geo.onPick?.(id)
      return
    }
    if (selectedIds && selectedIds.size > 0) {
      // Active bulk-selection (super admin, long-press to start) — a plain
      // tap toggles the selection like before, no preview involved.
      onOpenTerritory(id)
      return
    }
    lastBrowseRef.current = Date.now()
    setShownId(id)
    setJustSelectedId(id)
    setHighlightedSectorId(id)
  }

  // Walking into a sector (or out of every one) brings the sheet back to its
  // first card — the sector you're in, or the freshest catch — and outlines
  // it on the map, unless you've been browsing the cards in the last minute.
  useEffect(() => {
    if (Date.now() - lastBrowseRef.current < 60_000) return
    setShownId(null)
    setHighlightedSectorId(hereId)
  }, [hereId])

  // The one sector on the card: the one tapped on the map, or (null) the
  // first in line — the sector you're in, or the freshest catch.
  const [shownId, setShownId] = useState<string | null>(null)
  const shown = (shownId ? cards.find((t) => t.id === shownId) : undefined) ?? cards[0]
  const shownCards = shown ? [shown] : []
  // The card's height follows its contents (a hot sector has a line more):
  // eased from the old height to the new one instead of jumping.
  const cardRef = useRef<HTMLDivElement>(null)
  const cardHeightRef = useRef(0)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const prev = cardHeightRef.current
    const next = el.offsetHeight
    cardHeightRef.current = next
    if (prev && Math.abs(prev - next) > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ height: `${prev}px`, overflow: 'hidden' }, { height: `${next}px`, overflow: 'hidden' }], { duration: 280, easing: 'cubic-bezier(.23,1,.32,1)' })
    }
  }, [shown?.id])

  // The cards come freshest catch first (see useTerritories), so the most
  // caught sector is looked up rather than taken from the front. Null in an
  // empty city, so no arbitrary sector is called "most popular".
  const mostPopularId = useMemo(() => mostPopularSectorId(territories), [territories])

  return (
    <div ref={rootRef} className={`screen-inner${geo ? ' map-geo-mode' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
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
          geo={geo ? { picked: geo.picked, answer: geo.answer, spot: geo.spot, dim: geo.dim } : null}
        />
        {/* Map chrome, top: ONE panel on a single edge instead of pieces
            floating at different sizes — brand + «Игроки | Кланы» on the
            first line, what the colours mean right under it, and for clan
            members the clan battle as the panel's own orange footer. */}
        <div className="map-hud" data-tour="map-hud">
          <div className="map-hud-bar">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, next/image's optimizer is overkill here */}
            <img src="/brand/logo_2.svg" alt="RANGE" className="map-hud-logo" />
            <TreasuryChip enabled={holdsSector} onToast={(msg) => onToast?.(msg)} />
            <HudBoosts />
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
          <div data-tour="legend" className="map-legend-row">
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
            <button data-tour="nearest" className="map-control-btn map-control-locate tap-scale" onClick={() => void startNearestFree()} aria-label={tr('nearest.button')} title={tr('nearest.button')}>
              <NearestFreeIcon />
            </button>
          )}
        </div>
        <div className="map-sheet-container">
          {offlinePending && offlinePending.count > 0 && (
            <div className="offline-pill" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 7.9" />
                <path d="M12 13v8M9 18l3 3 3-3" />
              </svg>
              <span className="offline-pill-text">
                <b>{tr('offline.pending', { count: offlinePending.count })}</b>
                <span>{offlinePending.syncing ? tr('offline.sending') : tr('offline.pendingSub')}</span>
              </span>
            </div>
          )}
          {freeNav ? (
            <NearestFreeCard state={freeNav} onNext={nextFree} onOpen={onOpenTerritory} onClose={() => setFreeNav(null)} />
          ) : (
            // The «Неделя» sticker on the left, «Первые шаги» on the right —
            // one row, so neither pushes the other up over the map.
            <div className="map-sheet-extras">
              {!selectedIds?.size && !pendingAddDrafts?.length && <RecapBanner city={city} onFindFree={() => void startNearestFree()} />}
              {/* Newcomers have «Первые шаги» on this row instead — two
                  stickers and the pill don't fit side by side. */}
              {!selectedIds?.size && !pendingAddDrafts?.length && !firstStepsShown && onOpenSlots && <SlotsSticker city={city} onOpen={onOpenSlots} />}
              {!selectedIds?.size && !pendingAddDrafts?.length && !firstStepsShown && onOpenGeo && <GeoSticker onOpen={onOpenGeo} />}
              <FirstStepsPill onToast={onToast} />
            </div>
          )}
          {/* One card, no strip to swipe: a map tap changes what it shows,
              the card itself stays put and its contents cross over. */}
          <div className="map-sheet-row">
            {shownCards.map((t) => (
              <div
                ref={cardRef}
                data-tour="sector-card" className={`map-sheet-card${t.id === justSelectedId ? ' map-sheet-card-pulse' : ''}`}
                key="card"
                data-id={t.id}
                onAnimationEnd={(e) => {
                  if (e.target === e.currentTarget) setJustSelectedId((cur) => (cur === t.id ? null : cur))
                }}
              >
                <div key={t.id} className="map-sheet-card-body">
                {isHot(t) && (
                  <div className="map-sheet-hot">
                    <span className="map-sheet-hot-flame" aria-hidden dangerouslySetInnerHTML={{ __html: HOT_FLAME_SVG }} />
                    <b>{tr('hot.badge')}</b>
                    <span>· {tr('hot.until', { time: formatWeekdayTime(t.hotUntil!, lang, CITIES[cityForSectorId(t.id)].timezone) })}</span>
                    <span className="map-sheet-hot-bonus">×2</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, flex: '0 0 auto' }}>{t.id}</div>
                  {t.status !== 'free' && t.ownerDisplayName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 auto' }}>
                      {/* Shared by clan-mates: every holder's face, stacked, in
                          place of the name — four avatars and a name don't
                          fit a phone-width row (names are on the sector screen).
                          Whoever captured it last comes first. A face (or the
                          owner's name) opens that player's profile. */}
                      {t.coHolders.length === 0 ? (
                        <button type="button" className="map-sheet-owner" onClick={() => onOpenUser(t.ownerId!)}>
                          <span className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                            {t.ownerAvatarUrl ? <img src={thumbUrl(t.ownerAvatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : t.ownerDisplayName.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="map-sheet-owner-name">{t.ownerDisplayName}</span>
                        </button>
                      ) : (
                        <div className="avatar-stack" title={sectorHoldersCapturerFirst(t).map((h) => h.displayName ?? 'Рыбак').join(', ')}>
                          {sectorHoldersCapturerFirst(t).map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              className="avatar map-sheet-holder"
                              style={{ width: 24, height: 24, fontSize: 10 }}
                              aria-label={h.displayName ?? 'Рыбак'}
                              onClick={() => onOpenUser(h.id)}
                            >
                              {h.avatarUrl ? <img src={thumbUrl(h.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : (h.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
                            </button>
                          ))}
                        </div>
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
                  {/* Only when there's a pill to show: an empty wrapper (someone
                      else's sector has none) kept the shield a gap off the edge. */}
                  {(t.status !== 'other' || t.coHolders.some((h) => h.isMe)) && (
                    <div style={{ marginLeft: 'auto', flex: '0 0 auto' }}>{statusBadge(t.status, myTerritoryColor, t.coHolders.some((h) => h.isMe))}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  <span style={{ flex: '0 0 auto' }}>Уловов {t.catchCount}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.lastCatchAt ? 'Последний: ' + formatWhen(t.lastCatchAt) : 'Пока нет уловов'}
                  </span>
                  {t.status !== 'free' && (
                    // Optically, not geometrically, flush with the badges above: a
                    // pill's round end reads ~3px further in than its box, the
                    // shields' straight side doesn't — so the shields step in too.
                    <span style={{ marginLeft: 'auto', marginRight: 3, flex: '0 0 auto', display: 'flex' }}>
                      <DefenseShields value={t.defense} size={16} />
                    </span>
                  )}
                </div>
                <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => onOpenTerritory(t.id)}>
                  Подробнее о секторе
                </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
  }
)
