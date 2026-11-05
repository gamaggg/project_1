import type { AnimatedSkinDraw } from '@/lib/map/animatedSkins'

// The clan skins: animated sector fills a clan buys with its treasury (never
// sold for personal coins). Same contract as lib/map/animatedSkins.ts — a
// function painting frame t (seconds) into the sector's box (0,0)–(w,h), after
// the caller has clipped to the hex and laid the 30 % tint of `color` under
// it; `seed` (0–1) is the sector's own number so neighbours do not play in
// step. Merged into ANIMATED_SKINS there, so the map and the Shop's picker
// treat them like any other animated skin.

const TAU = Math.PI * 2

function rand(seed: number) {
  let s = ((Math.floor(seed * 1e6) * 2654435761) % 2147483646) + 1
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function withAlpha(color: string, alpha: number) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  if (!m) return color
  const hex = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${alpha})`
}

const glowCache = new Map<string, HTMLCanvasElement>()
// A soft round glow, drawn once per colour and reused.
function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color)
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = 48
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24)
    grad.addColorStop(0, withAlpha(color, 1))
    grad.addColorStop(0.3, withAlpha(color, 0.5))
    grad.addColorStop(1, withAlpha(color, 0))
    g.fillStyle = grad
    g.fillRect(0, 0, 48, 48)
    glowCache.set(color, c)
  }
  return c
}

const wrap = (x: number) => ((x % 1) + 1) % 1

// «Прилив»: long swells rolling across the sector in rows, each with a pale
// foam line on its crest and a glint that runs along it.
const tide: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const dir = seed > 0.5 ? 1 : -1
  const rows = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let k = 0; k < rows; k++) {
    const base = h * (0.14 + (k / (rows - 1)) * 0.74)
    const amp = h * (0.028 + 0.012 * Math.sin(k * 1.7))
    const freq = TAU / (w * (0.62 - k * 0.05))
    const speed = (0.55 + k * 0.13) * dir
    const phase = seed * TAU + k * 1.3
    const y = (x: number) => base + Math.sin(x * freq + t * speed + phase) * amp + Math.sin(x * freq * 2.3 - t * speed * 0.7) * amp * 0.35
    // The water under the crest.
    ctx.beginPath()
    ctx.moveTo(0, y(0))
    for (let x = 4; x <= w; x += 4) ctx.lineTo(x, y(x))
    ctx.lineTo(w, y(w) + h * 0.16)
    ctx.lineTo(0, y(0) + h * 0.16)
    ctx.closePath()
    ctx.fillStyle = withAlpha(color, 0.1 + k * 0.018)
    ctx.fill()
    // The crest.
    ctx.beginPath()
    ctx.moveTo(0, y(0))
    for (let x = 4; x <= w; x += 4) ctx.lineTo(x, y(x))
    ctx.strokeStyle = withAlpha(color, 0.62)
    ctx.lineWidth = Math.max(1.2, w * 0.011)
    ctx.stroke()
    // The foam: a short bright stretch of the crest that slides along it.
    const head = wrap(t * 0.07 * dir + k * 0.31 + seed) * w * 1.4 - w * 0.2
    ctx.beginPath()
    let started = false
    for (let x = head - w * 0.14; x <= head + w * 0.14; x += 4) {
      if (x < 0 || x > w) continue
      if (started) ctx.lineTo(x, y(x) - 1)
      else ctx.moveTo(x, y(x) - 1)
      started = true
    }
    ctx.strokeStyle = 'rgba(255,255,255,.8)'
    ctx.lineWidth = Math.max(1.4, w * 0.014)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// «Сияние»: three curtains of northern light hanging over the sector,
// swaying and breathing, with a few stars blinking in the dark between them.
const aurora: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const r = rand(seed + 0.17)
  ctx.fillStyle = '#04122B'
  ctx.globalAlpha = 0.16
  ctx.fillRect(0, 0, w, h)
  const tints = ['#5CFFC8', '#8AB6FF', '#C98BFF']
  for (let k = 0; k < 3; k++) {
    const cx = w * (0.2 + 0.3 * k) + Math.sin(t * 0.3 + k * 2 + seed * 6) * w * 0.07
    const width = w * (0.2 + 0.05 * Math.sin(t * 0.5 + k))
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.7 + k * 1.9 + seed * 9)
    const sway = (y: number) => Math.sin(y * 0.014 + t * (0.8 + k * 0.25) + k) * w * 0.06
    const tint = tints[(k + Math.floor(seed * 3)) % 3]
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, withAlpha(tint, 0))
    grad.addColorStop(0.25, withAlpha(tint, 0.5 * breathe + 0.15))
    grad.addColorStop(0.6, withAlpha(color, 0.3 * breathe + 0.1))
    grad.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = grad
    ctx.globalAlpha = 1
    ctx.beginPath()
    for (let y = 0; y <= h; y += 6) ctx.lineTo(cx - width / 2 + sway(y), y)
    for (let y = h; y >= 0; y -= 6) ctx.lineTo(cx + width / 2 + sway(y) * 1.2, y)
    ctx.closePath()
    ctx.fill()
    // The bright folded edge of the curtain.
    ctx.beginPath()
    for (let y = 0; y <= h; y += 6) ctx.lineTo(cx - width / 2 + sway(y), y)
    ctx.strokeStyle = withAlpha('#FFFFFF', 0.28 * breathe + 0.06)
    ctx.lineWidth = Math.max(1, w * 0.008)
    ctx.stroke()
  }
  for (let i = 0; i < 9; i++) {
    const x = r() * w
    const y = r() * h * 0.7
    const blink = 0.5 + 0.5 * Math.sin(t * (1.2 + r()) + r() * TAU)
    ctx.globalAlpha = 0.15 + 0.6 * blink
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.8, w * 0.007) * (0.6 + blink * 0.6), 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// «Флотилия»: small sailing boats cross the sector at their own speeds,
// bobbing on the swell with a V of wake behind each.
const flotilla: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const dir = seed > 0.5 ? 1 : -1
  const boats = [
    { y: 0.3, speed: 0.045, size: 0.13, off: 0 },
    { y: 0.56, speed: 0.032, size: 0.17, off: 0.45 },
    { y: 0.8, speed: 0.058, size: 0.1, off: 0.8 },
  ]
  // A little swell under everything.
  ctx.strokeStyle = withAlpha(color, 0.22)
  ctx.lineWidth = Math.max(1, w * 0.007)
  ctx.lineCap = 'round'
  for (let k = 0; k < 6; k++) {
    const y0 = h * (0.12 + k * 0.16)
    ctx.beginPath()
    for (let x = 0; x <= w; x += 5) {
      const y = y0 + Math.sin(x * 0.045 + t * 0.9 + k * 1.4 + seed * 5) * h * 0.012
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  for (const b of boats) {
    const p = wrap(t * b.speed * dir + b.off + seed)
    const x = (dir > 0 ? p : 1 - p) * (w * 1.3) - w * 0.15
    const bob = Math.sin(t * 1.6 + b.off * 9 + seed * 7)
    const y = h * b.y + bob * h * 0.012
    const s = w * b.size
    // The wake.
    ctx.strokeStyle = 'rgba(255,255,255,.45)'
    ctx.lineWidth = Math.max(1, s * 0.07)
    for (const sign of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x - dir * s * 0.45, y + s * 0.34)
      ctx.lineTo(x - dir * s * (1.5 + 0.2 * Math.sin(t * 2 + b.off)), y + s * 0.34 + sign * s * 0.32)
      ctx.stroke()
    }
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(dir, 1)
    ctx.rotate(bob * 0.05)
    // Hull.
    ctx.fillStyle = withAlpha(color, 0.95)
    ctx.beginPath()
    ctx.moveTo(-s * 0.5, s * 0.2)
    ctx.lineTo(s * 0.5, s * 0.2)
    ctx.lineTo(s * 0.34, s * 0.4)
    ctx.lineTo(-s * 0.38, s * 0.4)
    ctx.closePath()
    ctx.fill()
    // Mast and the two sails.
    ctx.strokeStyle = withAlpha(color, 0.95)
    ctx.lineWidth = Math.max(1, s * 0.05)
    ctx.beginPath()
    ctx.moveTo(0, s * 0.2)
    ctx.lineTo(0, -s * 0.52)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.92)'
    ctx.beginPath()
    ctx.moveTo(s * 0.04, -s * 0.5)
    ctx.lineTo(s * 0.04, s * 0.14)
    ctx.lineTo(s * 0.46, s * 0.14)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.7)'
    ctx.beginPath()
    ctx.moveTo(-s * 0.04, -s * 0.34)
    ctx.lineTo(-s * 0.04, s * 0.14)
    ctx.lineTo(-s * 0.36, s * 0.14)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

// «Огни»: warm lanterns rising from the water, swaying as they climb, each
// flickering on its own beat, with a few sparks drifting up beside them.
const lanterns: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const warm = glow('#FFB347')
  const hot = glow('#FFE9A8')
  const base = glow(color)
  const r = rand(seed + 0.31)
  const n = 7
  for (let i = 0; i < n; i++) {
    const x0 = (0.1 + 0.8 * r()) * w
    const speed = 0.05 + r() * 0.05
    const off = r()
    const size = w * (0.09 + r() * 0.07)
    const p = wrap(t * speed + off)
    const y = h * (1.1 - p * 1.25)
    const x = x0 + Math.sin(t * 0.9 + i * 2.3 + seed * 8) * w * 0.05 + Math.sin(p * 6 + i) * w * 0.03
    const flick = 0.75 + 0.25 * Math.sin(t * (4 + r() * 3) + i * 5)
    const fade = Math.min(1, p * 5) * Math.min(1, (1 - p) * 4)
    ctx.globalAlpha = 0.55 * fade
    ctx.drawImage(base, x - size * 1.6, y - size * 1.6, size * 3.2, size * 3.2)
    ctx.globalAlpha = 0.85 * flick * fade
    ctx.drawImage(warm, x - size * 1.2, y - size * 1.2, size * 2.4, size * 2.4)
    ctx.globalAlpha = 0.95 * flick * fade
    ctx.drawImage(hot, x - size * 0.5, y - size * 0.5, size, size)
    // The paper body.
    ctx.globalAlpha = 0.9 * fade
    ctx.fillStyle = '#FFB347'
    ctx.beginPath()
    ctx.moveTo(x - size * 0.2, y - size * 0.26)
    ctx.lineTo(x + size * 0.2, y - size * 0.26)
    ctx.lineTo(x + size * 0.15, y + size * 0.24)
    ctx.lineTo(x - size * 0.15, y + size * 0.24)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.fillRect(x - size * 0.2, y - size * 0.3, size * 0.4, size * 0.06)
  }
  // Sparks.
  ctx.fillStyle = '#FFE9A8'
  for (let i = 0; i < 12; i++) {
    const p = wrap(t * (0.08 + r() * 0.06) + r())
    const x = r() * w + Math.sin(t + i) * w * 0.02
    const y = h * (1 - p)
    ctx.globalAlpha = 0.8 * Math.sin(p * Math.PI)
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.7, w * 0.005), 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export const CLAN_ANIMATED_SKINS: Record<string, AnimatedSkinDraw> = {
  clan_tide: tide,
  clan_aurora: aurora,
  clan_flotilla: flotilla,
  clan_lanterns: lanterns,
}
