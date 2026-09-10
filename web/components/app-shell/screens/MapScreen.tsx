'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { MapView } from '@/components/app-shell/MapView'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import type { Territory } from '@/lib/data/types'
import { formatWhen } from '@/lib/format'
import { getCurrentCoords, useGeolocationPermission } from '@/lib/geolocation'
import { withAlpha, darkenForBadgeText } from '@/lib/data/territoryColors'

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
  },
  forwardedRef
) {
  const mapRef = useRef<LeafletMapHandle>(null)
  const geoPermission = useGeolocationPermission()
  useImperativeHandle(forwardedRef, () => ({
    flyToTerritory: (id: string) => mapRef.current?.flyToTerritory(id),
    showUserLocation: (lat: number, lng: number) => mapRef.current?.showUserLocation(lat, lng),
    flyToLocation: (lat: number, lng: number) => mapRef.current?.flyToLocation(lat, lng),
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
  }))
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
          onSelect={onOpenTerritory}
          selectedIds={selectedIds}
          onLongPressTerritory={onLongPressTerritory}
          pendingAddDrafts={pendingAddDrafts}
          onLongPressEmptyMap={onLongPressEmptyMap}
          onClickEmptyMap={onClickEmptyMap}
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
          <div className="map-sheet-row" onScroll={handleScroll} onPointerDown={markUserScroll} onWheel={markUserScroll}>
            {territories.map((t) => (
              <div className="map-sheet-card" key={t.id} data-id={t.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 21, fontWeight: 800 }}>{t.id}</div>
                  {statusBadge(t.status, myTerritoryColor)}
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  <span>Уловов {t.catchCount}</span>
                  <span>{t.lastCatchAt ? 'Последний улов: ' + formatWhen(t.lastCatchAt) : 'Пока нет уловов'}</span>
                </div>
                <button className="btn-primary" style={{ marginTop: 6 }} onClick={() => onOpenTerritory(t.id)}>
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
