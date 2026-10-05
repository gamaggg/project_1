'use client'

import { useState } from 'react'
import { RouteModal } from '@/components/app-shell/RouteModal'
import { CITIES, type CityId } from '@/lib/data/city'
import { getCurrentCoords, haversineMeters, type Coords } from '@/lib/geolocation'
import { useI18n } from '@/lib/i18n'
import type { Territory } from '@/lib/data/types'

export type NearestFreeItem = { id: string; lat: number; lng: number; dist: number }
export type NearestFreeState = { items: NearestFreeItem[]; index: number; origin: Coords; located: boolean }

// «Ближайший свободный сектор» for someone who hasn't caught anything yet:
// the ten free sectors closest to where they stand (or to the city centre
// when location is off), nearest first. Null when every sector is taken.
export async function findNearestFree(territories: Territory[], city: CityId): Promise<NearestFreeState | null> {
  const coords = await getCurrentCoords()
  const origin = coords ?? { lat: CITIES[city].center[0], lng: CITIES[city].center[1] }
  const items = territories
    .filter((t) => t.status === 'free')
    .map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, dist: haversineMeters(origin.lat, origin.lng, t.lat, t.lng) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 10)
  if (!items.length) return null
  return { items, index: 0, origin, located: !!coords }
}

export function NearestFreeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2.8l7.8 4.5v9L12 20.8l-7.8-4.5v-9z" />
      <path d="M12 8.5v7M8.5 12h7" stroke="#FC5200" strokeWidth="2.3" />
    </svg>
  )
}

export function NearestFreeCard({
  state,
  onNext,
  onOpen,
  onClose,
}: {
  state: NearestFreeState
  onNext: () => void
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const { t, lang } = useI18n()
  const [routeOpen, setRouteOpen] = useState(false)
  const item = state.items[state.index]
  const fmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 })
  const distance =
    item.dist < 1000 ? t('nearest.meters', { value: Math.round(item.dist / 10) * 10 }) : t('nearest.km', { value: fmt.format(item.dist / 1000) })

  return (
    <div className="nearest-free-card">
      <button className="nearest-free-close tap-scale" onClick={onClose} aria-label={t('route.cancel')}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div className="nearest-free-kicker">
        {t('nearest.kicker')}
        {state.items.length > 1 && <span> · {t('nearest.position', { n: state.index + 1, total: state.items.length })}</span>}
      </div>
      <button className="nearest-free-main" onClick={() => onOpen(item.id)}>
        <b>{item.id}</b>
        <span className="nearest-free-status">{t('nearest.free')}</span>
        <span className="nearest-free-dist">
          {distance}
          {!state.located && <> {t('nearest.fromCenter')}</>}
        </span>
      </button>
      <div className="nearest-free-hint">{t('nearest.hint')}</div>
      <div className="nearest-free-actions">
        <button className="nearest-free-btn primary tap-scale" onClick={() => setRouteOpen(true)}>
          {t('nearest.route')}
        </button>
        {state.items.length > 1 && (
          <button className="nearest-free-btn tap-scale" onClick={onNext}>
            {t('nearest.next')}
          </button>
        )}
      </div>
      {routeOpen && <RouteModal lat={item.lat} lng={item.lng} onClose={() => setRouteOpen(false)} />}
    </div>
  )
}
