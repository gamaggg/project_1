'use client'

import 'leaflet/dist/leaflet.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type L from 'leaflet'
import type { Territory } from '@/lib/data/types'
import { resolveTerritoryColor } from '@/lib/data/territoryColors'
import { getCurrentCoords, queryGeolocationPermission } from '@/lib/geolocation'

// Trial swap from OpenFreeMap — a custom Mapbox Standard style, hand-tuned to
// RANGE's brand colors (deep-water blue that's deliberately distinct from the
// blue "occupied" territory badge, brand-orange motorways, flat 2D — no 3D
// buildings). Kept as a single clean commit specifically so it's a one-command
// `git revert` back to OpenFreeMap if it doesn't work out. Token is a public
// (pk.) Mapbox token — safe client-side by design, same as any mapbox-gl-js
// app; scope/domain-restrict it in the Mapbox dashboard if usage needs limiting.
const MAPBOX_STYLE_URL = process.env.NEXT_PUBLIC_MAPBOX_STYLE!
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export type LeafletMapHandle = {
  flyToTerritory: (id: string) => void
  showUserLocation: (lat: number, lng: number) => void
  flyToLocation: (lat: number, lng: number) => void
  flyToCity: (center: [number, number], zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
}

const LABEL_MIN_ZOOM = 14

// ownerDisplayName/ownerAvatarUrl are user-controlled (a display name, or an
// avatar_url a user could in principle set to an arbitrary string via a raw
// API call) — unlike a JSX attribute/text node, L.divIcon's `html` is parsed
// as real markup, so anything interpolated into it needs escaping or it's a
// stored-XSS hole.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Matches TerritoryThumbnailMap's pill-label + avatar treatment (see that
// file) so a sector reads the same whether you're looking at the full map or
// its own screen's mini-map.
function territoryMarkerHtml(t: Territory): string {
  const label = `<div class="leaflet-territory-label">${escapeHtml(t.id)}</div>`
  if (t.status === 'free' || !t.ownerId) return `<div class="leaflet-territory-marker">${label}</div>`
  const initials = escapeHtml((t.ownerDisplayName ?? 'Рыбак').slice(0, 2).toUpperCase())
  const avatar = t.ownerAvatarUrl
    ? `<img src="${escapeHtml(t.ownerAvatarUrl)}" alt="" />`
    : initials
  return `<div class="leaflet-territory-marker"><div class="leaflet-territory-avatar">${avatar}</div>${label}</div>`
}

// Default fallback view for a visitor whose real position isn't known yet (no
// geolocation permission decided/granted — see the map-geo-banner in
// MapScreen.tsx) AND no city-specific fallbackCenter/fallbackZoom prop was
// passed (MapScreen always passes CITIES[city]'s own center/zoom in practice
// — see lib/data/city.ts — so these constants are really just Batumi's own
// entry there, kept as the literal default). Deliberately NOT derived from
// fitBounds over all sectors: that box's raw geometric center falls inland,
// nowhere near the coast, once zoomed in this close (tried it — landed in a
// forest outside Makhvilauri with no sectors on screen). Anchored instead on
// central Batumi bay itself — the coordinates are the centroid of the sector
// cluster (B0934–B1174) visible in the reference screenshot for this
// feature, zoom picked just above LABEL_MIN_ZOOM so sector labels and the
// "Batumi" place name are both legible without being a tight, single-sector
// view.
const FALLBACK_CENTER: [number, number] = [41.6513, 41.6325]
const FALLBACK_ZOOM = 14.3

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
    fallbackCenter?: [number, number]
    fallbackZoom?: number
  }
>(function LeafletMap(
  { territories, myTerritoryColor, onSelect, selectedIds, onLongPressTerritory, pendingAddDrafts, onLongPressEmptyMap, onClickEmptyMap, fallbackCenter, fallbackZoom },
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
        const isOccupied = t.status !== 'free' && !!t.ownerId
        L.marker([t.lat, t.lng], {
          icon: L.divIcon({
            className: 'leaflet-territory-marker-wrap',
            html: territoryMarkerHtml(t),
            iconSize: isOccupied ? [40, 40] : [40, 18],
          }),
          interactive: false,
        }).addTo(labelsLayer)
      })
    }

    // Places (or moves) a marker at the visitor's real GPS position — shown
    // once geolocation succeeds, regardless of whether it lands on a sector
    // (see DECISIONS.md, "+" flow). Kept outside markersLayer so redrawing
    // sector polygons on ownership changes doesn't clear it. Also used by the
    // init effect below for a visitor whose browser already granted access in
    // an earlier session.
    function placeUserMarker(lat: number, lng: number) {
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
    }

    useImperativeHandle(ref, () => ({
      flyToTerritory(id: string) {
        const map = mapRef.current
        const t = territories.find((x) => x.id === id)
        if (!map || !t) return
        const targetZoom = Math.max(map.getZoom(), 16.5)
        map.flyTo([t.lat, t.lng], targetZoom, { duration: 0.5 })
      },
      showUserLocation: placeUserMarker,
      flyToLocation(lat: number, lng: number) {
        const map = mapRef.current
        if (!map) return
        const targetZoom = Math.max(map.getZoom(), 16.5)
        map.flyTo([lat, lng], targetZoom, { duration: 0.5 })
      },
      // City switch — a real forced duration (not proportional-to-distance
      // like flyTo's default) so Batumi<->Moscow always reads as one
      // deliberate "zoom out to the region, swoop to the new city" journey
      // instead of a quick jump. Leaflet's own flyTo easing already dips to a
      // wide intermediate zoom on its own for a trip this long — no need to
      // hand-animate a separate "zoom out to a globe" stage. Duration bumped
      // from 2.4s to 3.4s (per user feedback that the flight felt short) —
      // spreading the same motion over more time also eases the mapbox-gl
      // tile bridge below.
      flyToCity(center: [number, number], zoom: number) {
        const map = mapRef.current
        const labelsLayer = labelsLayerRef.current
        if (!map) return
        // labelsLayer is hundreds of real DOM divIcon markers (avatar pills)
        // that Leaflet repositions on every 'move' tick — normally cheap
        // because a plain pinch-zoom only spans a couple of zoom levels, but
        // a cross-city flyTo dips all the way out to a near-world view and
        // back, so those hundreds of markers would otherwise get reflowed at
        // 60fps for the full ~3.4s flight while sitting off-screen or
        // crammed into an unreadable cluster. Detaching them for the
        // duration and letting the existing zoomend-driven
        // updateLabelVisibility() reattach (or not) once the flight settles
        // removes that dead weight — the labels were never legible mid-flight
        // anyway.
        if (labelsLayer && map.hasLayer(labelsLayer)) map.removeLayer(labelsLayer)
        map.flyTo(center, zoom, { duration: 3.4 })
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
      Promise.all([import('leaflet'), import('mapbox-gl-leaflet')]).then(([LModule]) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        // mapbox-gl-leaflet is a CJS-only UMD plugin: it does its own internal
        // require('leaflet') and mutates that module's exports object with
        // `L.mapboxGL` as a side effect (no named export of its own — see its
        // source). Turbopack's ESM namespace for our own `import('leaflet')`
        // above is a separate snapshot taken before that mutation lands, so
        // `LModule.mapboxGL` is undefined even though the plugin worked;
        // `LModule.default` is the live, unwrapped CJS exports object the
        // plugin actually mutated (confirmed by inspection), so it has to be
        // used from here on instead of the namespace `LModule` itself.
        const L = (LModule as unknown as { default?: typeof LModule }).default ?? LModule
        leafletRef.current = L

        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
          // Leaflet's Canvas renderer only pre-renders vector layers slightly
          // beyond the viewport (default padding: 0.1 = 10% each side) — swipe
          // or pinch-zoom far/fast enough during one gesture and the newly
          // revealed edge is genuinely blank (nothing drawn there yet) until
          // the real redraw fires at gesture end, reading as "sectors pop in
          // after you let go." A wider buffer covers normal gesture speeds; the
          // trade-off is a bigger canvas to redraw on every real update.
          renderer: L.canvas({ padding: 0.6 }),
        })
        mapRef.current = map

        // This project supplies its own attribution (below) rather than trusting
        // the style JSON's own `source.attribution` strings, which the bridge
        // would otherwise inject verbatim into the Leaflet attribution control —
        // moot regardless, since the bridge (mapbox-gl-leaflet, imported above
        // for its L.mapboxGL side-effect registration) always hardcodes its own
        // internal mapbox-gl instance to attributionControl: false already.
        L.mapboxGL({ style: MAPBOX_STYLE_URL, accessToken: MAPBOX_TOKEN }).addTo(map)
        L.control
          .attribution({ prefix: false })
          .addAttribution(
            '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> · ' +
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
          )
          .addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        labelsLayerRef.current = L.layerGroup()

        map.setView(fallbackCenter ?? FALLBACK_CENTER, fallbackZoom ?? FALLBACK_ZOOM)

        // Silently confirm (never prompts — see DECISIONS.md "геолокация
        // только по «+»") whether this origin already has geolocation access
        // from an earlier session, and if so smoothly fly to the visitor's
        // real position instead of leaving the generic regional view up. A
        // first-time visitor (nothing decided yet) or one who denied it stays
        // on the wide view above — see the map-geo-banner in MapScreen.tsx
        // for how they're prompted to grant it.
        queryGeolocationPermission().then(async (permission) => {
          if (cancelled || permission !== 'granted') return
          const coords = await getCurrentCoords()
          if (cancelled || !coords) return
          map.flyTo([coords.lat, coords.lng], 16.5, { duration: 0.6 })
          placeUserMarker(coords.lat, coords.lng)
        })

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
        // onLongPressTerritory. A press that landed on a sector's own polygon
        // never reaches here: each polygon calls L.DomEvent.stopPropagation
        // on its own mousedown/mouseup/click (Canvas-rendered interactive
        // layers do NOT stop native event bubbling on their own — confirmed
        // by reading Leaflet's source — so that stop has to be explicit).
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
        // an existing sector's own polygon — see the stopPropagation note
        // above the map's 'mousedown' listener.
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
