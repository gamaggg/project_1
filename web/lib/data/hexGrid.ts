import type { CityId } from '@/lib/data/city'
import type { TerritoryKind } from '@/lib/data/types'

// Reproduces the exact hex grids tools/fishing-hex/build_hex.mjs (Batumi) and
// build_hex_moscow.mjs (Moscow) used to generate public/data/sectors.json
// (via @turf/turf's hexGrid), so an admin-placed sector snaps to the SAME
// grid and tiles seamlessly with the existing sectors without shifting any
// of them. Ported by hand instead of depending on @turf/turf client-side:
// turf's hexGrid centers its whole output within the given bbox (see its
// x_adjust/y_adjust), so calling it again with a bigger bbox to cover a new
// area silently re-phases every cell — verified empirically
// (tools/fishing-hex/hex_grid_probe2.mjs) rather than assumed. What's stable
// across bbox sizes is the *formula* itself, so this fixes each city's
// constants once from that city's own bbox/cellSide and treats its grid as
// infinite from there — verified byte-for-byte against stored sectors in
// both cities (0 center/corner mismatches) — see DECISIONS.md.
//
// A degree of longitude covers fewer meters the further from the equator you
// are (meters/° ≈ 111,320 × cos(lat)), so the SAME real-world WIDTH_M produces
// a *different* east-west cellWidth in degrees at Moscow's ~55.7°N than at
// Batumi's ~41.6°N (measured ~1.33× wider in degrees at Moscow) — this is why
// each city needs its own grid rather than one shared set of constants
// (previously hardcoded to Batumi's bbox only, which made every admin-placed
// draft on the Moscow map come out ~25% too narrow and phased against the
// wrong grid entirely).

const WIDTH_M = 600
const CELL_SIDE_M = WIDTH_M / Math.sqrt(3)
const EARTH_RADIUS_M = 6371008.8

const BBOXES: Record<CityId, { s: number; w: number; n: number; e: number }> = {
  batumi: { s: 41.48, w: 41.5, n: 41.72, e: 41.8 },
  moscow: { s: 55.5718, w: 37.3688, n: 55.9111, e: 37.8435 },
}

// Same haversine turf's own distance() uses, needed only to convert
// CELL_SIDE_M into degrees the same way hexGrid does (via the bbox's own
// center latitude) — not a general-purpose distance function.
function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_M
}

type Grid = {
  west: number
  south: number
  cellWidth: number
  cellHeight: number
  hexHeight: number
  xInterval: number
  yInterval: number
  xAdjust: number
  yAdjust: number
}

function buildGrid(bbox: { s: number; w: number; n: number; e: number }): Grid {
  const [west, south, east, north] = [bbox.w - 0.01, bbox.s - 0.01, bbox.e + 0.01, bbox.n + 0.01]
  const centerY = (south + north) / 2
  const centerX = (west + east) / 2
  const xFraction = (CELL_SIDE_M * 2) / haversineMeters(west, centerY, east, centerY)
  const cellWidth = xFraction * (east - west)
  const yFraction = (CELL_SIDE_M * 2) / haversineMeters(centerX, south, centerX, north)
  const cellHeight = yFraction * (north - south)
  const radius = cellWidth / 2
  const hexWidth = radius * 2
  const hexHeight = (Math.sqrt(3) / 2) * cellHeight
  const xInterval = (3 / 4) * hexWidth
  const yInterval = hexHeight
  const boxWidth = east - west
  const boxHeight = north - south
  const xSpan = (boxWidth - hexWidth) / (hexWidth - radius / 2)
  const xCount = Math.floor(xSpan)
  const xAdjust = (xCount * xInterval - radius / 2 - boxWidth) / 2 - radius / 2 + xInterval / 2
  const yCount = Math.floor((boxHeight - hexHeight) / hexHeight)
  let yAdjust = (boxHeight - yCount * hexHeight) / 2
  if (yCount * hexHeight - boxHeight > hexHeight / 2) yAdjust -= hexHeight / 4
  return { west, south, cellWidth, cellHeight, hexHeight, xInterval, yInterval, xAdjust, yAdjust }
}

const GRIDS: Record<CityId, Grid> = {
  batumi: buildGrid(BBOXES.batumi),
  moscow: buildGrid(BBOXES.moscow),
}

function cellCenter(grid: Grid, x: number, y: number): { lng: number; lat: number } {
  const isOdd = ((x % 2) + 2) % 2 === 1
  const lng = x * grid.xInterval + grid.west - grid.xAdjust
  let lat = y * grid.yInterval + grid.south + grid.yAdjust
  if (isOdd) lat -= grid.hexHeight / 2
  return { lng, lat }
}

// Cube-round-free nearest-cell lookup: invert the center formula for both
// possible x parities (the y formula's odd-column offset depends on it),
// try the neighboring integer on each axis, and keep whichever actual
// cell center ends up physically closest to the clicked point.
export function nearestHexCenter(lat: number, lng: number, city: CityId): { lat: number; lng: number; gridX: number; gridY: number } {
  const grid = GRIDS[city]
  const xRaw = (lng - grid.west + grid.xAdjust) / grid.xInterval
  let best: { x: number; y: number; lng: number; lat: number; d: number } | null = null
  for (const x of [Math.floor(xRaw), Math.ceil(xRaw)]) {
    const isOdd = ((x % 2) + 2) % 2 === 1
    const yShift = isOdd ? grid.hexHeight / 2 : 0
    const yRaw = (lat - grid.south - grid.yAdjust + yShift) / grid.yInterval
    for (const y of [Math.floor(yRaw), Math.ceil(yRaw)]) {
      const c = cellCenter(grid, x, y)
      const d = Math.hypot(c.lng - lng, c.lat - lat)
      if (!best || d < best.d) best = { x, y, ...c, d }
    }
  }
  return { lat: best!.lat, lng: best!.lng, gridX: best!.x, gridY: best!.y }
}

// Flat-top hexagon corners around a center, same cellWidth/cellHeight radii
// that city's own build_hex*.mjs's turf.hexGrid used — verified to reproduce
// every stored sector's corners exactly. Returned as [lat, lng] pairs,
// matching sectors.json / Territory['corners'].
export function hexCorners(centerLat: number, centerLng: number, city: CityId): [number, number][] {
  const grid = GRIDS[city]
  const rx = grid.cellWidth / 2
  const ry = grid.cellHeight / 2
  const corners: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angle = ((2 * Math.PI) / 6) * i
    corners.push([+(centerLat + ry * Math.sin(angle)).toFixed(6), +(centerLng + rx * Math.cos(angle)).toFixed(6)])
  }
  return corners
}

export type NewSectorDraft = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
  gridX: number
  gridY: number
}

// Builds the full draft for a sector at a clicked point, id not yet assigned
// (caller numbers it against the currently-known sector set — see
// nextSectorId below).
export function draftHexAt(lat: number, lng: number, kind: TerritoryKind, city: CityId): Omit<NewSectorDraft, 'id'> {
  const center = nearestHexCenter(lat, lng, city)
  return {
    kind,
    lat: center.lat,
    lng: center.lng,
    corners: hexCorners(center.lat, center.lng, city),
    gridX: center.gridX,
    gridY: center.gridY,
  }
}

// Existing ids of a given city's prefix are all e.g. "B" + exactly 4 digits
// but sparse (only water-touching cells from the original generation were
// kept) — next available is just one past the highest number seen so far for
// THAT prefix, independent of grid position. Other cities' ids are ignored
// (a mixed id list — the app has no per-city query for this — would
// otherwise let Moscow's higher numbers push new Batumi ids way out, or vice
// versa). Guarded to stay 4 digits like every other id rather than silently
// drifting to "B10000": at current sector counts this is nowhere close, so a
// hard error here means something's actually wrong (e.g. existingIds wasn't
// the real current set) rather than genuine exhaustion.
export function nextSectorId(existingIds: Iterable<string>, offset: number, prefix: string): string {
  let max = 0
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue
    const n = parseInt(id.slice(prefix.length), 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  const next = max + offset
  if (next > 9999) throw new Error(`sector id ${prefix}${next} would exceed 4 digits`)
  return prefix + String(next).padStart(4, '0')
}
