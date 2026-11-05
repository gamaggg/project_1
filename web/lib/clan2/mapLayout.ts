// The preview map: a hexagon of radius 3 (37 flat-top sectors) fitted into a
// box. Axial coordinates (q, r) ↔ pixels, and the other way round for taps.

const SQ3 = Math.sqrt(3)
const RADIUS = 3

export type MapLayout = { s: number; cx: number; cy: number; w: number; h: number }

// The hexagon is (3R + 2)·s wide and about 12.1·s tall; leave room for the HUD above and below.
export function fitLayout(w: number, h: number): MapLayout {
  const s = Math.max(12, Math.min((w - 20) / (3 * RADIUS + 2), (h - 150) / 12.12))
  return { s, cx: w / 2, cy: h / 2 + 8, w, h }
}

export function hexCenter(l: MapLayout, q: number, r: number): { x: number; y: number } {
  return { x: l.cx + l.s * 1.5 * q, y: l.cy + l.s * SQ3 * (r + q / 2) }
}

export function hexSize(l: MapLayout): { w: number; h: number } {
  return { w: l.s * 2, h: l.s * SQ3 }
}

// The sector under a pixel, by cube-rounding the fractional axial coordinates.
export function pixelToHex(l: MapLayout, x: number, y: number): { q: number; r: number } {
  const px = x - l.cx
  const py = y - l.cy
  const fq = ((2 / 3) * px) / l.s
  const fr = ((-1 / 3) * px + (SQ3 / 3) * py) / l.s
  let q = Math.round(fq)
  let r = Math.round(fr)
  const rs = Math.round(-fq - fr)
  const dq = Math.abs(q - fq)
  const dr = Math.abs(r - fr)
  const ds = Math.abs(rs + fq + fr)
  if (dq > dr && dq > ds) q = -r - rs
  else if (dr > ds) r = -q - rs
  return { q, r }
}
