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

// Resolves the territory the visitor is currently standing near, or null if
// geolocation is unavailable/denied/times out/too far from any sector — never
// rejects, so callers don't need a try/catch for the "no location" case (see
// DECISIONS.md — this is asked for on-demand from the "+" button, not eagerly).
export async function findMyTerritory(territories: Territory[]): Promise<Territory | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    )
  })
  if (!position) return null

  const { latitude, longitude } = position.coords
  let closest: Territory | null = null
  let closestDist = Infinity
  for (const t of territories) {
    const d = haversineMeters(latitude, longitude, t.lat, t.lng)
    if (d < closestDist) {
      closestDist = d
      closest = t
    }
  }
  return closest && closestDist <= MAX_DISTANCE_M ? closest : null
}
