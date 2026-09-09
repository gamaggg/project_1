import type { TerritoryKind } from '@/lib/data/types'

// Reproduces the exact hex grid tools/fishing-hex/build_hex.mjs used to
// generate public/data/sectors.json (via @turf/turf's hexGrid), so an
// admin-placed sector snaps to the SAME grid and tiles seamlessly with the
// existing 289 without shifting any of them. Ported by hand instead of
// depending on @turf/turf client-side: turf's hexGrid centers its whole
// output within the given bbox (see its x_adjust/y_adjust), so calling it
// again with a bigger bbox to cover a new area silently re-phases every
// cell — verified empirically (tools/fishing-hex/hex_grid_probe2.mjs) rather
// than assumed. What's stable across bbox sizes is the *formula* itself, so
// this fixes its constants once from the original bbox/cellSide and treats
// the grid as infinite from there — verified byte-for-byte against all 289
// stored sectors (0 center/corner mismatches) — see DECISIONS.md.

const BBOX = { s: 41.48, w: 41.5, n: 41.72, e: 41.8 }
const WIDTH_M = 600
const CELL_SIDE_M = WIDTH_M / Math.sqrt(3)
const EARTH_RADIUS_M = 6371008.8

const [west, south, east, north] = [BBOX.w - 0.01, BBOX.s - 0.01, BBOX.e + 0.01, BBOX.n + 0.01]

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

function cellCenter(x: number, y: number): { lng: number; lat: number } {
  const isOdd = ((x % 2) + 2) % 2 === 1
  const lng = x * xInterval + west - xAdjust
  let lat = y * yInterval + south + yAdjust
  if (isOdd) lat -= hexHeight / 2
  return { lng, lat }
}

// Cube-round-free nearest-cell lookup: invert the center formula for both
// possible x parities (the y formula's odd-column offset depends on it),
// try the neighboring integer on each axis, and keep whichever actual
// cell center ends up physically closest to the clicked point.
export function nearestHexCenter(lat: number, lng: number): { lat: number; lng: number; gridX: number; gridY: number } {
  const xRaw = (lng - west + xAdjust) / xInterval
  let best: { x: number; y: number; lng: number; lat: number; d: number } | null = null
  for (const x of [Math.floor(xRaw), Math.ceil(xRaw)]) {
    const isOdd = ((x % 2) + 2) % 2 === 1
    const yShift = isOdd ? hexHeight / 2 : 0
    const yRaw = (lat - south - yAdjust + yShift) / yInterval
    for (const y of [Math.floor(yRaw), Math.ceil(yRaw)]) {
      const c = cellCenter(x, y)
      const d = Math.hypot(c.lng - lng, c.lat - lat)
      if (!best || d < best.d) best = { x, y, ...c, d }
    }
  }
  return { lat: best!.lat, lng: best!.lng, gridX: best!.x, gridY: best!.y }
}

// Flat-top hexagon corners around a center, same cellWidth/cellHeight radii
// build_hex.mjs's turf.hexGrid used — verified to reproduce every stored
// sector's corners exactly. Returned as [lat, lng] pairs, matching
// sectors.json / Territory['corners'].
export function hexCorners(centerLat: number, centerLng: number): [number, number][] {
  const rx = cellWidth / 2
  const ry = cellHeight / 2
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
export function draftHexAt(lat: number, lng: number, kind: TerritoryKind): Omit<NewSectorDraft, 'id'> {
  const center = nearestHexCenter(lat, lng)
  return {
    kind,
    lat: center.lat,
    lng: center.lng,
    corners: hexCorners(center.lat, center.lng),
    gridX: center.gridX,
    gridY: center.gridY,
  }
}

// Existing ids are all "B" + exactly 4 digits but sparse (only
// water-touching cells from the original generation were kept) — next
// available is just one past the highest number seen so far, independent of
// grid position. Guarded to stay 4 digits like every other id rather than
// silently drifting to "B10000": at current sector counts this is nowhere
// close, so a hard error here means something's actually wrong (e.g.
// existingIds wasn't the real current set) rather than genuine exhaustion.
export function nextSectorId(existingIds: Iterable<string>, offset: number): string {
  let max = 0
  for (const id of existingIds) {
    const n = parseInt(id.slice(1), 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  const next = max + offset
  if (next > 9999) throw new Error(`sector id B${next} would exceed 4 digits`)
  return 'B' + String(next).padStart(4, '0')
}
