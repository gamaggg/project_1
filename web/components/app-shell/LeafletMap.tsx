'use client'

import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type L from 'leaflet'
import type { Territory } from '@/lib/data/types'
import { resolveTerritoryColor } from '@/lib/data/territoryColors'

// OpenFreeMap's "Bright" style — free, no API key, no request quota (unlike
// tile.openstreetmap.org, which OSM's own usage policy says isn't meant for
// production traffic at our scale). Pinned to maplibre-gl v5, not v6: v6's
// worker is a real ESM module file that imports a sibling file by relative
// path, which Turbopack (this project's default bundler, see AGENTS.md)
// doesn't emit correctly — the map mounts but no tile ever loads. v5's older
// worker doesn't have that sibling-file dependency, so it isn't hit. See
// DECISIONS.md.
const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

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
  {
    territories: Territory[]
    myTerritoryColor: string
    onSelect: (id: string) => void
    selectedIds?: Set<string>
    onLongPressTerritory?: (id: string) => void
    pendingAddDrafts?: { corners: [number, number][] }[]
    onLongPressEmptyMap?: (lat: number, lng: number) => void
    onClickEmptyMap?: (lat: number, lng: number) => void
  }
>(function LeafletMap(
  { territories, myTerritoryColor, onSelect, selectedIds, onLongPressTerritory, pendingAddDrafts, onLongPressEmptyMap, onClickEmptyMap },
  ref
) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const leafletRef = useRef<typeof import('leaflet') | null>(null)
    const markersLayerRef = useRef<L.LayerGroup | null>(null)
    const labelsLayerRef = useRef<L.LayerGroup | null>(null)
    const userMarkerRef = useRef<L.Marker | null>(null)
    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect
    const onLongPressRef = useRef(onLongPressTerritory)
    onLongPressRef.current = onLongPressTerritory
    const onLongPressEmptyMapRef = useRef(onLongPressEmptyMap)
    onLongPressEmptyMapRef.current = onLongPressEmptyMap
    const onClickEmptyMapRef = useRef(onClickEmptyMap)
    onClickEmptyMapRef.current = onClickEmptyMap
    // Shared across every polygon (not per-polygon) so a press started on one
    // sector and cancelled by, say, the map starting to pan can be cleared
    // from a single map-level listener instead of one per polygon.
    const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Mirrors the per-polygon longPressFired flag, but for the map's own
    // empty-space gesture — swallows the trailing 'click' Leaflet fires on
    // release right after a long-press already handled it.
    const emptyMapLongPressFiredRef = useRef(false)

    function draw(territories: Territory[]) {
      const L = leafletRef.current
      const markersLayer = markersLayerRef.current
      const labelsLayer = labelsLayerRef.current
      if (!L || !markersLayer || !labelsLayer) return
      markersLayer.clearLayers()
      labelsLayer.clearLayers()
      // Preview of sectors an admin is about to create (see
      // onLongPressEmptyMap below) — plain non-interactive outlines, dashed
      // to read as "not committed yet", drawn first so real sector polygons
      // (drawn next) still win on click if a preview happens to overlap one.
      pendingAddDrafts?.forEach((draft) => {
        L.polygon(draft.corners, {
          color: '#2E7D32',
          weight: 2,
          dashArray: '4 4',
          fillColor: '#2E7D32',
          fillOpacity: 0.35,
          interactive: false,
        }).addTo(markersLayer)
      })
      territories.forEach((t) => {
        const isSelectedForDeletion = selectedIds?.has(t.id) ?? false
        const color = isSelectedForDeletion ? '#D33' : resolveTerritoryColor(t.status, myTerritoryColor)
        const poly = L.polygon(t.corners, {
          color,
          weight: isSelectedForDeletion ? 2.5 : 1.5,
          fillColor: color,
          fillOpacity: isSelectedForDeletion ? 0.5 : t.status === 'free' ? 0.22 : 0.32,
          opacity: 0.9,
        }).addTo(markersLayer)
        // Long-press (super admin only — onLongPressTerritory is only ever
        // passed down when the caller already checked) starts/extends a
        // multi-select for bulk deletion; a plain click on the SAME sector
        // right after firing the long-press would otherwise toggle it back
        // off immediately (Leaflet fires 'click' on release regardless), so
        // that one click is swallowed via longPressFired.
        let longPressFired = false
        if (onLongPressRef.current) {
          poly.on('mousedown', (e) => {
            // Canvas-rendered interactive layers don't stop the underlying
            // native event from also bubbling to the map's own listeners —
            // without this, every press here ALSO started the map's
            // empty-space long-press timer below, so long-pressing an
            // existing sector offered to create a new one on top of it.
            L.DomEvent.stopPropagation(e)
            longPressFired = false
            if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
            pressTimerRef.current = setTimeout(() => {
              longPressFired = true
              pressTimerRef.current = null
              onLongPressRef.current?.(t.id)
            }, 500)
          })
          poly.on('mouseup mouseout', (e) => {
            L.DomEvent.stopPropagation(e)
            if (pressTimerRef.current) {
              clearTimeout(pressTimerRef.current)
              pressTimerRef.current = null
            }
          })
        }
        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          if (longPressFired) {
            longPressFired = false
            return
          }
          onSelectRef.current(t.id)
        })
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
      Promise.all([import('leaflet'), import('@maplibre/maplibre-gl-leaflet')]).then(([L, { maplibreGL }]) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        leafletRef.current = L

        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
        })
        mapRef.current = map

        // attributionControl: false — this project supplies its own attribution
        // (below) rather than trusting the style JSON's own `source.attribution`
        // strings, which the bridge would otherwise inject verbatim into the
        // Leaflet attribution control. Also sidesteps a disclosed maplibre-gl
        // advisory (GHSA-jrc7-96c5-q579, XSS via DOM.sanitize() on third-party
        // style attribution) — moot here regardless, since the bridge always
        // hardcodes attributionControl: false on its own internal MapLibre
        // instance and never touches that sanitizer, but no reason to also
        // forward untrusted third-party text through Leaflet's unsanitized
        // addAttribution() when we don't need to.
        maplibreGL({ style: BASEMAP_STYLE_URL, attributionControl: false }).addTo(map)
        L.control
          .attribution({ prefix: false })
          .addAttribution(
            '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
              '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · ' +
              '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
          )
          .addTo(map)

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
        // A drag can start with a mousedown on a polygon — don't let that
        // turn into a long-press selection once the map actually starts
        // moving under it.
        map.on('movestart', () => {
          if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current)
            pressTimerRef.current = null
          }
        })
        // Long-press on EMPTY map (not an existing sector) starts/extends a
        // new-sector placement batch — super admin only, same gating as
        // onLongPressTerritory. Leaflet's interactive polygons stop mouse
        // events from bubbling to the map by default, so this only ever
        // fires for a press that didn't land on a sector — no extra "was it
        // on a polygon" check needed.
        map.on('mousedown', (e: L.LeafletMouseEvent) => {
          if (!onLongPressEmptyMapRef.current) return
          emptyMapLongPressFiredRef.current = false
          if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
          const { lat, lng } = e.latlng
          pressTimerRef.current = setTimeout(() => {
            emptyMapLongPressFiredRef.current = true
            pressTimerRef.current = null
            onLongPressEmptyMapRef.current?.(lat, lng)
          }, 500)
        })
        map.on('mouseup', () => {
          if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current)
            pressTimerRef.current = null
          }
        })
        // Once a new-sector batch is underway, a plain tap on more empty
        // space queues more drafts — mirrors onSelect's re-purposing while a
        // delete selection is active. Never fires for a click that landed on
        // an existing sector's own polygon (those don't bubble to the map).
        map.on('click', (e: L.LeafletMouseEvent) => {
          if (emptyMapLongPressFiredRef.current) {
            emptyMapLongPressFiredRef.current = false
            return
          }
          onClickEmptyMapRef.current?.(e.latlng.lat, e.latlng.lng)
        })

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
    }, [territories, myTerritoryColor, selectedIds, pendingAddDrafts])

    return <div id="leafletMap" ref={containerRef} />
  }
)
