// Geometry of a crest's outline for the frames drawn round it (components/clan2/ClanItems.tsx): the outline as a
// polyline, where its corners are, and points set evenly along it. Pure maths on the shape's path (`d` of
// CREST_SHAPES), so the server and the browser get the same numbers.
//
// The paths use M L H V Q T C A Z (and their lower-case forms) — that is all this reads.

type P = { x: number; y: number }

const STEPS = 24 // points per curve

function arcPoints(p0: P, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, p1: P): P[] {
  // SVG arc, endpoint form → centre form (SVG 1.1, F.6.5).
  const phi = (rotDeg * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (p0.x - p1.x) / 2
  const dy = (p0.y - p1.y) / 2
  const x1 = cos * dx + sin * dy
  const y1 = -sin * dx + cos * dy
  let rx2 = rx * rx
  let ry2 = ry * ry
  const lam = (x1 * x1) / rx2 + (y1 * y1) / ry2
  if (lam > 1) {
    rx *= Math.sqrt(lam)
    ry *= Math.sqrt(lam)
    rx2 = rx * rx
    ry2 = ry * ry
  }
  const num = rx2 * ry2 - rx2 * y1 * y1 - ry2 * x1 * x1
  const den = rx2 * y1 * y1 + ry2 * x1 * x1
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  const cx1 = (k * rx * y1) / ry
  const cy1 = (-k * ry * x1) / rx
  const cx = cos * cx1 - sin * cy1 + (p0.x + p1.x) / 2
  const cy = sin * cx1 + cos * cy1 + (p0.y + p1.y) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
  if (!sweep && dt > 0) dt -= 2 * Math.PI
  if (sweep && dt < 0) dt += 2 * Math.PI
  const out: P[] = []
  for (let i = 1; i <= STEPS * 2; i++) {
    const t = t0 + (dt * i) / (STEPS * 2)
    out.push({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos })
  }
  return out
}

// The outline as one closed polyline. `corner[i]` marks the points where one command meets the next (the only places a
// corner can be).
export function flattenPath(d: string): { pts: P[]; joint: boolean[] } {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  const pts: P[] = []
  const joint: boolean[] = []
  let i = 0
  let cmd = ''
  let cur: P = { x: 0, y: 0 }
  let start: P = { x: 0, y: 0 }
  let lastCtrl: P | null = null
  let lastCmd = ''
  const num = () => parseFloat(tokens[i++])
  const push = (list: P[]) => {
    list.forEach((p, n) => {
      pts.push(p)
      joint.push(n === list.length - 1)
    })
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const ox = rel ? cur.x : 0
    const oy = rel ? cur.y : 0
    if (C === 'Z') {
      cur = start
      lastCtrl = null
      lastCmd = 'Z'
      continue
    }
    if (C === 'M') {
      cur = { x: ox + num(), y: oy + num() }
      start = cur
      pts.push(cur)
      joint.push(true)
      cmd = rel ? 'l' : 'L' // more pairs after M are lines
      lastCtrl = null
      lastCmd = 'M'
      continue
    }
    if (C === 'L' || C === 'H' || C === 'V') {
      const x = C === 'V' ? cur.x : ox + num()
      const y = C === 'H' ? cur.y : C === 'V' ? oy + num() : oy + num()
      cur = { x, y }
      push([cur])
      lastCtrl = null
    } else if (C === 'Q' || C === 'T') {
      let c: P
      if (C === 'Q') c = { x: ox + num(), y: oy + num() }
      else c = lastCtrl && (lastCmd === 'Q' || lastCmd === 'T') ? { x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y } : cur
      const e = { x: ox + num(), y: oy + num() }
      const list: P[] = []
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS
        list.push({ x: (1 - t) ** 2 * cur.x + 2 * (1 - t) * t * c.x + t * t * e.x, y: (1 - t) ** 2 * cur.y + 2 * (1 - t) * t * c.y + t * t * e.y })
      }
      push(list)
      lastCtrl = c
      cur = e
    } else if (C === 'C') {
      const c1 = { x: ox + num(), y: oy + num() }
      const c2 = { x: ox + num(), y: oy + num() }
      const e = { x: ox + num(), y: oy + num() }
      const list: P[] = []
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS
        const u = 1 - t
        list.push({ x: u ** 3 * cur.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * e.x, y: u ** 3 * cur.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * e.y })
      }
      push(list)
      lastCtrl = c2
      cur = e
    } else if (C === 'A') {
      const rx = num()
      const ry = num()
      const rot = num()
      const large = num() !== 0
      const sweep = num() !== 0
      const e = { x: ox + num(), y: oy + num() }
      push(arcPoints(cur, rx, ry, rot, large, sweep, e))
      lastCtrl = null
      cur = e
    } else {
      i++ // unknown: skip a number so the loop moves on
    }
    lastCmd = C
  }
  // A closed outline: drop the last point when it is the first one again.
  const a = pts[0]
  const b = pts[pts.length - 1]
  if (pts.length > 1 && Math.hypot(a.x - b.x, a.y - b.y) < 0.01) {
    pts.pop()
    joint.pop()
  }
  return { pts, joint }
}

export type FrameGeometry = {
  // Points set evenly along the outline: one in every corner, the same gaps between.
  studs: P[]
}

const cache = new Map<string, FrameGeometry>()

// `scale` grows the outline about the middle (50, 50) — the band of a frame lies 1.15 × the crest's outline out.
export function frameGeometry(d: string, scale: number, gap: number): FrameGeometry {
  const key = `${d}|${scale}|${gap}`
  const hit = cache.get(key)
  if (hit) return hit
  const flat = flattenPath(d)
  const pts = flat.pts.map((p) => ({ x: 50 + (p.x - 50) * scale, y: 50 + (p.y - 50) * scale }))
  const n = pts.length
  // Corners: a joint where the outline turns by more than 25°.
  const corners: number[] = []
  for (let k = 0; k < n; k++) {
    if (!flat.joint[k]) continue
    const a = pts[(k - 1 + n) % n]
    const b = pts[k]
    const c = pts[(k + 1) % n]
    const t1 = Math.atan2(b.y - a.y, b.x - a.x)
    const t2 = Math.atan2(c.y - b.y, c.x - b.x)
    let turn = Math.abs(t2 - t1)
    if (turn > Math.PI) turn = 2 * Math.PI - turn
    if (turn > (25 * Math.PI) / 180) corners.push(k)
  }
  // No corners (a circle): start at the very top so the studs stand the same on both sides.
  if (corners.length === 0) {
    let best = 0
    for (let k = 1; k < n; k++) if (pts[k].y < pts[best].y) best = k
    corners.push(best)
  }
  const seg = (k: number) => Math.hypot(pts[(k + 1) % n].x - pts[k].x, pts[(k + 1) % n].y - pts[k].y)
  const studs: P[] = []
  for (let c = 0; c < corners.length; c++) {
    const from = corners[c]
    const to = corners[(c + 1) % corners.length]
    // The run of the outline from this corner to the next (all the way round when there is one corner).
    const run: number[] = []
    let k = from
    do {
      run.push(k)
      k = (k + 1) % n
    } while (k !== to)
    const lengths = run.map(seg)
    const total = lengths.reduce((s, x) => s + x, 0)
    const count = Math.max(1, Math.round(total / gap))
    // `count` studs on this run: the corner itself, then evenly up to (not including) the next corner.
    let walked = 0
    let r = 0
    for (let s = 0; s < count; s++) {
      const want = (total * s) / count
      while (r < run.length - 1 && walked + lengths[r] < want) {
        walked += lengths[r]
        r++
      }
      const p = pts[run[r]]
      const q = pts[(run[r] + 1) % n]
      const t = lengths[r] > 0 ? (want - walked) / lengths[r] : 0
      studs.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
    }
  }
  const out = { studs }
  cache.set(key, out)
  return out
}
