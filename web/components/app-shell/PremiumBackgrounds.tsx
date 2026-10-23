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

const TAU = Math.PI * 2

// A four-pointed sparkle (a thin 8-vertex star) centred on x,y.
function starShape(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
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


// A fish (nose along +x, heading in radians), tail wagging by `wag` — drawn
// in unit coordinates scaled to its length so every school shares one shape.
function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, heading: number, wag: number) {
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

// Slanted shafts of light falling from the surface and swaying. Each shaft
// is a few stacked slivers of different widths, so its edges fade out
// instead of cutting hard.
const SHAFT_SLIVERS: [number, number][] = [
  [1.7, 0.2],
  [1, 0.3],
  [0.45, 0.45],
]
function lightShafts(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, count: number, rgb: string, strength: number) {
  const r = rand(seed)
  const fade = ctx.createLinearGradient(0, 0, 0, h)
  fade.addColorStop(0, `rgba(${rgb},1)`)
  fade.addColorStop(0.8, `rgba(${rgb},0)`)
  const rays = Array.from({ length: count }, (_, i) => ({
    x: w * ((i + 0.2 + r() * 0.6) / count),
    width: w * (0.035 + r() * 0.05),
    lean: 0.3 + r() * 0.25,
    phase: r() * TAU,
    speed: 0.16 + r() * 0.16,
  }))
  return (t: number) => {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = fade
    for (const ray of rays) {
      const sway = Math.sin(t * ray.speed + ray.phase)
      const top = ray.x + sway * w * 0.02
      const bottom = top + h * ray.lean + sway * w * 0.06
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * ray.speed * 1.9 + ray.phase))
      for (const [k, a] of SHAFT_SLIVERS) {
        const half = ray.width * k
        ctx.globalAlpha = strength * pulse * a * 2
        ctx.beginPath()
        ctx.moveTo(top - half * 0.3, 0)
        ctx.lineTo(top + half * 0.3, 0)
        ctx.lineTo(bottom + half, h)
        ctx.lineTo(bottom - half, h)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

// Darkens the corners so the scene sinks toward its edges.
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, rgb: string, alpha: number) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.32, w / 2, h * 0.45, Math.hypot(w, h) * 0.62)
  g.addColorStop(0, `rgba(${rgb},0)`)
  g.addColorStop(1, `rgba(${rgb},${alpha})`)
  return () => {
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

// «Глубина»: open water under a bright, rippling surface — shafts of light
// swaying down, bokeh and plankton drifting up through them, two streams of
// bubbles, and a great fish passing far off in the dark.
const deepScene: Scene = (ctx, w, h) => {
  const r = rand(11)
  const water = ctx.createLinearGradient(0, 0, 0, h)
  water.addColorStop(0, '#12778E')
  water.addColorStop(0.3, '#0A4A60')
  water.addColorStop(0.7, '#052636')
  water.addColorStop(1, '#020B12')
  const surface = ctx.createLinearGradient(0, 0, 0, h * 0.22)
  surface.addColorStop(0, 'rgba(205,250,255,.55)')
  surface.addColorStop(1, 'rgba(205,250,255,0)')
  const shafts = lightShafts(ctx, w, h, 5, 7, '175,242,255', 0.15)
  const fadeEdges = vignette(ctx, w, h, '1,8,12', 0.6)
  const bokeh = glowSprite('170,236,255', [
    [0, 0.85],
    [0.45, 0.35],
    [1, 0],
  ])
  const ripples = Array.from({ length: 20 }, () => ({
    x: r() * w,
    y: h * (0.01 + r() * 0.08),
    len: w * (0.04 + r() * 0.06),
    phase: r() * TAU,
    speed: 0.5 + r() * 1.3,
  }))
  const motes = Array.from({ length: Math.round(Math.min(46, Math.max(16, (w * h) / 3800))) }, () => ({
    x: r() * w,
    y: r() * h,
    size: 0.6 + r() * 1.2,
    rise: 3 + r() * 6,
    phase: r() * TAU,
  }))
  const lamps = Array.from({ length: Math.round(Math.min(12, Math.max(5, (w * h) / 9000))) }, () => ({
    x: r() * w,
    y: r() * h,
    size: 7 + r() * 14,
    rise: 8 + r() * 12,
    phase: r() * TAU,
  }))
  const streams = [
    { x: w * 0.16, speed: 26, bubbles: Array.from({ length: 6 }, (_, i) => ({ at: i / 6 + r() * 0.1, size: 1 + r() * 1.3, phase: r() * TAU })) },
    { x: w * 0.83, speed: 20, bubbles: Array.from({ length: 5 }, (_, i) => ({ at: i / 5 + r() * 0.1, size: 1 + r() * 1.3, phase: r() * TAU })) },
  ]
  const giantLen = h * 0.6
  const giantPeriod = 36
  return (t) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = water
    ctx.fillRect(0, 0, w, h)

    // A big fish far off, a shade darker than the water, crossing now and then.
    const gp = ((t + 11) % giantPeriod) / giantPeriod
    ctx.fillStyle = 'rgba(1,10,16,.3)'
    drawFish(ctx, -giantLen + gp * (w + giantLen * 2), h * 0.64 + Math.sin(t * 0.3) * h * 0.03, giantLen, Math.sin(t * 0.3) * 0.03, Math.sin(t * 1.1) * 0.22)

    shafts(t)

    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.6 + 0.15 * Math.sin(t * 0.7)
    ctx.fillStyle = surface
    ctx.fillRect(0, 0, w, h * 0.22)
    ctx.fillStyle = '#D5FBFF'
    for (const rp of ripples) {
      const k = 0.5 + 0.5 * Math.sin(t * rp.speed + rp.phase)
      ctx.globalAlpha = 0.06 + 0.26 * k * k
      ctx.fillRect(rp.x + Math.sin(t * 0.4 + rp.phase) * w * 0.03, rp.y + k * h * 0.02, rp.len * (0.7 + 0.5 * k), 1.2)
    }
    ctx.fillStyle = '#BFF3FF'
    for (const m of motes) {
      const y = ((((m.y - t * m.rise) % (h + 6)) + h + 6) % (h + 6)) - 3
      const x = m.x + Math.sin(t * 0.6 + m.phase) * 4
      ctx.globalAlpha = 0.18 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.3 + m.phase))
      ctx.beginPath()
      ctx.arc(x, y, m.size, 0, TAU)
      ctx.fill()
    }
    // Big soft out-of-focus lights drifting up, nearer than the motes.
    for (const l of lamps) {
      const y = ((((l.y - t * l.rise) % (h + l.size * 2)) + h + l.size * 2) % (h + l.size * 2)) - l.size
      const x = l.x + Math.sin(t * 0.35 + l.phase) * 9
      ctx.globalAlpha = 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.8 + l.phase))
      ctx.drawImage(bokeh, x - l.size / 2, y - l.size / 2, l.size, l.size)
    }
    ctx.globalCompositeOperation = 'source-over'
    // Bubbles grow as they rise and wobble from side to side.
    ctx.strokeStyle = '#D5FBFF'
    ctx.lineWidth = 0.8
    for (const s of streams) {
      for (const b of s.bubbles) {
        const k = (b.at + (t * s.speed) / (h + 20)) % 1
        const y = h + 6 - k * (h + 12)
        const x = s.x + Math.sin(t * 2 + b.phase + k * 9) * (2 + 5 * k) + k * 8
        const size = b.size * (0.7 + 1.3 * k)
        ctx.globalAlpha = 0.5 * Math.min(1, (1 - k) * 4)
        ctx.beginPath()
        ctx.arc(x, y, size, 0, TAU)
        ctx.stroke()
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(x - size * 0.45, y - size * 0.5, size * 0.4, size * 0.4)
      }
    }
    ctx.globalAlpha = 1
    fadeEdges()
  }
}

// «Лунная дорожка»: a night sky over the sea — the Milky Way, twinkling
// stars, a shooting star now and then, thin clouds lit by the moon, and the
// moon's path broken into glints and sparkles on the water.
const moonScene: Scene = (ctx, w, h) => {
  const r = rand(23)
  const horizon = h * 0.6
  const depth = h - horizon
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#03051A')
  sky.addColorStop(0.45, '#0C1445')
  sky.addColorStop(0.85, '#232F7A')
  sky.addColorStop(1, '#3A4C9E')
  const sea = ctx.createLinearGradient(0, horizon, 0, h)
  sea.addColorStop(0, '#111D58')
  sea.addColorStop(0.45, '#070E33')
  sea.addColorStop(1, '#02040F')
  const mx = w * 0.76
  const my = horizon * 0.34
  const mr = Math.max(6, h * 0.09)
  const glow = glowSprite('190,205,255', [
    [0, 0.7],
    [0.2, 0.3],
    [0.5, 0.08],
    [1, 0],
  ])
  const haze = glowSprite('130,150,240', [
    [0, 0.7],
    [0.5, 0.28],
    [1, 0],
  ])
  const disk = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr)
  disk.addColorStop(0, '#FFFFF8')
  disk.addColorStop(0.6, '#EFEDDC')
  disk.addColorStop(1, '#C8C8BA')
  const milky = Array.from({ length: Math.round(Math.min(90, Math.max(30, (w * horizon) / 900))) }, () => {
    const u = r() * 0.6
    return {
      x: u * w,
      y: Math.max(2, Math.min(horizon - 6, horizon * (0.85 - u * 1.2) + (r() + r() + r() - 1.5) * horizon * 0.14)),
      size: 0.5 + r() * 0.8,
      a: 0.25 + r() * 0.45,
    }
  })
  const stars = Array.from({ length: Math.round(Math.min(55, Math.max(16, (w * horizon) / 1700))) }, () => ({
    x: r() * w,
    y: r() * (horizon - 6),
    size: 0.4 + r() * 1.1,
    speed: 0.8 + r() * 2.2,
    phase: r() * TAU,
  }))
  const bright = Array.from({ length: 4 }, () => ({ x: r() * w * 0.6, y: 6 + r() * horizon * 0.5, size: 2.4 + r() * 1.6, speed: 0.6 + r() * 0.8, phase: r() * TAU }))
  const clouds = Array.from({ length: 3 }, (_, i) => ({
    start: r(),
    y: horizon * (0.18 + i * 0.2 + r() * 0.08),
    width: w * (0.55 + r() * 0.35),
    height: horizon * (0.07 + r() * 0.04),
    speed: 0.006 + r() * 0.006,
  }))
  const ambient = Array.from({ length: Math.round(Math.min(46, Math.max(14, (w * depth) / 1500))) }, () => {
    const y = horizon + 3 + r() * (depth - 3)
    return { x: r() * w, y, len: 3 + r() * 9 * (0.4 + (y - horizon) / depth), phase: r() * TAU, speed: 0.5 + r() * 1.5 }
  })
  const rows: { y: number; k: number }[] = []
  for (let y = horizon + 2; y < h; y += Math.max(2.2, h * 0.012)) rows.push({ y, k: r() * 10 })
  const sparkles = Array.from({ length: 6 }, () => ({ d: 0.08 + r() * 0.85, off: (r() - 0.5) * 0.9, size: 2 + r() * 2.4, speed: 0.7 + r() * 1.1, phase: r() * TAU }))
  return (t) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, horizon)
    ctx.fillStyle = sea
    ctx.fillRect(0, horizon, w, h - horizon)

    ctx.fillStyle = '#FFFFFF'
    for (const s of milky) {
      ctx.globalAlpha = s.a
      ctx.fillRect(s.x, s.y, s.size, s.size)
    }
    for (const s of stars) {
      const b = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase)
      ctx.globalAlpha = 0.15 + 0.75 * b * b
      ctx.fillRect(s.x, s.y, s.size, s.size)
    }
    // A few bright stars with spikes.
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = '#DDE6FF'
    for (const s of bright) {
      const b = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase)
      ctx.globalAlpha = 0.35 + 0.55 * b
      starShape(ctx, s.x, s.y, s.size * (0.7 + 0.5 * b))
    }
    // The shooting star: one every ~10 s, a short streak across the upper sky.
    const period = 10
    const cycle = Math.floor((t + 3) / period)
    const q = ((t + 3) % period) / period
    if (q < 0.09) {
      const at = rand(((cycle * 131 + 17) * 2654435761) % 2147483646 + 1)
      const sx = w * (0.1 + at() * 0.45)
      const sy = horizon * (0.05 + at() * 0.25)
      const angle = 0.35 + at() * 0.3
      const k = q / 0.09
      const hx = sx + Math.cos(angle) * w * 0.32 * k
      const hy = sy + Math.sin(angle) * w * 0.32 * k
      const tail = w * 0.14 * Math.sin(k * Math.PI)
      const trail = ctx.createLinearGradient(hx - Math.cos(angle) * tail, hy - Math.sin(angle) * tail, hx, hy)
      trail.addColorStop(0, 'rgba(255,255,255,0)')
      trail.addColorStop(1, 'rgba(255,255,255,.9)')
      ctx.globalAlpha = 1
      ctx.strokeStyle = trail
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(hx - Math.cos(angle) * tail, hy - Math.sin(angle) * tail)
      ctx.lineTo(hx, hy)
      ctx.stroke()
    }
    // Clouds drift slowly and catch the moon's light as they pass it.
    for (const c of clouds) {
      const x = ((((c.start + t * c.speed) % 1.5) + 1.5) % 1.5 - 0.25) * w
      const near = Math.exp(-(((x - mx) / (w * 0.3)) ** 2) - (((c.y - my) / (horizon * 0.3)) ** 2))
      ctx.globalAlpha = 0.1 + 0.3 * near
      ctx.drawImage(haze, x - c.width / 2, c.y - c.height / 2, c.width, c.height)
      ctx.drawImage(haze, x - c.width * 0.15, c.y - c.height * 0.9, c.width * 0.5, c.height * 1.3)
    }
    // The glow low on the horizon under the moon.
    ctx.globalAlpha = 0.35
    ctx.drawImage(haze, mx - w * 0.4, horizon - h * 0.1, w * 0.8, h * 0.2)
    // Moon, its glow and halo.
    ctx.globalAlpha = 1
    const gs = mr * (7 + 0.4 * Math.sin(t * 0.5))
    ctx.drawImage(glow, mx - gs / 2, my - gs / 2, gs, gs)
    ctx.strokeStyle = 'rgba(200,215,255,.55)'
    ctx.lineWidth = mr * 0.5
    ctx.globalAlpha = 0.09 + 0.03 * Math.sin(t * 0.6)
    ctx.beginPath()
    ctx.arc(mx, my, mr * 2.3, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = disk
    ctx.beginPath()
    ctx.arc(mx, my, mr, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(170,170,155,.32)'
    ctx.beginPath()
    ctx.arc(mx - mr * 0.3, my - mr * 0.15, mr * 0.22, 0, TAU)
    ctx.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.15, 0, TAU)
    ctx.arc(mx + mr * 0.05, my - mr * 0.5, mr * 0.1, 0, TAU)
    ctx.fill()

    // The sea: a bright line at the horizon, the pillar of light under the
    // moon, glints everywhere, and denser, brighter ones along the path.
    ctx.fillStyle = 'rgba(150,170,255,.2)'
    ctx.fillRect(0, horizon - 0.5, w, 1)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.3
    ctx.drawImage(haze, mx - mr * 3.2, horizon - depth * 0.05, mr * 6.4, depth * 1.15)
    ctx.fillStyle = '#9FB2FF'
    for (const a of ambient) {
      const k = 0.5 + 0.5 * Math.sin(t * a.speed + a.phase)
      ctx.globalAlpha = 0.04 + 0.16 * k * k
      ctx.fillRect(a.x + Math.sin(t * 0.3 + a.phase) * 4, a.y, a.len, 1)
    }
    ctx.fillStyle = '#E8ECFF'
    for (const row of rows) {
      const d = (row.y - horizon) / depth
      const spread = mr * 0.8 + d * w * 0.22
      for (let i = 0; i < 3; i++) {
        const x = mx + Math.sin(t * 0.9 + row.k + i * 2.1) * spread * 0.55
        const len = spread * (0.18 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.6 + row.k * 1.7 + i)))
        ctx.globalAlpha = (0.12 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1 + row.k * 2.3 + i * 1.4))) * (1 - d * 0.55)
        ctx.fillRect(x - len / 2, row.y, len, 1.3)
      }
    }
    ctx.fillStyle = '#FFFFFF'
    for (const s of sparkles) {
      const k = Math.max(0, Math.sin(t * s.speed + s.phase)) ** 6
      if (k < 0.02) continue
      const d = s.d
      const spread = mr * 0.8 + d * w * 0.22
      ctx.globalAlpha = k
      starShape(ctx, mx + s.off * spread, horizon + d * depth, s.size * (0.5 + 0.5 * k))
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

// A fish with some body, for the school up close: a back shaded dark steel
// down to a silver belly, a stripe along the flank, a fin on its back, an eye,
// and a tail wagging by `wag` — always the right way up, whichever way it
// swims (`dir` ±1 the way it faces, `slope` its climb). `shine` (0–1) is a flash of silver over the flank. `body` is the
// shading, built once in unit space (a gradient is read in the transform at
// the moment of painting, so it scales with the fish).
function drawFishDetailed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  dir: number,
  slope: number,
  wag: number,
  body: CanvasGradient,
  shine: number,
  tail = 'rgba(70,130,150,.9)',
  fin = 'rgba(40,95,115,.95)'
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(dir < 0 ? -1 : 1, 1)
  // Never steeper than ~35°: a fish swimming straight up or down looks like it fell over.
  ctx.rotate(Math.max(-0.6, Math.min(0.6, Math.atan(slope))))
  ctx.scale(len, len)
  // Tail behind the body, so the body's tip overlaps its root.
  ctx.save()
  ctx.translate(-0.27, 0)
  ctx.rotate(wag)
  ctx.fillStyle = tail
  ctx.beginPath()
  ctx.moveTo(0.04, 0)
  ctx.lineTo(-0.25, -0.19)
  ctx.lineTo(-0.18, 0)
  ctx.lineTo(-0.25, 0.19)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = fin
  ctx.beginPath()
  // Both ends of the root sit inside the back (its outline is at about -0.155
  // at x .14 and -0.10 at x -.18), so the body covers the join and the fin
  // grows out of it instead of hanging off a corner; the trailing edge sweeps
  // back in a curve.
  ctx.moveTo(0.14, -0.11)
  ctx.quadraticCurveTo(0.05, -0.2, -0.03, -0.285)
  ctx.quadraticCurveTo(-0.06, -0.18, -0.18, -0.07)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0.5, 0)
  ctx.bezierCurveTo(0.3, -0.21, -0.15, -0.21, -0.3, 0)
  ctx.bezierCurveTo(-0.15, 0.21, 0.3, 0.21, 0.5, 0)
  ctx.fillStyle = body
  ctx.fill()
  if (shine > 0.04) {
    ctx.fillStyle = `rgba(255,255,255,${shine * 0.65})`
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(25,70,90,.55)'
  ctx.lineWidth = 0.035
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0.4, -0.015)
  ctx.quadraticCurveTo(0.05, -0.06, -0.27, 0)
  ctx.stroke()
  ctx.fillStyle = '#0A1A22'
  ctx.beginPath()
  ctx.arc(0.33, -0.045, 0.034, 0, TAU)
  ctx.fill()
  ctx.restore()
}

// «Косяк»: open water lit from a bright surface — schools of silver fish
// swimming across, each fish drifting about its place in the school with a
// flash of light running through them like a wave; nearer fish shaded and
// sharp, farther ones paler and lost in the blue. Now and then a big
// predator cuts through the other way and the fish part around it. Seaweed
// sways in front.
//
// Nothing here ever turns a fish round: each school has one heading, and a
// fish only tilts a little with its own drift (a reversing swimmer popped
// from one mirror image to the other).
const schoolScene: Scene = (ctx, w, h) => {
  const r = rand(37)
  const water = ctx.createLinearGradient(0, 0, 0, h)
  water.addColorStop(0, '#1AA3A0')
  water.addColorStop(0.3, '#0E6D79')
  water.addColorStop(0.7, '#08394C')
  water.addColorStop(1, '#031722')
  const sun = glowSprite('205,255,245', [
    [0, 0.8],
    [0.4, 0.3],
    [1, 0],
  ])
  const shafts = lightShafts(ctx, w, h, 9, 7, '185,255,240', 0.18)
  const fadeEdges = vignette(ctx, w, h, '1,12,16', 0.5)
  const body = ctx.createLinearGradient(0, -0.2, 0, 0.2)
  body.addColorStop(0, '#2F6076')
  body.addColorStop(0.42, '#8FC0CD')
  body.addColorStop(0.62, '#E2F5F8')
  body.addColorStop(1, '#FFFFFF')
  // The predator: darker on top, pale underneath, in the same drawing.
  const hunterBody = ctx.createLinearGradient(0, -0.2, 0, 0.2)
  hunterBody.addColorStop(0, '#0F2E40')
  hunterBody.addColorStop(0.45, '#3B6478')
  hunterBody.addColorStop(0.65, '#9DB8C3')
  hunterBody.addColorStop(1, '#DCE9ED')
  const caustics = Array.from({ length: 16 }, () => ({ x: r() * w, y: h * (0.01 + r() * 0.07), len: w * (0.04 + r() * 0.06), phase: r() * TAU, speed: 0.5 + r() * 1.2 }))
  const motes = Array.from({ length: Math.round(Math.min(40, Math.max(14, (w * h) / 3200))) }, () => ({ x: r() * w, y: r() * h, size: 0.5 + r() * 1, drift: 2 + r() * 5, phase: r() * TAU }))
  const bubbles = Array.from({ length: 9 }, () => ({ x: r() * w, at: r(), speed: 14 + r() * 16, size: 0.8 + r() * 1.6, phase: r() * TAU }))
  // Mid and far schools are flat shapes, so only the near one pays for detail.
  // `dir` is the way a school swims; far ones go the other way for parallax.
  const groups = [
    { layer: 0, dir: -1, count: 22, len: Math.max(5, h * 0.05), y: 0.27, speed: 0.045, rx: 3.4, ry: 1.7, rgb: '120,195,205', alpha: 0.5 },
    { layer: 1, dir: 1, count: 20, len: Math.max(8, h * 0.085), y: 0.46, speed: 0.07, rx: 3, ry: 1.5, rgb: '165,222,230', alpha: 0.72 },
    { layer: 2, dir: 1, count: 24, len: Math.max(12, h * 0.16), y: 0.64, speed: 0.1, rx: 2.3, ry: 1.15, rgb: '', alpha: 1 },
  ].map((g) => ({
    ...g,
    start: r(),
    fish: Array.from({ length: g.count }, () => {
      const q = Math.sqrt(r())
      // Slow drift about its place: slower than the school's own swim, so a
      // fish never goes backwards.
      return { a: g.len * g.rx * q, b: g.len * g.ry * q, omega: (0.15 + r() * 0.15) * (r() < 0.5 ? -1 : 1), phase: r() * TAU, size: 0.85 + r() * 0.3 }
    }),
  }))
  const weeds = Array.from({ length: 11 }, (_, i) => ({ x: w * ((i + 0.3 + r() * 0.4) / 11), height: h * (0.1 + r() * 0.16), phase: r() * TAU, blades: 2 + Math.floor(r() * 2) }))
  const plen = h * 0.42
  const period = 22
  const deepHaze = ['rgba(10,80,90,.34)', 'rgba(8,60,75,.22)']

  // The predator crosses right to left over ~12 s of every 22.
  const predatorAt = (t: number) => {
    const p = ((t + 5) % period) / 12
    return p < 1 ? { x: w + plen - p * (w + plen * 2), y: h * 0.5 + Math.sin(t * 0.5) * h * 0.05 } : null
  }
  const scareR = plen * 0.8
  type Group = (typeof groups)[number]
  // Where a fish is at time t: its school's place, its drift about it, and a
  // push away from the predator when one is near.
  function place(g: Group, f: Group['fish'][number], t: number): [number, number] {
    const span = w + g.len * 12
    const u = (((g.start * span + t * g.speed * w) % span) + span) % span
    const cx = (g.dir > 0 ? u : span - u) - g.len * 6
    const cy = h * g.y + Math.sin(t * 0.3 + g.start * 6) * h * 0.04
    const th = t * f.omega + f.phase
    let x = cx + f.a * Math.cos(th)
    let y = cy + f.b * Math.sin(th)
    const hunter = predatorAt(t)
    if (hunter) {
      const dx = x - hunter.x
      const dy = y - hunter.y
      const dist = Math.hypot(dx, dy) + 0.001
      const push = Math.exp(-((dist / scareR) ** 2)) * scareR * 0.7
      x += (dx / dist) * push
      y += (dy / dist) * push
    }
    return [x, y]
  }
  const DT = 0.08

  return (t) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = water
    ctx.fillRect(0, 0, w, h)
    // The bright surface above: a big glare and rippling caustics along the top.
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.55 + 0.1 * Math.sin(t * 0.6)
    ctx.drawImage(sun, w * 0.5 - w * 0.55, -h * 0.35, w * 1.1, h * 0.8)
    ctx.fillStyle = '#E4FFFA'
    for (const c of caustics) {
      const k = 0.5 + 0.5 * Math.sin(t * c.speed + c.phase)
      ctx.globalAlpha = 0.05 + 0.25 * k * k
      ctx.fillRect(c.x + Math.sin(t * 0.4 + c.phase) * w * 0.03, c.y + k * h * 0.02, c.len * (0.7 + 0.5 * k), 1.2)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    shafts(t)

    ctx.fillStyle = '#CFFBF2'
    for (const m of motes) {
      ctx.globalAlpha = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t + m.phase))
      ctx.fillRect(m.x + Math.sin(t * 0.4 + m.phase) * m.drift, ((((m.y + t * 3) % (h + 6)) + h + 6) % (h + 6)) - 3, m.size, m.size)
    }
    ctx.globalAlpha = 1

    const hunter = predatorAt(t)
    for (const g of groups) {
      if (g.layer === 2 && hunter) {
        // Heading follows its own path, tail beating slowly.
        const before = predatorAt(t - DT)
        const rise = before ? (hunter.y - before.y) / (hunter.x - before.x + 0.001) : 0
        drawFishDetailed(ctx, hunter.x, hunter.y, plen, -1, -rise, Math.sin(t * 2.2) * 0.22, hunterBody, 0, 'rgba(30,70,90,.95)', 'rgba(15,45,62,.97)')
      }
      for (const f of g.fish) {
        const [x, y] = place(g, f, t)
        const [px, py] = place(g, f, t - DT)
        // Along the way it is going, never against the school's heading.
        const vx = Math.max(0.2, (x - px) * g.dir)
        const vy = ((y - py) * g.dir) / 1
        // The flash: a band of silver running along the school.
        const flash = (0.5 + 0.5 * Math.sin(t * 1.5 - (x * g.dir) / (g.len * 2.4) + g.start * 5)) ** 3
        const wag = Math.sin(t * (g.layer === 2 ? 7 : 5) + f.phase) * 0.38
        if (g.layer === 2) {
          drawFishDetailed(ctx, x, y, g.len * f.size, g.dir, vy / vx, wag, body, flash)
        } else {
          ctx.fillStyle = `rgba(${g.rgb},${g.alpha * (0.6 + 0.4 * flash)})`
          drawFish(ctx, x, y, g.len * f.size, g.dir > 0 ? Math.atan(vy / vx) : Math.PI + Math.atan(vy / vx), wag)
        }
      }
      // Water between the schools: the farther ones sink into the blue.
      if (g.layer < 2) {
        ctx.fillStyle = deepHaze[g.layer]
        ctx.fillRect(0, 0, w, h)
      }
    }

    // Bubbles, then the seabed and weed in front of everything.
    ctx.strokeStyle = '#E4FFFA'
    ctx.lineWidth = 0.8
    for (const b of bubbles) {
      const k = (b.at + (t * b.speed) / (h + 20)) % 1
      ctx.globalAlpha = 0.45 * Math.min(1, (1 - k) * 4)
      ctx.beginPath()
      ctx.arc(b.x + Math.sin(t * 2 + b.phase + k * 8) * (2 + 4 * k), h + 6 - k * (h + 12), b.size * (0.7 + k), 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(2,32,32,.95)'
    for (const wd of weeds) {
      for (let i = 0; i < wd.blades; i++) {
        const sway = Math.sin(t * 0.8 + wd.phase + i) * h * 0.035
        const bx = wd.x + (i - 1) * 5
        ctx.lineWidth = 2.6 - i * 0.4
        ctx.beginPath()
        ctx.moveTo(bx, h + 2)
        ctx.quadraticCurveTo(bx + sway * 0.4, h - wd.height * 0.55, bx + sway + (i - 1) * 4, h - wd.height * (1 - i * 0.12))
        ctx.stroke()
      }
    }
    ctx.fillStyle = '#021A1E'
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.94 + 0.015 * Math.sin(x * 0.03) + 0.008 * Math.sin(x * 0.11)))
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
    fadeEdges()
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
      starShape(ctx, f.x * w, f.y * h, s)
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
