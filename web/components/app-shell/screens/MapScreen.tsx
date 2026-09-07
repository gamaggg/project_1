'use client'

import { useRef } from 'react'
import { MapView } from '@/components/app-shell/MapView'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import type { Territory } from '@/lib/data/types'
import { KIND_LABEL } from '@/lib/data/species'
import { formatWhen } from '@/lib/format'

function statusBadge(status: Territory['status']) {
  if (status === 'mine') return <span className="badge badge-green">Моя территория</span>
  if (status === 'other') return <span className="badge badge-blue">Занята</span>
  return <span className="badge badge-neutral">Свободна</span>
}

export function MapScreen({
  territories,
  onOpenTerritory,
}: {
  territories: Territory[]
  onOpenTerritory: (id: string) => void
}) {
  const mapRef = useRef<LeafletMapHandle>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      <div className="map-header">
        <div className="brandmark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 17c3-5 6-7.5 9-7.5s6 2.5 9 7.5" stroke="#FC5200" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M3 12.5c3-5 6-7.5 9-7.5s6 2.5 9 7.5" stroke="#FC5200" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
          </svg>
          <span>FishZone</span>
        </div>
        <div className="page-title">Карта</div>
        <div className="page-sub">Аджария</div>
      </div>
      <div className="map-wrap">
        <MapView ref={mapRef} territories={territories} onSelect={onOpenTerritory} />
        <div className="map-legend">
          <span>
            <span className="legend-dot" style={{ background: 'var(--green)' }} />
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
        <div className="map-sheet-container">
          <div className="map-sheet-row" onScroll={handleScroll}>
            {territories.map((t) => (
              <div className="map-sheet-card" key={t.id} data-id={t.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {statusBadge(t.status)}
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>≈600 м</span>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>Сектор {t.id}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>{KIND_LABEL[t.kind]}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  <span>Уловов {t.catchCount}</span>
                  <span>{t.lastCatchAt ? 'Последний улов: ' + formatWhen(t.lastCatchAt) : 'Пока нет уловов'}</span>
                </div>
                <button className="btn-primary" onClick={() => onOpenTerritory(t.id)}>
                  {t.status === 'mine' ? 'Перейти к рыбалке' : t.status === 'other' ? 'Посмотреть территорию' : 'Занять территорию'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
