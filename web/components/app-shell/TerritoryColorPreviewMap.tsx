'use client'

import 'leaflet/dist/leaflet.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef } from 'react'
import { CITIES, type CityId } from '@/lib/data/city'
import { COLOR_PREVIEW_SECTORS } from '@/lib/data/colorPreviewSectors'
import { FREE_TERRITORY_COLOR } from '@/lib/data/territoryColors'

// Same Mapbox basemap as LeafletMap.tsx/TerritoryThumbnailMap.tsx.
const MAPBOX_STYLE_URL = process.env.NEXT_PUBLIC_MAPBOX_STYLE!
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// For ChangeColorModal: judging a color needs to see it on real sector shapes
// next to real neighbors, at the same zoom the app itself uses to show a
// neighborhood (CITIES[city].zoom) — not a single polygon fit tightly to fill
// the frame. The map/polygons are built once per city; only the demo
// polygons' fill color is patched on selection change, so tapping through
// colors restyles instantly instead of tearing down and rebuilding the map.
export function TerritoryColorPreviewMap({ city, myTerritoryColor }: { city: CityId; myTerritoryColor: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const demoLayersRef = useRef<import('leaflet').Polygon[]>([])

  useEffect(() => {
    let cancelled = false
    const cityInfo = CITIES[city]
    const { demo, context } = COLOR_PREVIEW_SECTORS[city]
    Promise.all([import('leaflet'), import('mapbox-gl-leaflet')]).then(([LModule]) => {
      if (cancelled || !containerRef.current) return
      // See LeafletMap.tsx's init effect for why `.default`.
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
      }).setView(cityInfo.colorPreviewCenter, cityInfo.zoom)
      mapRef.current = map
      L.mapboxGL({ style: MAPBOX_STYLE_URL, accessToken: MAPBOX_TOKEN }).addTo(map)
      context.forEach((s) => {
        L.polygon(s.corners, { color: FREE_TERRITORY_COLOR, weight: 1.2, fillColor: FREE_TERRITORY_COLOR, fillOpacity: 0.14, opacity: 0.6 }).addTo(map)
      })
      demoLayersRef.current = demo.map((s) =>
        L.polygon(s.corners, { color: myTerritoryColor, weight: 1.5, fillColor: myTerritoryColor, fillOpacity: 0.4, opacity: 0.95 }).addTo(map)
      )
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      demoLayersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city])

  // Restyle in place on every color tap — cheap, and avoids the map-rebuild
  // flicker a full re-init would cause each time.
  useEffect(() => {
    demoLayersRef.current.forEach((layer) => layer.setStyle({ color: myTerritoryColor, fillColor: myTerritoryColor }))
  }, [myTerritoryColor])

  return (
    <div className="territory-thumb-wrap color-preview-map">
      <div className="territory-thumb-map" ref={containerRef} />
    </div>
  )
}
