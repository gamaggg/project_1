'use client'

import 'leaflet/dist/leaflet.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type L from 'leaflet'
import type { Territory } from '@/lib/data/types'
import { resolveTerritoryColor, FREE_TERRITORY_COLOR, OTHER_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { crestSvgMarkup, resolveCrest } from '@/lib/data/clanCrests'
import { splitSector } from '@/lib/map/sectorParts'
import { hotFlameSvg } from '@/lib/map/hotFlame'

// Clan layer: a sector held by someone outside any clan.
const SOLO_OWNER_COLOR = '#9A9CA3'
const HOT_COLOR = '#FC5200'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { resolveTerritorySkin } from '@/lib/data/territorySkins'
import { useSkinAssetsVersion, useSkinPatterns } from '@/lib/map/skinPattern'
import { getCurrentCoords, queryGeolocationPermission } from '@/lib/geolocation'
import { hapticTap } from '@/lib/telegram/haptics'
import { applyCurrentLightPreset } from '@/lib/mapbox/lightPreset'

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
function avatarInnerHtml(avatarUrl: string | null, displayName: string | null): string {
  return avatarUrl
    ? `<img src="${escapeHtml(thumbUrl(avatarUrl, 48))}" alt="" decoding="async" />`
    : escapeHtml((displayName ?? 'Рыбак').slice(0, 2).toUpperCase())
}

// A hot sector's id label turns brand orange with a flame in front of the
// number — part of the label itself, so it sits under the avatar at every
// zoom instead of competing with it for the centre.
function idLabelHtml(t: Territory): string {
  return isHotNow(t)
    ? `<div class="leaflet-territory-label hot">${hotFlameSvg(9, '#fff')}${escapeHtml(t.id)}</div>`
    : `<div class="leaflet-territory-label">${escapeHtml(t.id)}</div>`
}

function isHotNow(t: Territory): boolean {
  return !!t.hotUntil && new Date(t.hotUntil).getTime() > Date.now()
}

function territoryMarkerHtml(t: Territory, clanLayer: boolean): string {
  const label = idLabelHtml(t)
  if (t.status === 'free' || !t.ownerId) return `<div class="leaflet-territory-marker">${label}</div>`
  // Clan layer: the owner's clan crest takes the avatar's place.
  if (clanLayer && t.ownerClanCrest) {
    return `<div class="leaflet-territory-marker"><div class="leaflet-territory-crest">${crestSvgMarkup(t.ownerClanCrest, 30)}</div>${label}</div>`
  }
  return `<div class="leaflet-territory-marker"><div class="leaflet-territory-avatar">${avatarInnerHtml(t.ownerAvatarUrl, t.ownerDisplayName)}</div>${label}</div>`
}

// A shared sector's cut (see lib/map/sectorParts.ts) — null when it's held
// whole, or while it's marked for deletion (drawn plain red then).
function sectorSplit(t: Territory) {
  if (!t.ownerId || t.coHolders.length === 0) return null
  return splitSector(t.corners, t.coHolders.length + 1)
}

// Owner first, then clan-mates in the order they joined — the same order
// splitSector hands the parts out in.
function sectorHolders(t: Territory) {
  return [{ avatarUrl: t.ownerAvatarUrl, displayName: t.ownerDisplayName, isMe: t.status === 'mine' }, ...t.coHolders]
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
    // The sector the bottom sheet carousel is currently previewing — drawn
    // with a pulsing glow outline so a map tap is visibly acknowledged.
    highlightedId?: string | null
    // «Кланы» layer: sectors take their owner's clan colour, solo owners go
    // grey, and labels show the clan crest instead of the avatar.
    clanLayer?: boolean
  }
>(function LeafletMap(
  {
    territories,
    myTerritoryColor,
    onSelect,
    selectedIds,
    onLongPressTerritory,
    pendingAddDrafts,
    onLongPressEmptyMap,
    onClickEmptyMap,
    fallbackCenter,
    fallbackZoom,
    highlightedId,
    clanLayer = false,
  },
  ref
) {
    const clanLayerRef = useRef(clanLayer)
    clanLayerRef.current = clanLayer
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const leafletRef = useRef<typeof import('leaflet') | null>(null)
    const getSkinPattern = useSkinPatterns()
    // Skin SVGs load async — this ticks once a given skin's file lands, so
    // sectors using it repaint with the real pattern instead of staying on
    // the flat-color fallback they render with while it's still loading.
    const skinAssetsVersion = useSkinAssetsVersion()
    // A hex sector's on-screen size changes with zoom — ticked on 'zoomend'
    // so the redraw effect below rebuilds skin patterns sized to match (see
    // hexTileHeight() and skinPattern.ts's tileHeight param).
    const [zoomTick, setZoomTick] = useState(0)
    const markersLayerRef = useRef<L.LayerGroup | null>(null)
    const labelsLayerRef = useRef<L.LayerGroup | null>(null)
    const hotBadgesLayerRef = useRef<L.LayerGroup | null>(null)
    // Last set `draw` was given, so the viewport-driven label rebuild below
    // can run from a map event without re-running the whole polygon pass.
    const territoriesRef = useRef<Territory[]>([])
    // SVG-rendered (not the map's own Canvas renderer — see preferCanvas
    // below) so the highlight polygon is a real DOM element CSS can animate.
    // Only ever holds the single currently-tapped sector, so the usual
    // per-polygon-DOM-node cost that ruled out SVG for the other ~700
    // sectors doesn't apply here.
    const highlightLayerRef = useRef<L.LayerGroup | null>(null)
    const svgRendererRef = useRef<L.Renderer | null>(null)
    const userMarkerRef = useRef<L.Marker | null>(null)
    const cleanupLightPresetRef = useRef<(() => void) | null>(null)
    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect
    const selectedIdsRef = useRef(selectedIds)
    selectedIdsRef.current = selectedIds
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
      const map = mapRef.current
      const markersLayer = markersLayerRef.current
      const labelsLayer = labelsLayerRef.current
      if (!L || !markersLayer || !labelsLayer) return
      territoriesRef.current = territories
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
      // Grey sectors first, then other players', then the viewer's own (and
      // an admin's picks for deletion on top): the canvas paints in order, so
      // where two sectors share an edge the later outline covers the earlier
      // one — a coloured edge mustn't vanish under a grey neighbour's. On the
      // «Кланы» layer players without a clan are grey too. sort() is stable,
      // so each group keeps its order.
      const isGrey = (t: Territory) =>
        t.status === 'free' || (clanLayerRef.current && (!t.ownerId || !t.ownerClanCrest))
      const drawRank = (t: Territory) => (selectedIds?.has(t.id) ? 3 : isGrey(t) ? 0 : t.status === 'mine' ? 2 : 1)
      const drawOrder = [...territories].sort((a, b) => drawRank(a) - drawRank(b))
      drawOrder.forEach((t) => {
        const isSelectedForDeletion = selectedIds?.has(t.id) ?? false
        const inClanView = clanLayerRef.current
        const skin = !inClanView && t.status !== 'free' && t.ownerEquippedSkin ? resolveTerritorySkin(t.ownerEquippedSkin) : null
        const color = isSelectedForDeletion
          ? '#D33'
          : inClanView
            ? t.status === 'free' || !t.ownerId
              ? FREE_TERRITORY_COLOR
              : t.ownerClanCrest
                ? resolveCrest(t.ownerClanCrest).primary
                : SOLO_OWNER_COLOR
            : resolveTerritoryColor(t.status, myTerritoryColor)
        // Tinted with this same `color` — whatever the sector already renders
        // in (the owner's own color if it's their own, the fixed "other"
        // color otherwise) — so a skin never clashes with it (see
        // territorySkins.ts).
        let pattern: CanvasPattern | null = null
        if (skin && map) {
          // Both the tile's position AND its size are measured from this
          // specific sector's own corners, not a shared sample from
          // wherever in `territories` — sectors are the same real-world
          // hex, but Mercator projection still renders that hex at
          // different PIXEL sizes depending on latitude, so a size sampled
          // from one sector (especially one in a different city entirely)
          // could be visibly wrong for another, leaving the tile short of
          // the sector's true bounding box on one edge. The position also
          // has to be in the exact same coordinate space Leaflet's canvas
          // renderer draws this polygon's own points in (layer points, not
          // container points) — see useSkinPatterns' getSkinPattern for why.
          const layerPoints = t.corners.map(([lat, lng]) => map.latLngToLayerPoint([lat, lng]))
          const xs = layerPoints.map((p) => p.x)
          const ys = layerPoints.map((p) => p.y)
          const offsetX = Math.min(...xs)
          const offsetY = Math.min(...ys)
          const hexTileWidth = Math.max(...xs) - offsetX
          const hexTileHeight = Math.max(...ys) - offsetY
          pattern = getSkinPattern(skin.id, color, offsetX, offsetY, hexTileHeight, hexTileWidth)
        }
        const fillOpacity = isSelectedForDeletion ? 0.5 : t.status === 'free' ? 0.22 : inClanView && t.ownerClanCrest ? 0.5 : 0.32
        // Shared by clan-mates: each holder's part gets its own fill (the
        // viewer's own part in their colour, everyone else's in the usual
        // "someone else's" blue; one clan colour on the «Кланы» layer),
        // drawn under the sector's outline. The whole sector below still
        // takes the clicks — parts are decoration only.
        const split = isSelectedForDeletion ? null : sectorSplit(t)
        if (split) {
          const holders = sectorHolders(t)
          split.parts.forEach((part, i) => {
            const partColor = inClanView ? color : i === 0 ? color : holders[i].isMe ? myTerritoryColor : OTHER_TERRITORY_COLOR
            L.polygon(part, {
              stroke: false,
              fillColor: (i === 0 && pattern ? pattern : partColor) as unknown as string,
              fillOpacity,
              interactive: false,
            }).addTo(markersLayer)
          })
        }
        const poly = L.polygon(t.corners, {
          color,
          weight: isSelectedForDeletion ? 2.5 : 1.5,
          // A CanvasPattern is a spec-legal fillStyle value right alongside a
          // plain color string — Leaflet's types just don't know that.
          fillColor: (pattern ?? color) as unknown as string,
          fillOpacity: split ? 0 : fillOpacity,
          opacity: 0.9,
        }).addTo(markersLayer)
        if (split) {
          L.polyline(
            split.cuts.map((cut) => [split.center, cut]),
            { color: '#FFFFFF', weight: 1.5, opacity: 0.9, interactive: false }
          ).addTo(markersLayer)
        }
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
          // Canvas-rendered — never a real bubbling DOM click, so
          // FishZoneApp's delegated tap-haptic listener structurally can't
          // see this; call it directly instead.
          hapticTap()
          onSelectRef.current(t.id)
        })
      })
      // The week's hot sectors (at most two per city): a brand-orange outline
      // over everything, with a soft wider stroke under it for the glow. The
      // flame itself is in the sector's id label (see idLabelHtml); zoomed out
      // past the labels, a small flame badge takes the empty centre instead
      // (hotBadgesLayer, shown only below LABEL_MIN_ZOOM). Static — the map
      // stays free of animation.
      const hotBadges = hotBadgesLayerRef.current
      hotBadges?.clearLayers()
      territories.filter(isHotNow).forEach((t) => {
        L.polygon(t.corners, { color: HOT_COLOR, weight: 9, opacity: 0.22, fill: false, interactive: false }).addTo(markersLayer)
        L.polygon(t.corners, { color: HOT_COLOR, weight: 3, opacity: 1, fill: false, interactive: false }).addTo(markersLayer)
        if (hotBadges) {
          L.marker([t.lat, t.lng], {
            icon: L.divIcon({ className: 'hot-sector-badge', html: hotFlameSvg(12, '#fff'), iconSize: [22, 22], iconAnchor: [11, 11] }),
            interactive: false,
            keyboard: false,
          }).addTo(hotBadges)
        }
      })
      drawLabels()
    }

    // Only the sectors actually on screen get a label marker. Each one is a
    // real DOM divIcon (avatar pill + id) that Leaflet repositions on every
    // move tick, so building all ~560 of them up front cost ~1700 nodes and
    // made panning/zooming visibly janky on phones — and in Telegram's iOS
    // WebView, alongside the rest of the app's DOM, it was enough to get the
    // view killed and reloaded. Rebuilt on moveend (see the init effect), so
    // what's off screen simply doesn't exist. Reads everything from refs:
    // the map listener binds this once, on first render.
    function drawLabels() {
      const L = leafletRef.current
      const map = mapRef.current
      const labelsLayer = labelsLayerRef.current
      if (!L || !map || !labelsLayer) return
      labelsLayer.clearLayers()
      if (map.getZoom() < LABEL_MIN_ZOOM) return
      // Padded so a marker isn't created/destroyed right as it crosses the
      // edge — the strip just outside the viewport is already built by the
      // time a drag brings it in.
      const bounds = map.getBounds().pad(0.3)
      territoriesRef.current.forEach((t) => {
        if (!bounds.contains([t.lat, t.lng])) return
        const isOccupied = t.status !== 'free' && !!t.ownerId
        // Shared sector: the id stays at the center, and every holder's
        // avatar sits in the middle of their own part — sized to the part,
        // so four still fit at the zoom labels first appear. The «Кланы»
        // layer keeps the single crest: the holders are one clan anyway.
        const split = !clanLayerRef.current && !selectedIdsRef.current?.has(t.id) ? sectorSplit(t) : null
        if (split) {
          L.marker([t.lat, t.lng], {
            icon: L.divIcon({
              className: 'leaflet-territory-marker-wrap',
              html: `<div class="leaflet-territory-marker">${idLabelHtml(t)}</div>`,
              iconSize: [40, 18],
            }),
            interactive: false,
          }).addTo(labelsLayer)
          const width = map.latLngToContainerPoint(t.corners[0]).distanceTo(map.latLngToContainerPoint(t.corners[3]))
          const factor = split.parts.length === 2 ? 0.26 : split.parts.length === 3 ? 0.22 : 0.2
          const size = Math.round(Math.min(26, Math.max(16, width * factor)))
          sectorHolders(t).forEach((h, i) => {
            L.marker(split.centroids[i], {
              icon: L.divIcon({
                className: 'leaflet-territory-marker-wrap',
                html: `<div class="leaflet-territory-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${avatarInnerHtml(h.avatarUrl, h.displayName)}</div>`,
                iconSize: [size, size],
              }),
              interactive: false,
            }).addTo(labelsLayer)
          })
          return
        }
        L.marker([t.lat, t.lng], {
          icon: L.divIcon({
            className: 'leaflet-territory-marker-wrap',
            html: territoryMarkerHtml(t, clanLayerRef.current),
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
          // Was 0.6: a canvas 2.2× the viewport per side is ~4.8× its area —
          // ~30 MB of backing store for the polygons alone, all ~660 of them
          // redrawn into it on every settled move. 0.3 (~2.6× area) still
          // covers an ordinary swipe and roughly halves both costs, which
          // matters on phones where this sat next to the GL map's own buffers.
          renderer: L.canvas({ padding: 0.3 }),
        })
        mapRef.current = map

        // This project supplies its own attribution (below) rather than trusting
        // the style JSON's own `source.attribution` strings, which the bridge
        // would otherwise inject verbatim into the Leaflet attribution control —
        // moot regardless, since the bridge (mapbox-gl-leaflet, imported above
        // for its L.mapboxGL side-effect registration) always hardcodes its own
        // internal mapbox-gl instance to attributionControl: false already.
        const glLayer = L.mapboxGL({ style: MAPBOX_STYLE_URL, accessToken: MAPBOX_TOKEN })
        glLayer.addTo(map)
        L.control
          .attribution({ prefix: false })
          .addAttribution(
            '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> · ' +
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
          )
          .addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        labelsLayerRef.current = L.layerGroup()
        hotBadgesLayerRef.current = L.layerGroup()
        // Only ever holds the one highlighted sector, so it doesn't need the
        // polygon canvas's wide swipe buffer — at 0.6 this <svg> (and the
        // compositing layer its glow filter gets) was 2.2× the viewport.
        svgRendererRef.current = L.svg({ padding: 0.2 })
        highlightLayerRef.current = L.layerGroup().addTo(map)

        map.setView(fallbackCenter ?? FALLBACK_CENTER, fallbackZoom ?? FALLBACK_ZOOM)

        // getMapboxMap() isn't in @types/mapbox-gl-leaflet even though it
        // exists at runtime — see the `.default` workaround note above for
        // the same package's other type gap. Leaflet defers a layer's own
        // onAdd (which is what actually constructs the mapboxgl.Map) until
        // the Leaflet map is "ready" — i.e. until setView above runs — so
        // this has to read the gl layer only now, not right after addTo().
        const mapboxMap = (glLayer as unknown as { getMapboxMap: () => import('mapbox-gl').Map }).getMapboxMap()
        mapboxMap.once('load', () => applyCurrentLightPreset(mapboxMap))
        // The map screen stays mounted for the whole app session, so a long
        // visit can cross a preset boundary (e.g. open at 17:50, still open
        // at 18:05) — recheck periodically and whenever the app comes back
        // to the foreground, rather than only ever applying the preset once.
        const lightPresetInterval = setInterval(() => applyCurrentLightPreset(mapboxMap), 15 * 60 * 1000)
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') applyCurrentLightPreset(mapboxMap)
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        cleanupLightPresetRef.current = () => {
          clearInterval(lightPresetInterval)
          document.removeEventListener('visibilitychange', onVisibilityChange)
        }

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
          // The other way round for the hot-sector badges: they stand in for
          // the labels' flame when the labels are hidden.
          const badges = hotBadgesLayerRef.current!
          if (!show && !map.hasLayer(badges)) badges.addTo(map)
          if (show && map.hasLayer(badges)) map.removeLayer(badges)
        }
        map.on('zoomend', updateLabelVisibility)
        // Labels only exist for the current viewport (see drawLabels), so
        // every settled pan/zoom rebuilds them for wherever the map landed.
        map.on('moveend', drawLabels)
        map.on('zoomend', () => setZoomTick((v) => v + 1))
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
          // Only meaningful (queues a new-sector draft) when this callback
          // is actually wired — regular users tapping open water shouldn't
          // buzz for nothing.
          if (onClickEmptyMapRef.current) hapticTap()
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
        cleanupLightPresetRef.current?.()
        cleanupLightPresetRef.current = null
        // A flyTo still in flight would otherwise fire one more zoom frame
        // into the mapbox-gl bridge after the map is gone ("Cannot read
        // properties of null (reading 'getZoom')").
        mapRef.current?.stop()
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
    }, [territories, myTerritoryColor, selectedIds, pendingAddDrafts, skinAssetsVersion, zoomTick, clanLayer])

    // Kept separate from the effect above — retargeting the highlight on
    // every tap shouldn't re-run a full ~700-polygon canvas redraw.
    useEffect(() => {
      const L = leafletRef.current
      const layer = highlightLayerRef.current
      const renderer = svgRendererRef.current
      if (!L || !layer || !renderer) return
      layer.clearLayers()
      const t = highlightedId ? territories.find((x) => x.id === highlightedId) : null
      if (!t) return
      L.polygon(t.corners, {
        renderer,
        className: 'sector-highlight',
        color: '#FC5200',
        weight: 3,
        fill: false,
        interactive: false,
      }).addTo(layer)
    }, [highlightedId, territories])

    return <div id="leafletMap" ref={containerRef} />
  }
)
