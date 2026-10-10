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
  // A plain, quick flight to a view in the same city («Где это?»'s start).
  flyToView: (center: [number, number], zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  // The hot-sector tour (HotSectorsTour): fly so these sectors fill the
  // middle of the screen, and their hexagons' corners on the page now (px).
  focusTerritories: (ids: string[]) => void
  // «Где это?»: the whole of an area (corner points) in view, between the
  // panel on top and the hint below — not zoomed below minZoom; no animation.
  showArea: (points: [number, number][], minZoom: number) => void
  territoriesOutline: (ids: string[]) => [number, number][][] | null
}

export type GeoMarks = { picked: string | null; answer: string | null; spot: [number, number] | null; dim: boolean }

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
function idLabelHtml(t: Territory, plain = false): string {
  return !plain && isHotNow(t)
    ? `<div class="leaflet-territory-label hot">${hotFlameSvg(9, '#fff')}${escapeHtml(t.id)}</div>`
    : `<div class="leaflet-territory-label">${escapeHtml(t.id)}</div>`
}

function isHotNow(t: Territory): boolean {
  return !!t.hotUntil && new Date(t.hotUntil).getTime() > Date.now()
}

// `plain`: «Где это?» — only the sector's number: whose it is (faces,
// initials, crests) and what's hot have nothing to do with where a
// panorama was taken.
function territoryMarkerHtml(t: Territory, clanLayer: boolean, plain = false): string {
  const label = idLabelHtml(t, plain)
  if (plain || t.status === 'free' || !t.ownerId) return `<div class="leaflet-territory-marker">${label}</div>`
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
  return [
    { avatarUrl: t.ownerAvatarUrl, displayName: t.ownerDisplayName, isMe: t.status === 'mine', equippedSkin: t.ownerEquippedSkin },
    ...t.coHolders,
  ]
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
// mapbox-gl-leaflet finishes a resize on the next animation frame, and a
// zoom on the GL map's own moveend, without checking the layer is still on a
// map — when the map is torn down in between (signing in as someone else
// remounts it) that read null: «Cannot read properties of null (reading
// 'getZoom')», reported as an app error. Same bodies, plus the check.
type BridgeProto = {
  _map: L.Map | null
  _glMap: { _actualCanvas: HTMLElement; once: (ev: string, fn: () => void) => void; jumpTo: (o: { center: L.LatLng; zoom: number }) => void } | null
  _zoomEnd: () => void
  _transitionEnd: (e?: unknown) => void
  __rangeGuarded?: boolean
}
function guardMapboxBridge(Lf: typeof L) {
  const proto = (Lf as unknown as { MapboxGL?: { prototype: BridgeProto } }).MapboxGL?.prototype
  if (!proto || proto.__rangeGuarded) return
  proto.__rangeGuarded = true
  const zoomEnd = proto._zoomEnd
  proto._zoomEnd = function (this: BridgeProto) {
    if (!this._map || !this._glMap) return
    zoomEnd.call(this)
  }
  proto._transitionEnd = function (this: BridgeProto) {
    Lf.Util.requestAnimFrame(() => {
      const map = this._map
      const gl = this._glMap
      if (!map || !gl) return
      const zoom = map.getZoom()
      const center = map.getCenter()
      const offset = map.latLngToContainerPoint(map.getBounds().getNorthWest())
      Lf.DomUtil.setTransform(gl._actualCanvas, offset, 1)
      gl.once('moveend', () => this._zoomEnd())
      gl.jumpTo({ center, zoom: zoom - 1 })
    }, this)
  }
}

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
    // «Где это?» on this map: the sector picked (orange), the right one
    // (green) with the spot the panorama was taken from, and with `dim` the
    // rest of the map shaded so those two stand out — drawn on the map, so
    // it moves with it. Takes the place of the tap highlight while it's set.
    geo?: GeoMarks | null
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
    geo = null,
  },
  ref
) {
    const clanLayerRef = useRef(clanLayer)
    clanLayerRef.current = clanLayer
    // «Где это?» on the map: sectors by number only (territoryMarkerHtml).
    const plain = !!geo
    const plainRef = useRef(plain)
    plainRef.current = plain
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
        const color = isSelectedForDeletion
          ? '#D33'
          : inClanView
            ? t.status === 'free' || !t.ownerId
              ? FREE_TERRITORY_COLOR
              : t.ownerClanCrest
                ? resolveCrest(t.ownerClanCrest).primary
                : SOLO_OWNER_COLOR
            : resolveTerritoryColor(t.status, myTerritoryColor)
        // A holder's equipped skin, tinted with the colour their sector (or
        // their part of a shared one) already renders in — their own colour
        // if it's the viewer, the fixed "other" colour otherwise — so a skin
        // never clashes with it (see territorySkins.ts). None on the «Кланы»
        // layer, which paints whole clans in one colour.
        let tile: { offsetX: number; offsetY: number; width: number; height: number } | null = null
        const skinPattern = (skinId: string | null, tint: string): CanvasPattern | null => {
          const skin = !inClanView && t.status !== 'free' ? resolveTerritorySkin(skinId) : null
          if (!skin || !map) return null
          if (!tile) {
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
            // A shared sector's parts all take the whole hex's tile, so each
            // part shows its own slice of its holder's skin.
            const layerPoints = t.corners.map(([lat, lng]) => map.latLngToLayerPoint([lat, lng]))
            const xs = layerPoints.map((p) => p.x)
            const ys = layerPoints.map((p) => p.y)
            const offsetX = Math.min(...xs)
            const offsetY = Math.min(...ys)
            tile = { offsetX, offsetY, width: Math.max(...xs) - offsetX, height: Math.max(...ys) - offsetY }
          }
          return getSkinPattern(skin.id, tint, tile.offsetX, tile.offsetY, tile.height, tile.width)
        }
        const fillOpacity = isSelectedForDeletion ? 0.5 : t.status === 'free' ? 0.22 : inClanView && t.ownerClanCrest ? 0.5 : 0.32
        // Shared by clan-mates: each holder's part gets its own fill — their
        // skin, or the plain colour (the viewer's own part in their colour,
        // everyone else's in the usual "someone else's" blue; one clan colour
        // on the «Кланы» layer) — drawn under the sector's outline. The whole
        // sector below still takes the clicks — parts are decoration only.
        const split = isSelectedForDeletion ? null : sectorSplit(t)
        const pattern = split ? null : skinPattern(t.ownerEquippedSkin, color)
        if (split) {
          const holders = sectorHolders(t)
          split.parts.forEach((part, i) => {
            const partColor = inClanView ? color : i === 0 ? color : holders[i].isMe ? myTerritoryColor : OTHER_TERRITORY_COLOR
            const partPattern = skinPattern(holders[i].equippedSkin, partColor)
            L.polygon(part, {
              stroke: false,
              fillColor: (partPattern ?? partColor) as unknown as string,
              // A skin pattern has its tint and line alpha baked in (see skinPattern.ts).
              fillOpacity: partPattern ? 1 : fillOpacity,
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
          fillOpacity: split ? 0 : pattern ? 1 : fillOpacity,
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
      territories.filter((t) => !plainRef.current && isHotNow(t)).forEach((t) => {
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
        const isOccupied = t.status !== 'free' && !!t.ownerId && !plainRef.current
        // Shared sector: the id stays at the center, and every holder's
        // avatar sits in the middle of their own part — sized to the part,
        // so four still fit at the zoom labels first appear. The «Кланы»
        // layer keeps the single crest: the holders are one clan anyway.
        const split = !clanLayerRef.current && !plainRef.current && !selectedIdsRef.current?.has(t.id) ? sectorSplit(t) : null
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
            html: territoryMarkerHtml(t, clanLayerRef.current, plainRef.current),
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
        // Keep the player's scale — «На карте» and swiping the cards used to
        // zoom right in (16.5, the sector filling half the screen). Only a
        // map zoomed far out comes in to 14, where a sector still reads.
        const targetZoom = Math.max(map.getZoom(), 14)
        map.flyTo([t.lat, t.lng], targetZoom, { duration: 0.5 })
      },
      showUserLocation: placeUserMarker,
      flyToView(center: [number, number], zoom: number) {
        mapRef.current?.flyTo(center, zoom, { duration: 0.8 })
      },
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
      focusTerritories(ids: string[]) {
        const map = mapRef.current
        const corners = ids.flatMap((id) => territories.find((x) => x.id === id)?.corners ?? [])
        if (!map || corners.length === 0) return
        const lats = corners.map(([lat]) => lat)
        const lngs = corners.map(([, lng]) => lng)
        // Room above for the top panel and below for the tour's note and the
        // sector cards, so the sectors land in the clear middle.
        map.flyToBounds(
          [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
          ],
          { paddingTopLeft: [80, 160], paddingBottomRight: [80, 340], maxZoom: 15, duration: 0.9 }
        )
      },
      showArea(points: [number, number][], minZoom: number) {
        const map = mapRef.current
        const L = leafletRef.current
        if (!map || !L || points.length === 0) return
        const lats = points.map(([lat]) => lat)
        const lngs = points.map(([, lng]) => lng)
        const south = Math.min(...lats)
        const north = Math.max(...lats)
        const west = Math.min(...lngs)
        const east = Math.max(...lngs)
        // Room for the question panel on top and the hint below.
        const zoom = Math.max(minZoom, map.getBoundsZoom([[south, west], [north, east]], false, L.point(40, 220)))
        // At once, no fly: the zoom-out passing over sectors read as a hint.
        map.setView([(south + north) / 2, (west + east) / 2], zoom, { animate: false })
      },
      territoriesOutline(ids: string[]) {
        const map = mapRef.current
        const shapes = ids.map((id) => territories.find((x) => x.id === id)?.corners ?? []).filter((c) => c.length > 0)
        if (!map || shapes.length === 0) return null
        const box = map.getContainer().getBoundingClientRect()
        return shapes.map((c) =>
          c.map(([lat, lng]) => {
            const p = map.latLngToContainerPoint([lat, lng])
            return [box.left + p.x, box.top + p.y] as [number, number]
          })
        )
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
        guardMapboxBridge(L)

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
    }, [territories, myTerritoryColor, selectedIds, pendingAddDrafts, skinAssetsVersion, zoomTick, clanLayer, plain])

    const geoKey = geo ? `${geo.picked}|${geo.answer}|${geo.dim}|${geo.spot?.join(',')}` : null
    // Kept separate from the effect above — retargeting the highlight on
    // every tap shouldn't re-run a full ~700-polygon canvas redraw.
    useEffect(() => {
      const L = leafletRef.current
      const layer = highlightLayerRef.current
      const renderer = svgRendererRef.current
      if (!L || !layer || !renderer) return
      layer.clearLayers()
      if (geo) {
        const picked = geo.picked ? territories.find((x) => x.id === geo.picked) : null
        const answer = geo.answer ? territories.find((x) => x.id === geo.answer) : null
        if (geo.dim) {
          // The whole world with the two hexes cut out of it.
          // Once per sector: the same hole twice cancels out (even-odd fill).
          const holes = [...new Set([picked, answer].filter((x): x is Territory => !!x))].map((x) => x.corners)
          L.polygon(
            [
              [
                [-85, -180],
                [-85, 180],
                [85, 180],
                [85, -180],
              ],
              ...holes,
            ],
            { renderer, stroke: false, fillColor: '#0A1622', fillOpacity: 0.58, interactive: false, className: 'geo-dim' }
          ).addTo(layer)
        }
        if (answer) {
          L.polygon(answer.corners, { renderer, className: 'geo-mark-answer', color: '#22C55E', weight: 4, fillColor: '#22C55E', fillOpacity: 0.28, interactive: false }).addTo(layer)
        }
        if (picked && picked.id !== answer?.id) {
          L.polygon(picked.corners, { renderer, className: 'geo-mark-picked', color: '#FC5200', weight: 4, fillColor: '#FC5200', fillOpacity: geo.answer ? 0.22 : 0.32, interactive: false }).addTo(layer)
        }
        if (geo.spot) {
          L.marker(geo.spot, {
            icon: L.divIcon({ className: 'geo-spot', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
            interactive: false,
            zIndexOffset: 1000,
          }).addTo(layer)
        }
        return
      }
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
      // The marks are redrawn when what they show changes, not on every new
      // `geo` object a parent render makes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedId, territories, geoKey])

    return <div id="leafletMap" ref={containerRef} />
  }
)
