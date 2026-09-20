'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MapView } from '@/components/app-shell/MapView'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import type { Territory } from '@/lib/data/types'
import { CITIES, type CityId } from '@/lib/data/city'
import { formatWhen } from '@/lib/format'
import { getCurrentCoords, useGeolocationPermission } from '@/lib/geolocation'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'

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

function statusBadge(status: Territory['status'], myTerritoryColor: string) {
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

function shieldBadge(shieldUntil: string | null) {
  if (!shieldUntil || new Date(shieldUntil) <= new Date()) return null
  return (
    <span className="badge badge-shield">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z" /></svg>
      Под щитом
    </span>
  )
}

// forwardRef so FishZoneApp can fly the map to a geolocated sector (from the
// "+" handler) even while the camera screen is showing — the map stays
// mounted the whole time, it's just visually hidden (see .screen CSS).
export const MapScreen = forwardRef<
  LeafletMapHandle,
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
  },
  forwardedRef
) {
  const mapRef = useRef<LeafletMapHandle>(null)
  const geoPermission = useGeolocationPermission()
  useImperativeHandle(forwardedRef, () => ({
    flyToTerritory: (id: string) => mapRef.current?.flyToTerritory(id),
    showUserLocation: (lat: number, lng: number) => mapRef.current?.showUserLocation(lat, lng),
    flyToLocation: (lat: number, lng: number) => mapRef.current?.flyToLocation(lat, lng),
    flyToCity: (center: [number, number], zoom: number) => mapRef.current?.flyToCity(center, zoom),
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
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
    const row = sheetRowRef.current
    const card = row?.querySelector<HTMLElement>(`[data-id="${id}"]`)
    if (row && card) scrollToCardFast(row, card)
    setJustSelectedId(id)
    setHighlightedSectorId(id)
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const wrap = e.currentTarget
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

  // territories arrives already sorted by catch count (see useTerritories),
  // so index 0 is exactly the sector shown first on open — labeling it here
  // makes that ordering visible instead of just an unexplained first card.
  // Guarded on catchCount so an empty city (everyone at 0) doesn't call some
  // arbitrary sector "most popular".
  const mostPopularId = territories[0]?.catchCount ? territories[0].id : null

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
        />
        <div className="map-header">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, next/image's optimizer is overkill here */}
          <img src="/brand/logo_2.svg" alt="RANGE" className="map-brandmark" />
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
        <div className="map-legend">
          <span>
            <span className="legend-dot hex-aspect hex-shape" style={{ background: myTerritoryColor }} />
            Моя территория
          </span>
          <span>
            <span className="legend-dot hex-aspect hex-shape" style={{ background: 'var(--blue)' }} />
            Занята другим
          </span>
          <span>
            <span className="legend-dot hex-aspect hex-shape" style={{ background: '#B9BBC2' }} />
            Свободна
          </span>
        </div>
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
        </div>
        <div className="map-sheet-container">
          <div className="map-sheet-row" ref={sheetRowRef} onScroll={handleScroll} onPointerDown={markUserScroll} onWheel={markUserScroll}>
            {territories.map((t) => (
              <div
                className={`map-sheet-card${t.id === justSelectedId ? ' map-sheet-card-pulse' : ''}`}
                key={t.id}
                data-id={t.id}
                onAnimationEnd={() => setJustSelectedId((cur) => (cur === t.id ? null : cur))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, flex: '0 0 auto' }}>{t.id}</div>
                  {t.status !== 'free' && t.ownerDisplayName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 auto' }}>
                      <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                        {t.ownerAvatarUrl ? <img src={t.ownerAvatarUrl} alt="" /> : t.ownerDisplayName.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.ownerDisplayName}
                      </span>
                    </div>
                  )}
                  {shieldBadge(t.shieldUntil)}
                  {t.id === mostPopularId && <span className="badge badge-accent">🔥 Самый популярный</span>}
                  <div style={{ marginLeft: 'auto', flex: '0 0 auto' }}>{statusBadge(t.status, myTerritoryColor)}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  <span>Уловов {t.catchCount}</span>
                  <span>{t.lastCatchAt ? 'Последний улов: ' + formatWhen(t.lastCatchAt) : 'Пока нет уловов'}</span>
                </div>
                <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => onOpenTerritory(t.id)}>
                  Подробнее о секторе
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
  }
)
