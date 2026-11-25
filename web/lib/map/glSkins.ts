// The sector skins of the paid live-background families (25.11.2026, owner: «new skins in our style, based on the new paid
// backgrounds»; then «take the pattern the background itself gives, only the aurora, starfield, particles, beams and
// matrix; more contrast, like the other skins, thicker lines if needed»): five skins, each the pattern of its background,
// sold separately for Telegram Stars (not in the kit).
// Drawn like the other animated skins (animatedSkins.ts): a function painting frame t into the sector's box, the hex
// already clipped by the caller. Only the pattern goes on, no ground of its own: the sector keeps its colour and tint, and
// the pattern is inked in a deeper shade of that colour (with white highlights) so it reads on any tint. The aurora keeps
// its family's colours. `seed` makes neighbours differ.
import type { AnimatedSkinDraw } from '@/lib/map/animatedSkins'

const TAU = Math.PI * 2

function rand(seed: number) {
  let s = ((seed * 2654435761) % 2147483646) + 1
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function toRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex: string, a: number) {
  const c = toRgb(hex)
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : hex
}

// The sector's colour darkened by k (0 = as is, 1 = black): the ink of the patterns. Gives a hex so it can take an alpha.
function shade(hex: string, k: number) {
  const c = toRgb(hex)
  if (!c) return hex
  return '#' + c.map((v) => Math.round(v * (1 - k)).toString(16).padStart(2, '0')).join('')
}

function reset(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

// A four-point star.
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.quadraticCurveTo(x, y, x, y + r)
  ctx.quadraticCurveTo(x, y, x - r, y)
  ctx.quadraticCurveTo(x, y, x, y - r)
  ctx.closePath()
  ctx.fill()
}

// «Северное сияние»: curtains of light swaying and breathing, emerald into violet.
const AURORA = ['#12C46E', '#0FB8A8', '#3B6BFF', '#8B3DFF']
const aurora: AnimatedSkinDraw = (ctx, w, h, t, _color, seed = 0) => {
  reset(ctx)
  const N = 9
  const bw = (w / N) * 1.45
  for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N) * w + Math.sin(t * 0.35 + i * 0.8 + seed * 6) * w * 0.03
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.5 + i * 1.3 + seed * 9)
    const height = h * (0.5 + 0.3 * breathe)
    const bottom = h * 0.92 + Math.sin(t * 0.4 + i * 0.6) * h * 0.02
    const c = AURORA[Math.min(AURORA.length - 1, Math.round((i / (N - 1)) * (AURORA.length - 1)))]
    const g = ctx.createLinearGradient(0, bottom - height, 0, bottom)
    g.addColorStop(0, rgba(c, 0))
    g.addColorStop(0.55, rgba(c, 0.55 + 0.15 * breathe))
    g.addColorStop(1, rgba(c, 0.95))
    ctx.fillStyle = g
    ctx.fillRect(x - bw / 2, bottom - height, bw, height)
  }
}

// «Звёздное небо»: stars twinkling and drifting in three layers, the bright ones four-pointed.
const starfield: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  reset(ctx)
  const S = Math.min(w, h)
  const ink = shade(color, 0.55)
  const r = rand(Math.floor(seed * 997) + 211)
  for (let n = 0; n < 34; n++) {
    const layer = n % 3
    const x0 = r() * w
    const y0 = r() * h
    const x = (((x0 + t * (layer + 1) * 0.004 * w) % w) + w) % w
    const tw = 0.5 + 0.5 * Math.sin(t * (0.8 + r() * 2.2) + r() * TAU)
    const size = S * (0.014 + layer * 0.012 + r() * 0.008)
    ctx.globalAlpha = 0.55 + 0.45 * tw
    ctx.fillStyle = ink
    if (layer === 2) sparkle(ctx, x, y0, size * 3.2 * (0.7 + 0.4 * tw))
    else {
      ctx.beginPath()
      ctx.arc(x, y0, size, 0, TAU)
      ctx.fill()
    }
    if (layer === 2) {
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(x, y0, size * 0.55, 0, TAU)
      ctx.fill()
    }
  }
  reset(ctx)
}

// «Частицы»: dots of light wandering and breathing, a few bigger ones.
const particles: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  reset(ctx)
  const S = Math.min(w, h)
  const ink = shade(color, 0.5)
  const r = rand(Math.floor(seed * 997) + 307)
  for (let n = 0; n < 30; n++) {
    const x0 = r() * w
    const y0 = r() * h
    const a = 0.2 + r() * 0.5
    const p = r() * TAU
    const reach = S * (0.04 + r() * 0.07)
    const x = x0 + Math.sin(t * a + p) * reach
    const y = (((y0 - t * S * 0.006 * (0.4 + r())) % h) + h) % h + Math.cos(t * a * 0.8 + p) * reach * 0.6
    const size = S * (0.018 + r() * 0.034)
    const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + r() * 1.6) + p)
    ctx.globalAlpha = 0.45 + 0.5 * tw
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(x, y, size, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.5 + 0.4 * tw
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(x - size * 0.25, y - size * 0.25, size * 0.38, 0, TAU)
    ctx.fill()
  }
  reset(ctx)
}

// «Лучи»: faint tracks across the sector and beams running along them, each with a bright head and a fading tail.
const beams: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  reset(ctx)
  const L = Math.hypot(w, h) / 2
  const S = Math.min(w, h)
  const lw = Math.max(1.2, S * 0.02)
  const ink = shade(color, 0.5)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((28 * Math.PI) / 180)
  const tracks = 6
  for (let i = 0; i < tracks; i++) {
    const v = (i / (tracks - 1) - 0.5) * S * 1.1
    ctx.strokeStyle = rgba(ink, 0.3)
    ctx.lineWidth = lw * 0.8
    ctx.beginPath()
    ctx.moveTo(-L, v)
    ctx.lineTo(L, v)
    ctx.stroke()
    const speed = 0.12 + ((i * 37) % 7) * 0.02
    const phase = (seed * 3 + i * 0.23) % 1
    const head = -L * 0.2 + ((t * speed + phase) % 1) * (L * 2.2)
    const tail = L * 0.75
    const g = ctx.createLinearGradient(head - tail, 0, head, 0)
    g.addColorStop(0, rgba(ink, 0))
    g.addColorStop(1, rgba(ink, 1))
    ctx.strokeStyle = g
    ctx.lineWidth = lw * 1.8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(head - tail, v)
    ctx.lineTo(head, v)
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(head, v, lw * 1.3, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = lw * 0.5
    ctx.stroke()
  }
  ctx.restore()
}

// «Матрица»: columns of falling glyphs, each with a bright head and a fading tail.
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789'
const matrix: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  reset(ctx)
  const S = Math.min(w, h)
  const fs = Math.max(8, S * 0.12)
  const cols = Math.max(4, Math.floor(w / (fs * 1.05)))
  const rows = Math.ceil(h / fs)
  const ink = shade(color, 0.55)
  const deep = shade(color, 0.8)
  const r = rand(Math.floor(seed * 997) + 401)
  ctx.font = `bold ${fs}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tail = 6
  for (let c = 0; c < cols; c++) {
    const speed = 2 + r() * 3
    const off = r() * (rows + tail)
    const head = (t * speed + off) % (rows + tail)
    for (let k = 0; k < tail; k++) {
      const row = Math.floor(head) - k
      if (row < 0 || row >= rows) continue
      const gi = Math.floor((c * 7 + row * 13 + Math.floor(t * (k === 0 ? 6 : 1.5)) * 3) % GLYPHS.length)
      ctx.globalAlpha = k === 0 ? 1 : Math.max(0.3, 0.95 * (1 - k / tail))
      ctx.fillStyle = k === 0 ? deep : ink
      ctx.fillText(GLYPHS[gi], (c + 0.5) * (w / cols), (row + 0.5) * fs)
    }
  }
  reset(ctx)
}

export const GL_ANIMATED_SKINS: Record<string, AnimatedSkinDraw> = {
  skin_gl_aurora: aurora,
  skin_gl_starfield: starfield,
  skin_gl_particles: particles,
  skin_gl_beams: beams,
  skin_gl_matrix: matrix,
}
