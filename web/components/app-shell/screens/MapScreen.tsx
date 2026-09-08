'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { MapView } from '@/components/app-shell/MapView'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import type { Territory } from '@/lib/data/types'
import { formatWhen } from '@/lib/format'
import { getCurrentCoords } from '@/lib/geolocation'
import { withAlpha } from '@/lib/data/territoryColors'

function statusBadge(status: Territory['status'], myTerritoryColor: string) {
  if (status === 'mine')
    return (
      <span className="badge" style={{ background: withAlpha(myTerritoryColor, 0.16), color: myTerritoryColor }}>
        Моя территория
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
  { territories: Territory[]; myTerritoryColor: string; onOpenTerritory: (id: string) => void }
>(function MapScreen({ territories, myTerritoryColor, onOpenTerritory }, forwardedRef) {
  const mapRef = useRef<LeafletMapHandle>(null)
  useImperativeHandle(forwardedRef, () => ({
    flyToTerritory: (id: string) => mapRef.current?.flyToTerritory(id),
    showUserLocation: (lat: number, lng: number) => mapRef.current?.showUserLocation(lat, lng),
    flyToLocation: (lat: number, lng: number) => mapRef.current?.flyToLocation(lat, lng),
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
  }))
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const wrap = e.currentTarget
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
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
      <div className="map-wrap">
        <MapView ref={mapRef} territories={territories} myTerritoryColor={myTerritoryColor} onSelect={onOpenTerritory} />
        <div className="map-header">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, next/image's optimizer is overkill here */}
          <img src="/brand/logo_2.svg" alt="RANGE" className="map-brandmark" />
        </div>
        <div className="map-legend">
          <span>
            <span className="legend-dot" style={{ background: myTerritoryColor }} />
            Моя территория
          </span>
          <span>
            <span className="legend-dot" style={{ background: 'var(--blue)' }} />
            Занята другим
          </span>
          <span>
            <span className="legend-dot" style={{ background: '#B9BBC2' }} />
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
          <div className="map-sheet-row" onScroll={handleScroll}>
            {territories.map((t) => (
              <div className="map-sheet-card" key={t.id} data-id={t.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>Сектор {t.id}</div>
                  {statusBadge(t.status, myTerritoryColor)}
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  <span>Уловов {t.catchCount}</span>
                  <span>{t.lastCatchAt ? 'Последний улов: ' + formatWhen(t.lastCatchAt) : 'Пока нет уловов'}</span>
                </div>
                <button className="btn-primary" onClick={() => onOpenTerritory(t.id)}>
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
