import { useEffect, useState } from 'react'
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

// Safari doesn't fire PermissionStatus 'change' for geolocation (sometimes
// doesn't even move its .state off 'prompt' after a real grant) — same gap
// CameraScreen already works around for camera access with its own
// localStorage flag. A successful fetch is itself proof access is granted,
// regardless of what the Permissions API reports, so useGeolocationPermission
// below trusts this over a live query once it's set.
const GEO_GRANTED_KEY = 'fishzone:geoGranted'
const GEO_GRANTED_EVENT = 'fishzone:geo-granted'

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
  if (position) {
    localStorage.setItem(GEO_GRANTED_KEY, '1')
    window.dispatchEvent(new Event(GEO_GRANTED_EVENT))
  }
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

export type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

// One-off, silent check of the *already-decided* permission state — unlike
// getCurrentCoords, this never triggers the native prompt (Permissions API
// query() is read-only), so it's safe to call eagerly on load without
// breaking the "geolocation only requested on-demand from '+'" decision (see
// DECISIONS.md). Used to pick the map's fallback view before any location is
// known, and to explain a denial instead of a generic failure toast.
export async function queryGeolocationPermission(): Promise<GeoPermissionState> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(GEO_GRANTED_KEY) === '1') return 'granted'
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'unsupported'
  }
}

// Live version of the above for UI that should react to a grant/revoke made
// outside the app (browser prompt, or the visitor's own site settings) —
// PermissionStatus fires 'change' for exactly that, on browsers where it
// actually fires (not Safari — see GEO_GRANTED_KEY above). A successful
// getCurrentCoords() anywhere in the app wins over whatever the Permissions
// API still reports, via the localStorage flag (checked on mount, for a
// grant from an earlier session) and a same-tab event (checked live, for a
// grant that just happened without this component remounting — e.g. the
// map's own "locate me" button).
export function useGeolocationPermission(): GeoPermissionState {
  const [granted, setGranted] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem(GEO_GRANTED_KEY) === '1')
  const [queried, setQueried] = useState<GeoPermissionState>('unsupported')

  useEffect(() => {
    function onGranted() {
      setGranted(true)
    }
    window.addEventListener(GEO_GRANTED_EVENT, onGranted)
    return () => window.removeEventListener(GEO_GRANTED_EVENT, onGranted)
  }, [])

  useEffect(() => {
    if (granted || typeof navigator === 'undefined' || !navigator.permissions?.query) return
    let cancelled = false
    let status: PermissionStatus | null = null
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (cancelled) return
        status = s
        setQueried(s.state)
        s.onchange = () => setQueried(s.state)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (status) status.onchange = null
    }
  }, [granted])

  return granted ? 'granted' : queried
}
