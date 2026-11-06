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
// A vertical wash over the whole sector: top colour to bottom colour.
function wash(ctx: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// The inner rim light every skin ends with: a soft bright edge, so the sector reads as a lit jewel.
function rim(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, k = 0.5) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.62)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(1, withAlpha(color, k))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// «Прилив»: deep water in three layers of swell moving at their own speeds, foam on the crests, caustics shimmering
// and a slow bright sweep of light across the sector.
const tide: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const r = rand(seed + 0.1)
  wash(ctx, w, h, withAlpha('#8FD3F0', 0.55), withAlpha(color, 0.78))
  ctx.save()
  // Three layers of swell, the far ones paler and slower.
  for (let layer = 0; layer < 3; layer++) {
    const speed = 0.35 + layer * 0.3
    const amp = h * (0.035 + layer * 0.018)
    const base = h * (0.28 + layer * 0.24)
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w + 4; x += 4) {
      const y = base + Math.sin(x * (0.045 - layer * 0.008) + t * speed * 2 + seed * 9 + layer) * amp + Math.sin(x * 0.11 - t * speed) * amp * 0.4
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fillStyle = withAlpha(layer === 0 ? '#BFE9FA' : layer === 1 ? '#5FB6DE' : color, layer === 2 ? 0.55 : 0.32)
    ctx.fill()
    // The foam line on the crest.
    ctx.beginPath()
    for (let x = 0; x <= w + 4; x += 4) {
      const y = base + Math.sin(x * (0.045 - layer * 0.008) + t * speed * 2 + seed * 9 + layer) * amp + Math.sin(x * 0.11 - t * speed) * amp * 0.4
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.75 - layer * 0.15})`
    ctx.lineWidth = 1.5 - layer * 0.25
    ctx.stroke()
  }
  // Caustics: small bright diamonds drifting and flickering.
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 16; i++) {
    const x = wrap(r() + t * 0.012 * (1 + (i % 3))) * w
    const y = (0.25 + r() * 0.7) * h
    const a = 0.1 + 0.2 * Math.max(0, Math.sin(t * 1.6 + i * 2.1))
    ctx.fillStyle = `rgba(255,255,255,${a})`
    ctx.beginPath()
    ctx.moveTo(x, y - 2.4)
    ctx.lineTo(x + 3, y)
    ctx.lineTo(x, y + 2.4)
    ctx.lineTo(x - 3, y)
    ctx.closePath()
    ctx.fill()
  }
  // A sweep of light every few seconds.
  const sweep = wrap(t / 6 + seed)
  const sx = (sweep * 1.6 - 0.3) * w
  const g = ctx.createLinearGradient(sx - w * 0.18, 0, sx + w * 0.18, 0)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.28)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
  rim(ctx, w, h, '#0E4F7A', 0.35)
}

// «Сияние»: a night sky with stars that twinkle and four curtains of northern lights, green into violet, swaying and pulsing.
const aurora: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const r = rand(seed + 0.3)
  wash(ctx, w, h, '#0B1A33', '#16335A')
  ctx.save()
  // Stars.
  for (let i = 0; i < 26; i++) {
    const x = r() * w
    const y = r() * h * 0.8
    const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * (0.8 + r() * 1.6) + i * 3.3))
    ctx.fillStyle = `rgba(255,255,255,${a})`
    ctx.fillRect(x, y, 1.3, 1.3)
  }
  ctx.globalCompositeOperation = 'lighter'
  const hues = ['#3CF2A4', '#27D6C8', '#6B8CFF', '#B77CFF']
  for (let k = 0; k < 4; k++) {
    const cx = ((k + 0.5) / 4) * w + Math.sin(t * 0.45 + k * 1.7 + seed * 6) * w * 0.08
    const pulse = 0.55 + 0.45 * Math.sin(t * 0.9 + k * 2.2)
    const top = h * (0.08 + 0.05 * Math.sin(t * 0.6 + k))
    const bottom = h * (0.78 + 0.06 * Math.sin(t * 0.5 + k * 2))
    const g = ctx.createLinearGradient(0, top, 0, bottom)
    g.addColorStop(0, withAlpha(hues[k], 0))
    g.addColorStop(0.35, withAlpha(hues[k], 0.5 * pulse))
    g.addColorStop(1, withAlpha(hues[(k + 1) % 4], 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.14, bottom)
    for (let y = bottom; y >= top; y -= 6) {
      const sway = Math.sin(y * 0.05 + t * 1.1 + k * 1.3) * w * 0.06
      ctx.lineTo(cx - w * 0.1 + sway, y)
    }
    for (let y = top; y <= bottom; y += 6) {
      const sway = Math.sin(y * 0.05 + t * 1.1 + k * 1.3 + 0.9) * w * 0.06
      ctx.lineTo(cx + w * 0.1 + sway, y)
    }
    ctx.closePath()
    ctx.fill()
    // Bright rays inside the curtain.
    ctx.strokeStyle = withAlpha('#FFFFFF', 0.12 * pulse)
    ctx.lineWidth = 1
    for (let j = -2; j <= 2; j++) {
      ctx.beginPath()
      ctx.moveTo(cx + j * 5, bottom)
      ctx.lineTo(cx + j * 5 + Math.sin(t + j + k) * 6, top + 6)
      ctx.stroke()
    }
  }
  // A faint reflection at the bottom, in the clan's colour.
  const rg = ctx.createLinearGradient(0, h * 0.7, 0, h)
  rg.addColorStop(0, withAlpha(color, 0))
  rg.addColorStop(1, withAlpha(color, 0.35))
  ctx.fillStyle = rg
  ctx.fillRect(0, h * 0.7, w, h * 0.3)
  ctx.restore()
  rim(ctx, w, h, '#7CF5D2', 0.28)
}

// «Флотилия»: a bright sea, three boats with sails bobbing on the swell and leaving wakes, gulls crossing, glints of sun.
const flotilla: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const r = rand(seed + 0.6)
  wash(ctx, w, h, '#BFE8F7', withAlpha(color, 0.7))
  ctx.save()
  // The sea's lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.2
  for (let k = 0; k < 6; k++) {
    const y0 = h * (0.2 + k * 0.14)
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) {
      const y = y0 + Math.sin(x * 0.07 + t * 0.9 + k * 1.4 + seed * 7) * 2.2
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // Boats.
  for (let b = 0; b < 3; b++) {
    const dir = b % 2 ? -1 : 1
    const speed = 0.018 + b * 0.007
    const px = wrap(r() + t * speed * dir) * (w + 40) - 20
    const py = h * (0.32 + b * 0.22) + Math.sin(t * 1.3 + b * 2) * 1.8
    const sz = Math.min(w, h) * (0.15 - b * 0.012)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(Math.sin(t * 1.3 + b * 2 + 1) * 0.06)
    if (dir < 0) ctx.scale(-1, 1)
    // The wake behind.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-sz * 0.4, sz * 0.18)
    ctx.lineTo(-sz * 1.7, sz * 0.5)
    ctx.moveTo(-sz * 0.4, sz * 0.2)
    ctx.lineTo(-sz * 1.7, -sz * 0.06)
    ctx.stroke()
    // Hull, mast, two sails.
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.moveTo(-sz * 0.55, 0)
    ctx.lineTo(sz * 0.6, 0)
    ctx.lineTo(sz * 0.4, sz * 0.26)
    ctx.lineTo(-sz * 0.38, sz * 0.26)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = withAlpha('#17304A', 0.85)
    ctx.fillRect(-sz * 0.5, sz * 0.02, sz * 1.05, sz * 0.05)
    ctx.strokeStyle = '#6B4A22'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -sz * 1.15)
    ctx.stroke()
    ctx.fillStyle = b === 1 ? '#FFE08A' : '#FFFFFF'
    ctx.beginPath()
    ctx.moveTo(sz * 0.05, -sz * 1.1)
    ctx.quadraticCurveTo(sz * 0.62, -sz * 0.6, sz * 0.5, -sz * 0.08)
    ctx.lineTo(sz * 0.05, -sz * 0.08)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = withAlpha(color, 0.9)
    ctx.beginPath()
    ctx.moveTo(-sz * 0.05, -sz * 0.9)
    ctx.lineTo(-sz * 0.45, -sz * 0.1)
    ctx.lineTo(-sz * 0.05, -sz * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // Gulls.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1.2
  for (let g = 0; g < 2; g++) {
    const gx = wrap(r() + t * 0.03 + g * 0.5) * (w + 30) - 15
    const gy = h * (0.12 + g * 0.1) + Math.sin(t * 0.8 + g) * 3
    const flap = Math.sin(t * 7 + g * 3) * 2.5
    ctx.beginPath()
    ctx.moveTo(gx - 5, gy + flap)
    ctx.quadraticCurveTo(gx - 2, gy - 2, gx, gy)
    ctx.quadraticCurveTo(gx + 2, gy - 2, gx + 5, gy + flap)
    ctx.stroke()
  }
  // Glints.
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 10; i++) {
    const x = r() * w
    const y = (0.3 + r() * 0.65) * h
    const a = Math.max(0, Math.sin(t * 2.2 + i * 1.9))
    ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`
    ctx.fillRect(x - 1.5, y, 3, 0.9)
  }
  ctx.restore()
  rim(ctx, w, h, '#0F5E8C', 0.3)
}

// «Огни»: a dusk sky with lanterns rising, swaying and flickering, each in its own halo, and embers drifting up.
const lanterns: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const r = rand(seed + 0.9)
  wash(ctx, w, h, '#2A1B4D', '#C2552B')
  ctx.save()
  // A low glow on the horizon.
  const hg = ctx.createRadialGradient(w / 2, h * 1.02, 0, w / 2, h * 1.02, h * 0.9)
  hg.addColorStop(0, 'rgba(255,190,90,0.7)')
  hg.addColorStop(1, 'rgba(255,190,90,0)')
  ctx.fillStyle = hg
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'
  const g0 = glow('#FFB347')
  const g1 = glow('#FF6A3D')
  for (let i = 0; i < 9; i++) {
    const depth = 0.55 + r() * 0.45
    const cycle = 11 + i * 1.7
    const k = wrap(t / cycle + r())
    const x = (0.1 + r() * 0.8) * w + Math.sin(t * 0.8 + i * 2.3) * 5 * depth
    const y = h * (1.12 - k * 1.3)
    const flick = 0.82 + 0.18 * Math.sin(t * 9 + i * 4.1)
    const size = (6 + depth * 8) * (0.8 + 0.2 * Math.sin(i))
    const fade = Math.min(1, k * 6) * Math.min(1, (1 - k) * 5)
    ctx.globalAlpha = fade * flick
    ctx.drawImage(g0, x - size * 2.2, y - size * 2.2, size * 4.4, size * 4.4)
    ctx.drawImage(g1, x - size * 1.3, y - size * 1.3, size * 2.6, size * 2.6)
    ctx.globalAlpha = fade
    ctx.fillStyle = '#FFF1B8'
    ctx.beginPath()
    ctx.ellipse(x, y, size * 0.34, size * 0.48, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#FF9A3C'
    ctx.fillRect(x - size * 0.34, y + size * 0.4, size * 0.68, size * 0.12)
  }
  ctx.globalAlpha = 1
  // Embers.
  for (let i = 0; i < 18; i++) {
    const k = wrap(t * (0.05 + (i % 4) * 0.015) + r())
    const x = r() * w + Math.sin(t * 1.4 + i) * 3
    const y = h * (1 - k)
    ctx.fillStyle = `rgba(255,${160 + (i % 3) * 30},90,${(1 - k) * 0.8})`
    ctx.fillRect(x, y, 1.3, 1.3)
  }
  // The clan's colour in the water below.
  const wg = ctx.createLinearGradient(0, h * 0.78, 0, h)
  wg.addColorStop(0, withAlpha(color, 0))
  wg.addColorStop(1, withAlpha(color, 0.4))
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = wg
  ctx.fillRect(0, h * 0.78, w, h * 0.22)
  ctx.restore()
  rim(ctx, w, h, '#FFB86A', 0.3)
}

export const CLAN_ANIMATED_SKINS: Record<string, AnimatedSkinDraw> = {
  clan_tide: tide,
  clan_aurora: aurora,
  clan_flotilla: flotilla,
  clan_lanterns: lanterns,
}
