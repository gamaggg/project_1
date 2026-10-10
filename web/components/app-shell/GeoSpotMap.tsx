'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { previewTileUrl } from '@/lib/mapbox/rasterTiles'

// The admin's check of a «Где это?» panorama: its sector's hexagon on a
// small static map, the spot it was taken from, and a cone for where the
// view looks — turning with the panorama, so «is the water that way?» is
// answered at a glance. Raster tiles and no interaction, like
// TerritoryThumbnailMap (no second WebGL next to the panorama's own).
export function GeoSpotMap({
  corners,
  lat,
  lng,
  bearing,
}: {
  corners: [number, number][] | null
  lat: number
  lng: number
  // Compass bearing of the view, degrees clockwise from north.
  bearing: number
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const coneRef = useRef<SVGSVGElement | null>(null)
  const bearingRef = useRef(bearing)
  const cornersKey = corners ? corners.map((c) => c.join(',')).join(';') : ''

  useEffect(() => {
    let cancelled = false
    let map: import('leaflet').Map | null = null
    let observer: ResizeObserver | null = null
    import('leaflet').then((LModule) => {
      const box = boxRef.current
      if (cancelled || !box) return
      const L = (LModule as unknown as { default?: typeof LModule }).default ?? LModule
      const m = L.map(box, {
        dragging: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
        // SVG for the one hexagon: a canvas redraw still pending when the
        // admin flips to the next panorama threw after map.remove().
        preferCanvas: false,
      })
      map = m
      L.tileLayer(previewTileUrl(), { tileSize: 256 }).addTo(m)
      const poly = corners ? L.polygon(corners, { color: '#1F8A70', weight: 2, fillColor: '#1F8A70', fillOpacity: 0.14, interactive: false }).addTo(m) : null
      // Fitted again whenever the box changes size — it may still be laid
      // out when the map starts.
      const fit = () => {
        m.invalidateSize()
        if (poly) m.fitBounds(poly.getBounds(), { padding: [8, 8] })
        else m.setView([lat, lng], 16)
      }
      fit()
      // The spot is a marker of the map itself, so it stays on its place in
      // the hexagon whatever the box does.
      const marker = L.marker([lat, lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'geo-spotmap-pin',
          iconSize: [0, 0],
          html: '<svg class="geo-spotmap-cone" viewBox="-40 -40 80 80" aria-hidden="true"><path d="M0 0 L-20 -36 A41 41 0 0 1 20 -36 Z"/></svg><span class="geo-spotmap-dot"></span>',
        }),
      }).addTo(m)
      // (Leaflet makes the marker's element once the map has a view —
      // hence after the fit.)
      coneRef.current = marker.getElement()?.querySelector('svg') ?? null
      if (coneRef.current) coneRef.current.style.transform = `rotate(${bearingRef.current}deg)`
      observer = new ResizeObserver(fit)
      observer.observe(box)
    })
    return () => {
      cancelled = true
      observer?.disconnect()
      map?.remove()
      coneRef.current = null
    }
  }, [cornersKey, lat, lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bearingRef.current = bearing
    if (coneRef.current) coneRef.current.style.transform = `rotate(${bearing}deg)`
  }, [bearing])

  return (
    <div className="geo-spotmap">
      <div className="geo-spotmap-tiles" ref={boxRef} />
    </div>
  )
}
