'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

// Purely decorative background for WelcomeStep — same Leaflet the real map
// uses (see LeafletMap.tsx), but no territory polygons/click-handlers, just
// a satellite tile layer zoomed way out for a "planet from space" look.
// Esri World Imagery is free and needs no API key, unlike the real map's
// OpenStreetMap tiles it deliberately doesn't reuse (this wants imagery, not
// a street map). scrollWheelZoom is off so it never hijacks page scroll;
// drag/pinch-zoom stay on so it's still "interactive" as asked.
export function LeafletGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    let cancelled = false
    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: false,
        preferCanvas: true,
        minZoom: 2,
        maxZoom: 6,
        worldCopyJump: true,
      })
      mapRef.current = map

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 6,
      }).addTo(map)
      L.control.attribution({ prefix: false }).addAttribution('Esri').addTo(map)

      map.setView([41.65, 41.62], 3) // Batumi, zoomed way out
    })

    let resizeObserver: ResizeObserver | null = null
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => mapRef.current?.invalidateSize())
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return <div className="onboarding-globe" ref={containerRef} />
}
