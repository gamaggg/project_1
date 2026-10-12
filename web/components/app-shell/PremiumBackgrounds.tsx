'use client'

import { useEffect, useRef } from 'react'
import { observeScreenActive } from '@/lib/observeScreenActive'

// The premium (800+) hero backgrounds — each a whole little scene painted
// on one canvas: «Глубина» (light shafts and drifting motes under water),
// «Лунная дорожка» (stars, the moon and its path shimmering on the sea),
// «Косяк» (two schools of fish swimming by), «Золотая пыль» (gold dust,
// flaring sparkles, a sheen now and then).
//
// A scene is built for the canvas's size and returns a draw(t) that paints
// the frame for time t (seconds) — positions come from t rather than from
// per-frame steps, so a still frame (prefers-reduced-motion, first paint)
// is just draw(t). Lifecycle as the other live backgrounds: first paint on
// ResizeObserver, the loop runs only on the visible screen, time only
// advances while it runs (no jump on coming back).

type Scene = (ctx: CanvasRenderingContext2D, w: number, h: number) => (t: number) => void

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function LiveCanvas({ scene }: { scene: Scene }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const container = canvas?.parentElement
    if (!canvas || !ctx || !container) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let draw: ((t: number) => void) | null = null
    // Starts a few seconds in so the very first frame isn't every element
    // at its phase-zero spot.
    let t = 4
    let last = 0
    let frameId = 0
    let running = false
    let sized = false
    let active = false

    function frame(now: number) {
      if (!running) return
      if (last) t += Math.min((now - last) / 1000, 0.05)
      last = now
      draw?.(t)
      frameId = requestAnimationFrame(frame)
    }
    function start() {
      if (running || !sized || !active || reduceMotion) return
      running = true
      last = 0
      frameId = requestAnimationFrame(frame)
    }
    function stop() {
      running = false
      cancelAnimationFrame(frameId)
    }

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw = scene(ctx, w, h)
      sized = true
      draw(t)
      start()
    })
    ro.observe(container)
    const stopWatching = observeScreenActive(canvas, (a) => {
      active = a
      if (a) start()
      else stop()
    })
    return () => {
      stop()
      ro.disconnect()
      stopWatching()
    }
  }, [scene])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: -1 }} />
}

function glowSprite(rgb: string, stops: [number, number][]): HTMLCanvasElement {
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, a] of stops) grad.addColorStop(at, `rgba(${rgb},${a})`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

// «Глубина»: slanted shafts of light swaying from the surface, motes rising
// through them.
const deepScene: Scene = (ctx, w, h) => {
  const r = rand(11)
  const water = ctx.createLinearGradient(0, 0, 0, h)
  water.addColorStop(0, '#0E4A5C')
  water.addColorStop(0.55, '#082A38')
  water.addColorStop(1, '#03121A')
  const shaft = ctx.createLinearGradient(0, 0, 0, h)
  shaft.addColorStop(0, 'rgba(160,235,255,1)')
  shaft.addColorStop(0.75, 'rgba(160,235,255,0)')
  const rays = Array.from({ length: 6 }, (_, i) => ({
    x: w * (0.02 + i * 0.19 + (r() - 0.5) * 0.08),
    width: w * (0.05 + r() * 0.07),
    phase: r() * Math.PI * 2,
    speed: 0.18 + r() * 0.16,
  }))
  const motes = Array.from({ length: Math.round(Math.min(48, Math.max(18, (w * h) / 3500))) }, () => ({
    x: r() * w,
    y: r() * h,
    size: 0.6 + r() * 1.3,
    rise: 4 + r() * 10,
    phase: r() * Math.PI * 2,
  }))
  return (t) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = water
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = shaft
    for (const ray of rays) {
      const sway = Math.sin(t * ray.speed + ray.phase)
      const top = ray.x + sway * w * 0.025
      const bottom = top + h * 0.45 + sway * w * 0.07
      ctx.globalAlpha = 0.07 + 0.07 * (0.5 + 0.5 * Math.sin(t * ray.speed * 1.9 + ray.phase))
      ctx.beginPath()
      ctx.moveTo(top - ray.width * 0.3, 0)
      ctx.lineTo(top + ray.width * 0.3, 0)
      ctx.lineTo(bottom + ray.width, h)
      ctx.lineTo(bottom - ray.width, h)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#BFF3FF'
    for (const m of motes) {
      const y = (((m.y - t * m.rise) % (h + 6)) + h + 6) % (h + 6) - 3
      const x = m.x + Math.sin(t * 0.6 + m.phase) * 4
      ctx.globalAlpha = 0.18 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.3 + m.phase))
      ctx.beginPath()
      ctx.arc(x, y, m.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

// «Лунная дорожка»: a night sky over the sea — twinkling stars, a glowing
// moon, and its path broken into shimmering dashes on the water.
const moonScene: Scene = (ctx, w, h) => {
  const r = rand(23)
  const horizon = h * 0.6
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#070B26')
  sky.addColorStop(1, '#1B2560')
  const sea = ctx.createLinearGradient(0, horizon, 0, h)
  sea.addColorStop(0, '#0C1440')
  sea.addColorStop(1, '#03061A')
  const mx = w * 0.72
  const my = horizon * 0.38
  const mr = Math.max(5, h * 0.085)
  const glow = glowSprite('200,215,255', [
    [0, 0.55],
    [0.25, 0.22],
    [1, 0],
  ])
  const stars = Array.from({ length: Math.round(Math.min(70, Math.max(20, (w * horizon) / 1400))) }, () => ({
    x: r() * w,
    y: r() * (horizon - 6),
    size: 0.4 + r() * 1.1,
    speed: 0.8 + r() * 2.2,
    phase: r() * Math.PI * 2,
  }))
  const rows: { y: number; k: number }[] = []
  for (let y = horizon + 2; y < h; y += Math.max(2.2, h * 0.012)) rows.push({ y, k: r() * 10 })
  return (t) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, horizon)
    ctx.fillStyle = sea
    ctx.fillRect(0, horizon, w, h - horizon)
    ctx.fillStyle = '#FFFFFF'
    for (const s of stars) {
      const b = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase)
      ctx.globalAlpha = 0.15 + 0.75 * b * b
      ctx.fillRect(s.x, s.y, s.size, s.size)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'lighter'
    const gs = mr * 7
    ctx.drawImage(glow, mx - gs / 2, my - gs / 2, gs, gs)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#F3F1E4'
    ctx.beginPath()
    ctx.arc(mx, my, mr, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(190,190,175,.35)'
    ctx.beginPath()
    ctx.arc(mx - mr * 0.3, my - mr * 0.15, mr * 0.22, 0, Math.PI * 2)
    ctx.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.15, 0, Math.PI * 2)
    ctx.fill()
    // The path: wider and fainter toward the viewer, each row a few dashes
    // sliding and flickering on their own.
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = '#E8ECFF'
    const depth = h - horizon
    for (const row of rows) {
      const d = (row.y - horizon) / depth
      const spread = mr * 0.8 + d * w * 0.16
      for (let i = 0; i < 3; i++) {
        const x = mx + Math.sin(t * 0.9 + row.k + i * 2.1) * spread * 0.55
        const len = spread * (0.18 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.6 + row.k * 1.7 + i)))
        ctx.globalAlpha = (0.12 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1 + row.k * 2.3 + i * 1.4))) * (1 - d * 0.55)
        ctx.fillRect(x - len / 2, row.y, len, 1.3)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

// «Косяк»: two schools crossing — a far one smaller, dimmer and slower —
// each fish wagging its tail and bobbing a little on its own.
const schoolScene: Scene = (ctx, w, h) => {
  const r = rand(37)
  const water = ctx.createLinearGradient(0, 0, 0, h)
  water.addColorStop(0, '#0F4D4A')
  water.addColorStop(1, '#04191A')
  const groups = [
    { depth: 0.55, count: 14, y: 0.32, speed: 0.07 },
    { depth: 1, count: 11, y: 0.68, speed: 0.11 },
  ].map((g) => {
    const len = Math.max(8, h * 0.14 * g.depth)
    return {
      ...g,
      len,
      start: r(),
      fish: Array.from({ length: g.count }, () => {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r())
        return { dx: Math.cos(a) * d * len * 2.6, dy: Math.sin(a) * d * len * 1.2, phase: r() * Math.PI * 2, size: 0.85 + r() * 0.3 }
      }),
    }
  })
  function fish(x: number, y: number, len: number, heading: number, wag: number) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(heading)
    ctx.scale(len, len)
    ctx.beginPath()
    ctx.moveTo(0.5, 0)
    ctx.bezierCurveTo(0.3, -0.21, -0.15, -0.21, -0.3, 0)
    ctx.bezierCurveTo(-0.15, 0.21, 0.3, 0.21, 0.5, 0)
    ctx.fill()
    ctx.translate(-0.28, 0)
    ctx.rotate(wag)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-0.24, -0.17)
    ctx.lineTo(-0.18, 0)
    ctx.lineTo(-0.24, 0.17)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  return (t) => {
    ctx.globalAlpha = 1
    ctx.fillStyle = water
    ctx.fillRect(0, 0, w, h)
    for (const g of groups) {
      const span = w + g.len * 8
      const cx = (((g.start * span + t * g.speed * w) % span) + span) % span - g.len * 4
      const cy = h * g.y + Math.sin(t * 0.35 + g.start * 6) * h * 0.05
      const climb = Math.cos(t * 0.35 + g.start * 6) * 0.35 * 0.05 * h
      ctx.fillStyle = `rgba(200,250,240,${0.22 + 0.45 * g.depth})`
      for (const f of g.fish) {
        const bob = Math.sin(t * 1.4 + f.phase) * g.len * 0.15
        const heading = Math.atan2(climb + Math.cos(t * 1.4 + f.phase) * g.len * 0.2, g.speed * w)
        fish(cx + f.dx, cy + f.dy + bob, g.len * f.size, heading, Math.sin(t * (5 + 4 * g.depth) + f.phase) * 0.4)
      }
    }
  }
}

// «Золотая пыль»: warm dark ground, gold specks drifting up and twinkling,
// a few big sparkles flaring in and out, and a soft sheen sweeping across
// every few seconds.
const goldScene: Scene = (ctx, w, h) => {
  const r = rand(51)
  const ground = ctx.createLinearGradient(0, 0, w * 0.3, h)
  ground.addColorStop(0, '#2C1F08')
  ground.addColorStop(1, '#0D0803')
  const speck = glowSprite('255,205,90', [
    [0, 1],
    [0.2, 0.7],
    [0.5, 0.12],
    [1, 0],
  ])
  const specks = Array.from({ length: Math.round(Math.min(60, Math.max(20, (w * h) / 2500))) }, () => ({
    x: r() * w,
    y: r() * h,
    size: 4 + r() * 9,
    rise: 3 + r() * 7,
    phase: r() * Math.PI * 2,
    speed: 0.7 + r() * 1.6,
  }))
  const flares = Array.from({ length: 5 }, () => ({ x: r(), y: r(), size: 0.06 + r() * 0.05, offset: r() * 4, period: 3.2 + r() * 2.5 }))
  const sheenPeriod = 7
  function star(x: number, y: number, s: number) {
    ctx.beginPath()
    ctx.moveTo(x, y - s)
    ctx.lineTo(x + s * 0.16, y - s * 0.16)
    ctx.lineTo(x + s, y)
    ctx.lineTo(x + s * 0.16, y + s * 0.16)
    ctx.lineTo(x, y + s)
    ctx.lineTo(x - s * 0.16, y + s * 0.16)
    ctx.lineTo(x - s, y)
    ctx.lineTo(x - s * 0.16, y - s * 0.16)
    ctx.closePath()
    ctx.fill()
  }
  return (t) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = ground
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    // Sheen: a wide diagonal band crossing once per period, then resting.
    const p = (t % sheenPeriod) / sheenPeriod
    if (p < 0.45) {
      const x = -w * 0.6 + (p / 0.45) * w * 2.2
      const band = ctx.createLinearGradient(x - w * 0.35, 0, x + w * 0.35, h * 0.5)
      band.addColorStop(0, 'rgba(255,215,120,0)')
      band.addColorStop(0.5, 'rgba(255,215,120,.12)')
      band.addColorStop(1, 'rgba(255,215,120,0)')
      ctx.fillStyle = band
      ctx.fillRect(0, 0, w, h)
    }
    for (const s of specks) {
      const y = (((s.y - t * s.rise) % (h + 20)) + h + 20) % (h + 20) - 10
      const x = s.x + Math.sin(t * 0.5 + s.phase) * 6
      const b = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase)
      ctx.globalAlpha = 0.2 + 0.7 * b * b
      ctx.drawImage(speck, x - s.size / 2, y - s.size / 2, s.size, s.size)
    }
    ctx.fillStyle = '#FFF2C4'
    for (const f of flares) {
      const q = ((t + f.offset) % f.period) / f.period
      if (q > 0.35) continue
      const k = Math.sin((q / 0.35) * Math.PI)
      const s = Math.min(w, h) * f.size * (0.4 + 0.6 * k) * 0.9
      ctx.globalAlpha = k
      ctx.drawImage(speck, f.x * w - s, f.y * h - s, s * 2, s * 2)
      star(f.x * w, f.y * h, s)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

// «Камыш» (clan background): reeds and cattails standing in a warm evening
// glow, swaying — a gust runs across them, each stem with its own little
// flutter on top. Two depths: paler ones behind, dark silhouettes in front.
function reedsScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = rand(7)
  const band = Math.min(h * 0.62, 150)
  const stems = Array.from({ length: Math.round(w / 6) }, () => {
    const front = r() > 0.42
    return {
      x: r() * w,
      height: band * (0.35 + r() * 0.65) * (front ? 1 : 0.8),
      width: (front ? 1.5 : 1) + r() * 1.2,
      bend: (r() - 0.5) * 0.4,
      head: r() < 0.3,
      phase: r() * Math.PI * 2,
      amp: 0.04 + r() * 0.05,
      front,
    }
  }).sort((a, b) => Number(a.front) - Number(b.front))
  return (t: number) => {
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    for (const s of stems) {
      const lean = s.bend * 0.3 + s.amp * Math.sin(t * 0.9 - s.x / 90 + s.phase * 0.3) + 0.025 * Math.sin(t * 2.2 + s.phase)
      const tipX = s.x + lean * s.height
      const tipY = h - s.height
      const cx = s.x + lean * s.height * 0.15
      const cy = h - s.height * 0.55
      ctx.strokeStyle = s.front ? '#060D0F' : 'rgba(6,13,15,.5)'
      ctx.fillStyle = ctx.strokeStyle
      ctx.lineWidth = s.width
      ctx.beginPath()
      ctx.moveTo(s.x, h + 2)
      ctx.quadraticCurveTo(cx, cy, tipX, tipY)
      ctx.stroke()
      if (s.head) {
        // The cattail sits a little below the tip, along the stem.
        const u = 0.86
        const px = (1 - u) * (1 - u) * s.x + 2 * (1 - u) * u * cx + u * u * tipX
        const py = (1 - u) * (1 - u) * (h + 2) + 2 * (1 - u) * u * cy + u * u * tipY
        const angle = Math.atan2(tipY - cy, tipX - cx) + Math.PI / 2
        ctx.beginPath()
        ctx.ellipse(px, py, s.width + 1.6, s.height * 0.09, angle, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

// «Дождь» (clan background): slanted streaks falling, and rings spreading
// on the water below — each ring somewhere new every time it comes round.
function rainScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = rand(11)
  const slant = 0.22
  const drops = Array.from({ length: Math.round(Math.min(140, Math.max(40, (w * h) / 1400))) }, () => ({
    x: r() * w,
    y: r() * (h + 40),
    length: 7 + r() * 8,
    speed: 260 + r() * 140,
    alpha: 0.12 + r() * 0.18,
  }))
  const rings = Array.from({ length: 6 }, (_, i) => ({ seed: 101 + i * 31, period: 1.8 + r() * 1.4, phase: r() * 3, size: 10 + r() * 16 }))
  return (t: number) => {
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineWidth = 1
    for (const d of drops) {
      const y = ((d.y + t * d.speed) % (h + 40)) - 20
      const x = (((d.x - y * slant) % w) + w) % w
      ctx.strokeStyle = `rgba(207,230,245,${d.alpha})`
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - d.length * slant, y + d.length)
      ctx.stroke()
    }
    for (const ring of rings) {
      const cycle = Math.floor((t + ring.phase) / ring.period)
      const k = ((t + ring.phase) % ring.period) / ring.period
      const at = rand(ring.seed + cycle * 97)
      const x = at() * w
      const y = h * (0.55 + at() * 0.4)
      for (const lag of [0, 0.28]) {
        const q = k - lag
        if (q <= 0) continue
        const rx = ring.size * q * 1.6
        ctx.strokeStyle = `rgba(207,230,245,${0.35 * (1 - q)})`
        ctx.beginPath()
        ctx.ellipse(x, y, rx, rx * 0.24, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }
}

// «Чешуя» (clan background): even rows of scales and a soft sheen sweeping
// across them on the slant — no single scale blinking on its own.
function scalesScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const R = 11
  const scales: { x: number; y: number }[] = []
  for (let row = 0; row * R <= h + R; row++) {
    for (let x = row % 2 ? R : 0; x <= w + R; x += 2 * R) scales.push({ x, y: row * R })
  }
  const span = w + h
  return (t: number) => {
    ctx.clearRect(0, 0, w, h)
    ctx.lineWidth = 1.2
    // The sheen: a soft band across the diagonal, once every 6 s or so.
    const band = ((t / 6) % 1) * (span + 240) - 120
    for (const s of scales) {
      const d = (s.x + s.y * 0.6 - band) / 70
      const light = Math.exp(-d * d)
      ctx.beginPath()
      ctx.arc(s.x, s.y, R, 0, Math.PI)
      if (light > 0.02) {
        ctx.fillStyle = `rgba(190,215,240,${0.07 * light})`
        ctx.fill()
      }
      ctx.strokeStyle = `rgba(220,235,250,${0.11 + 0.38 * light})`
      ctx.stroke()
    }
  }
}

const SCENES = { deep: deepScene, moonpath: moonScene, school: schoolScene, golddust: goldScene, reeds: reedsScene, rain: rainScene, scales: scalesScene }
export type PremiumBackgroundKind = keyof typeof SCENES

export function PremiumBackground({ kind }: { kind: PremiumBackgroundKind }) {
  return <LiveCanvas scene={SCENES[kind]} />
}
