import type { Territory } from '@/lib/data/types'

const MAX_DISTANCE_M = 400 // half the 600m hex width, plus slack for GPS error

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const a = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export type Coords = { lat: number; lng: number }

// Wraps getCurrentPosition in a promise; never rejects — null on denial/timeout/
// unavailable API, so callers don't need a try/catch for the "no location" case
// (see DECISIONS.md — asked for on-demand from the "+" button, not eagerly).
export async function getCurrentCoords(): Promise<Coords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    )
  })
  return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null
}

// Territory whose center is within MAX_DISTANCE_M of the given point, or null if
// the visitor isn't standing on any sector — separate from getCurrentCoords so the
// caller can show the raw position (map marker) even when it matches no sector.
export function nearestTerritory(lat: number, lng: number, territories: Territory[]): Territory | null {
  let closest: Territory | null = null
  let closestDist = Infinity
  for (const t of territories) {
    const d = haversineMeters(lat, lng, t.lat, t.lng)
    if (d < closestDist) {
      closestDist = d
      closest = t
    }
  }
  return closest && closestDist <= MAX_DISTANCE_M ? closest : null
}
