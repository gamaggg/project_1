'use client'

import 'leaflet/dist/leaflet.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef } from 'react'
import type { Territory } from '@/lib/data/types'
import { resolveTerritoryColor } from '@/lib/data/territoryColors'

// Same Mapbox basemap as LeafletMap.tsx — see that file for the trial-swap
// rationale and rollback plan.
const MAPBOX_STYLE_URL = process.env.NEXT_PUBLIC_MAPBOX_STYLE!
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// A static, single-sector preview for TerritoryScreen — not the interactive
// multi-sector LeafletMap. The number/avatar overlay is plain HTML, not a
// Leaflet marker/pane: this session already hit a Leaflet-pane z-index/
// compositing bug with screenshot-tested overlays, and since this map is
// always fit to exactly one polygon, a CSS-centered div is simpler and safe.
export function TerritoryThumbnailMap({
  territory,
  myTerritoryColor,
  ownerAvatarUrl,
  ownerInitials,
}: {
  territory: Territory
  myTerritoryColor: string
  ownerAvatarUrl?: string | null
  ownerInitials?: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([import('leaflet'), import('mapbox-gl-leaflet')]).then(([LModule]) => {
      if (cancelled || !containerRef.current) return
      // See LeafletMap.tsx's init effect for why `.default` — mapbox-gl-leaflet
      // mutates the real CJS exports object, which Turbopack's ESM namespace
      // for this import doesn't reflect.
      const L = (LModule as unknown as { default?: typeof LModule }).default ?? LModule
      const map = L.map(containerRef.current, {
        dragging: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      })
      mapRef.current = map
      L.mapboxGL({ style: MAPBOX_STYLE_URL, accessToken: MAPBOX_TOKEN }).addTo(map)
      const color = resolveTerritoryColor(territory.status, myTerritoryColor)
      const poly = L.polygon(territory.corners, {
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: territory.status === 'free' ? 0.22 : 0.32,
        opacity: 0.9,
      }).addTo(map)
      map.fitBounds(poly.getBounds(), { padding: [10, 10] })
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory.id])

  return (
    <div className="territory-thumb-wrap">
      <div className="territory-thumb-map" ref={containerRef} />
      <div className="territory-thumb-overlay">
        {territory.ownerId && (
          <div className="territory-thumb-avatar">
            {ownerAvatarUrl ? <img src={ownerAvatarUrl} alt="" /> : ownerInitials}
          </div>
        )}
        <div className="territory-thumb-label">{territory.id}</div>
      </div>
    </div>
  )
}
