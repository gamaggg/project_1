'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { CITIES, type CityId } from '@/lib/data/city'
import { COLOR_PREVIEW_SECTORS } from '@/lib/data/colorPreviewSectors'
import { FREE_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { useSkinAssetsVersion, useSkinPatterns } from '@/lib/map/skinPattern'
import { previewTileUrl } from '@/lib/mapbox/rasterTiles'

// For ChangeColorModal: judging a color needs to see it on real sector shapes
// next to real neighbors, at the same zoom the app itself uses to show a
// neighborhood (CITIES[city].zoom) — not a single polygon fit tightly to fill
// the frame. The map/polygons are built once per city; only the demo
// polygons' fill color is patched on selection change, so tapping through
// colors restyles instantly instead of tearing down and rebuilding the map.
export function TerritoryColorPreviewMap({
  city,
  myTerritoryColor,
  equippedSkin,
}: {
  city: CityId
  myTerritoryColor: string
  equippedSkin?: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const demoLayersRef = useRef<import('leaflet').Polygon[]>([])
  const demoCornersRef = useRef<[number, number][][]>([])
  const getSkinPattern = useSkinPatterns()
  const skinAssetsVersion = useSkinAssetsVersion()
  // Each demo polygon needs its own fill: several of them share this one
  // canvas, each at its own position, and a CanvasPattern only ever paints
  // starting from one fixed anchor in that shared coordinate space — same
  // reasoning as LeafletMap.tsx's per-polygon offsetX/offsetY/hexTileWidth/
  // hexTileHeight (see useSkinPatterns' getSkinPattern and LeafletMap.tsx's
  // draw() for why both position AND size need to come from this specific
  // polygon's own corners, not a shared sample — Mercator projection can
  // render the same real-world hex at a different pixel size depending on
  // latitude).
  function computeFillStyle(corners: [number, number][]) {
    if (!equippedSkin) return myTerritoryColor
    const map = mapRef.current
    if (!map) return myTerritoryColor
    const layerPoints = corners.map(([lat, lng]) => map.latLngToLayerPoint([lat, lng]))
    const xs = layerPoints.map((p) => p.x)
    const ys = layerPoints.map((p) => p.y)
    const offsetX = Math.min(...xs)
    const offsetY = Math.min(...ys)
    const width = Math.max(...xs) - offsetX
    const height = Math.max(...ys) - offsetY
    const pattern = getSkinPattern(equippedSkin, myTerritoryColor, offsetX, offsetY, height, width)
    return pattern ?? myTerritoryColor
  }

  useEffect(() => {
    let cancelled = false
    const cityInfo = CITIES[city]
    const { demo, context } = COLOR_PREVIEW_SECTORS[city]
    import('leaflet').then((LModule) => {
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
      L.tileLayer(previewTileUrl(), { tileSize: 256 }).addTo(map)
      context.forEach((s) => {
        L.polygon(s.corners, { color: FREE_TERRITORY_COLOR, weight: 1.2, fillColor: FREE_TERRITORY_COLOR, fillOpacity: 0.14, opacity: 0.6 }).addTo(map)
      })
      demoCornersRef.current = demo.map((s) => s.corners)
      demoLayersRef.current = demo.map((s) =>
        L.polygon(s.corners, {
          color: myTerritoryColor,
          weight: 1.5,
          // A CanvasPattern is a spec-legal fillStyle value right alongside a
          // plain color string — Leaflet's types just don't know that (see
          // lib/map/skinPattern.ts / LeafletMap.tsx's own use of the trick).
          fillColor: computeFillStyle(s.corners) as unknown as string,
          fillOpacity: 0.4,
          opacity: 0.95,
        }).addTo(map)
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
  // flicker a full re-init would cause each time. Also picks up the owner's
  // equipped territory skin, if any, so this preview matches how the sector
  // actually renders on the real map (see LeafletMap.tsx).
  useEffect(() => {
    demoLayersRef.current.forEach((layer, i) => {
      const corners = demoCornersRef.current[i]
      const fillStyle = corners ? computeFillStyle(corners) : myTerritoryColor
      layer.setStyle({ color: myTerritoryColor, fillColor: fillStyle as unknown as string })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTerritoryColor, equippedSkin, skinAssetsVersion])

  return (
    <div className="territory-thumb-wrap color-preview-map">
      <div className="territory-thumb-map" ref={containerRef} />
    </div>
  )
}
