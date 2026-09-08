'use client'

import 'leaflet/dist/leaflet.css'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type L from 'leaflet'
import type { Territory } from '@/lib/data/types'
import { resolveTerritoryColor } from '@/lib/data/territoryColors'

export type LeafletMapHandle = {
  flyToTerritory: (id: string) => void
  showUserLocation: (lat: number, lng: number) => void
  flyToLocation: (lat: number, lng: number) => void
  zoomIn: () => void
  zoomOut: () => void
}

const LABEL_MIN_ZOOM = 14

// Ported from fishzone-app.html initMap()/drawTerritories() — see DECISIONS.md for
// why preferCanvas + the zoom-gated labelsLayer exist (703 sectors across all of
// Adjara's coast; SVG-per-polygon and always-on labels were measured as a problem).
export const LeafletMap = forwardRef<
  LeafletMapHandle,
  { territories: Territory[]; myTerritoryColor: string; onSelect: (id: string) => void }
>(function LeafletMap({ territories, myTerritoryColor, onSelect }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const leafletRef = useRef<typeof import('leaflet') | null>(null)
    const markersLayerRef = useRef<L.LayerGroup | null>(null)
    const labelsLayerRef = useRef<L.LayerGroup | null>(null)
    const userMarkerRef = useRef<L.Marker | null>(null)
    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect

    function draw(territories: Territory[]) {
      const L = leafletRef.current
      const markersLayer = markersLayerRef.current
      const labelsLayer = labelsLayerRef.current
      if (!L || !markersLayer || !labelsLayer) return
      markersLayer.clearLayers()
      labelsLayer.clearLayers()
      territories.forEach((t) => {
        const color = resolveTerritoryColor(t.status, myTerritoryColor)
        const poly = L.polygon(t.corners, {
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: t.status === 'free' ? 0.22 : 0.32,
          opacity: 0.9,
        }).addTo(markersLayer)
        poly.on('click', () => onSelectRef.current(t.id))
        L.marker([t.lat, t.lng], {
          icon: L.divIcon({ className: 'leaflet-territory-label', html: t.id, iconSize: [38, 16] }),
          interactive: false,
        }).addTo(labelsLayer)
      })
    }

    useImperativeHandle(ref, () => ({
      flyToTerritory(id: string) {
        const map = mapRef.current
        const t = territories.find((x) => x.id === id)
        if (!map || !t) return
        const targetZoom = Math.max(map.getZoom(), 16.5)
        map.flyTo([t.lat, t.lng], targetZoom, { duration: 0.5 })
      },
      // Places (or moves) a marker at the visitor's real GPS position — shown
      // once geolocation succeeds, regardless of whether it lands on a sector
      // (see DECISIONS.md, "+" flow). Kept outside markersLayer so redrawing
      // sector polygons on ownership changes doesn't clear it.
      showUserLocation(lat: number, lng: number) {
        const L = leafletRef.current
        const map = mapRef.current
        if (!L || !map) return
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng])
          return
        }
        userMarkerRef.current = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'user-location-icon',
            html: '<div class="user-location-pulse"></div><div class="user-location-dot"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          interactive: false,
          zIndexOffset: 1000,
        }).addTo(map)
      },
      flyToLocation(lat: number, lng: number) {
        const map = mapRef.current
        if (!map) return
        const targetZoom = Math.max(map.getZoom(), 16.5)
        map.flyTo([lat, lng], targetZoom, { duration: 0.5 })
      },
      zoomIn() {
        mapRef.current?.zoomIn()
      },
      zoomOut() {
        mapRef.current?.zoomOut()
      },
    }))

    // Init once. Deliberately not re-run on territory changes.
    useEffect(() => {
      let cancelled = false
      import('leaflet').then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        leafletRef.current = L

        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
        })
        mapRef.current = map

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          subdomains: 'abc',
          maxZoom: 19,
        }).addTo(map)
        L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        labelsLayerRef.current = L.layerGroup()

        // 703 sectors span all of Adjara's coast — fitBounds alone leaves the
        // initial view zoomed out very far. +log2(3) zoom levels triples the
        // map scale (each Leaflet zoom level doubles it) while keeping the
        // same center, so the view opens noticeably closer without hardcoding
        // a fixed zoom that would ignore actual bounds/screen size.
        const bounds = L.latLngBounds(territories.flatMap((t) => t.corners))
        if (bounds.isValid()) {
          const fitZoom = map.getBoundsZoom(bounds, false, L.point(36, 36))
          map.setView(bounds.getCenter(), fitZoom + Math.log2(3))
        }

        function updateLabelVisibility() {
          const show = map.getZoom() >= LABEL_MIN_ZOOM
          if (show && !map.hasLayer(labelsLayerRef.current!)) labelsLayerRef.current!.addTo(map)
          if (!show && map.hasLayer(labelsLayerRef.current!)) map.removeLayer(labelsLayerRef.current!)
        }
        map.on('zoomend', updateLabelVisibility)

        draw(territories)
        updateLabelVisibility()
      })

      // The container's real size can still change after Leaflet reads it once —
      // e.g. next/font finishes loading Manrope and the header text reflows,
      // shifting .map-wrap's height. Without this, the canvas/tile grid stays
      // sized for the stale layout and renders offset from the visible box
      // (confirmed in production: canvas painted correctly, just not where the
      // container ended up). ResizeObserver catches that and any future case
      // (orientation change, etc.), not just the font-load race.
      let resizeObserver: ResizeObserver | null = null
      if (containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          mapRef.current?.invalidateSize()
        })
        resizeObserver.observe(containerRef.current)
      }

      return () => {
        cancelled = true
        resizeObserver?.disconnect()
        mapRef.current?.remove()
        mapRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Redraw polygons/labels when ownership/status changes, without touching
    // bounds/zoom — intentionally decoupled from the carousel, see DECISIONS.md
    // (flyTo -> zoomend -> full redraw used to reset carousel scroll -> flyTo loop).
    useEffect(() => {
      if (!mapRef.current) return
      draw(territories)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [territories, myTerritoryColor])

    return <div id="leafletMap" ref={containerRef} />
  }
)
