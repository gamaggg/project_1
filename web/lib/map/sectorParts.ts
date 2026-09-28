// A sector shared by clan-mates (see Territory.coHolders) is drawn as its
// hex cut into one equal part per holder — 2, 3 or 4 — with each holder's
// avatar in the middle of their part and the sector id still at the center.
// Shared by the big map (LeafletMap) and the sector screen's mini-map
// (TerritoryThumbnailMap) so both cut it the same way.
//
// How the cut stays exactly equal: walking the hex outline through all six
// vertices AND all six edge midpoints gives 12 points, and the center plus
// any two neighbours is a triangle of the same area (half of one of the
// hex's six center triangles). A part is then just a run of 12/n of those
// triangles — 6 for halves, 4 for thirds, 3 for quarters.
//
// Layout, on screen: 2 → top / bottom (a horizontal cut, so both avatars
// clear the id at the center), 3 → an upright «Y» (one part on top, two
// below), 4 → a «+» (top-left, top-right, bottom-right, bottom-left).
// Part 0 always goes to the owner.

export type LatLng = [number, number]

export type SectorSplit = {
  center: LatLng
  // One polygon per holder, owner first, then clockwise.
  parts: LatLng[][]
  // Where each holder's avatar sits — the area centroid of their part.
  centroids: LatLng[]
  // Points on the outline where the dividing lines run to from the center.
  cuts: LatLng[]
}

const MAX_HOLDERS = 4

function mid(a: LatLng, b: LatLng): LatLng {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

// Shoelace in (x = lng, y = lat) — lat grows upward on screen, so a
// positive area means the points run counter-clockwise as seen on the map.
function signedArea(points: LatLng[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [y1, x1] = points[i]
    const [y2, x2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

function centroid(points: LatLng[]): LatLng {
  const area = signedArea(points)
  if (Math.abs(area) < 1e-18) {
    const lat = points.reduce((s, p) => s + p[0], 0) / points.length
    const lng = points.reduce((s, p) => s + p[1], 0) / points.length
    return [lat, lng]
  }
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const [y1, x1] = points[i]
    const [y2, x2] = points[(i + 1) % points.length]
    const cross = x1 * y2 - x2 * y1
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  return [cy / (6 * area), cx / (6 * area)]
}

// null for an unshared sector (fewer than 2 holders) or a shape that isn't
// a hex — the caller just draws the sector whole, as before.
export function splitSector(corners: LatLng[], holders: number): SectorSplit | null {
  const n = Math.min(holders, MAX_HOLDERS)
  if (n < 2 || corners.length !== 6) return null

  const center: LatLng = [corners.reduce((s, c) => s + c[0], 0) / 6, corners.reduce((s, c) => s + c[1], 0) / 6]
  let ring: LatLng[] = []
  corners.forEach((c, i) => ring.push(c, mid(c, corners[(i + 1) % 6])))
  // Clockwise on screen, so "next part" always means the same direction.
  if (signedArea(ring) > 0) ring = ring.reverse()

  // 12 o'clock: the topmost point, ties (a flat top edge) broken toward the
  // middle — i.e. the top edge's midpoint on this grid's flat-top hexes.
  let top = 0
  ring.forEach((p, i) => {
    const best = ring[top]
    if (p[0] > best[0] + 1e-9 || (Math.abs(p[0] - best[0]) <= 1e-9 && Math.abs(p[1] - center[1]) < Math.abs(best[1] - center[1]))) top = i
  })

  const slots = 12 / n
  // Where part 0 starts, in ring steps from 12 o'clock (clockwise): halves
  // and quarters start at 9 o'clock, so part 0 is the top half / top-left
  // quarter; thirds start two steps before 12, so part 0 is the top wedge
  // of the «Y».
  const offset = n === 3 ? 10 : 9
  const at = (k: number) => ring[(top + offset + k) % 12]

  const parts: LatLng[][] = []
  const cuts: LatLng[] = []
  for (let p = 0; p < n; p++) {
    const poly: LatLng[] = [center]
    for (let k = 0; k <= slots; k++) poly.push(at(p * slots + k))
    parts.push(poly)
    cuts.push(at(p * slots))
  }
  return { center, parts, centroids: parts.map(centroid), cuts }
}
