// The animated sector skins — drawn live, one frame at a time, instead of
// coming from a pre-drawn SVG (see skinPattern.ts for those). A skin here is
// a function painting frame t (seconds) into the sector's bounding box
// (0,0)–(w,h) in the sector's own colour: the caller has already clipped to
// the hex and laid the usual 30% tint under it, so only the lines go on top
// — the same look as the static skins, just moving.
// `seed` (0–1) is this sector's own number, so neighbours don't play the same
// picture: the skin uses it for direction, speed, phase and what it shows.
export type AnimatedSkinDraw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, color: string, seed?: number) => void

const TAU = Math.PI * 2

// Seeds are small neighbouring integers (a splash's number, its cycle), and a
// plain Lehmer generator answers those with near-identical tiny first values —
// so the seed is scrambled first.
function rand(seed: number) {
  let s = ((seed * 2654435761) % 2147483646) + 1
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// "#rrggbb" / "#rgb" with an alpha, for gradient stops (a skin only knows its
// sector's colour as a string). Anything else is used as it is.
function withAlpha(color: string, alpha: number) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  if (!m) return color
  const hex = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${alpha})`
}

// A soft round glow in the sector's colour, painted once per colour and
// reused for every frame and every sector of that colour.
const glowCache = new Map<string, HTMLCanvasElement>()
function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color)
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = 48
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24)
    grad.addColorStop(0, withAlpha(color, 1))
    grad.addColorStop(0.25, withAlpha(color, 0.55))
    grad.addColorStop(1, withAlpha(color, 0))
    g.fillStyle = grad
    g.fillRect(0, 0, 48, 48)
    glowCache.set(color, c)
  }
  return c
}

// «Молния»: a thunderstorm over the sector, the way a strike really goes — a
// dim leader feeling its way down from the cloud in steps, then the return
// stroke up the same channel (white-hot, with every branch lit), a few quick
// re-strikes flickering down the channel, and an afterglow fading out. Each
// strike has its own jagged path (midpoint displacement) and its own forks.
// The cloud lights up from inside, the sector flashes, and a fine rain falls
// all the while.
type Channel = { pts: [number, number][]; len: number[]; fork: number; weight: number }

function jagged(a: [number, number], b: [number, number], disp: number, depth: number, r: () => number, out: [number, number][]) {
  if (depth === 0) {
    out.push(b)
    return
  }
  const m: [number, number] = [(a[0] + b[0]) / 2 + (r() - 0.5) * disp, (a[1] + b[1]) / 2 + (r() - 0.5) * disp * 0.3]
  jagged(a, m, disp * 0.56, depth - 1, r, out)
  jagged(m, b, disp * 0.56, depth - 1, r, out)
}

function channel(pts: [number, number][], fork: number, weight: number): Channel {
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  return { pts, len, fork, weight }
}

// The main path from the cloud to the ground, and a few forks off it that
// head downward and sideways, thinner and shorter.
function buildBolt(w: number, h: number, seed: number): Channel[] {
  const r = rand(seed)
  const x0 = w * (0.3 + r() * 0.4)
  const start: [number, number] = [x0, -h * 0.04]
  const end: [number, number] = [x0 + (r() - 0.5) * w * 0.45, h * 1.04]
  const main: [number, number][] = [start]
  jagged(start, end, w * 0.3, 6, r, main)
  const mainCh = channel(main, 0, 1)
  const channels = [mainCh]
  let forks = 0
  for (let i = 6; i < main.length - 10 && forks < 5; i++) {
    if (r() > 0.1) continue
    forks++
    const side = r() < 0.5 ? -1 : 1
    const from = main[i]
    const to: [number, number] = [from[0] + side * w * (0.12 + r() * 0.28), from[1] + h * (0.18 + r() * 0.34)]
    const pts: [number, number][] = [from]
    jagged(from, to, w * 0.14, 5, r, pts)
    channels.push(channel(pts, mainCh.len[i], 0.5))
    // Sometimes a fork forks again.
    if (r() < 0.4) {
      const k = Math.floor(pts.length * (0.35 + r() * 0.3))
      const sub: [number, number][] = [pts[k]]
      jagged(pts[k], [pts[k][0] + -side * w * 0.1, pts[k][1] + h * 0.14], w * 0.07, 4, r, sub)
      channels.push(channel(sub, mainCh.len[i] + pts.length * 0.5, 0.32))
    }
  }
  return channels
}

const boltCache = new Map<string, Channel[]>()
function boltFor(w: number, h: number, cycle: number) {
  const key = `${cycle}:${Math.round(w)}:${Math.round(h)}`
  let b = boltCache.get(key)
  if (!b) {
    if (boltCache.size > 80) boltCache.clear()
    b = buildBolt(w, h, ((cycle * 131 + 17) * 2654435761) % 2147483646 + 1)
    boltCache.set(key, b)
  }
  return b
}

// Strokes the part of a channel that has been reached so far.
function traceChannel(ctx: CanvasRenderingContext2D, ch: Channel, reach: number) {
  if (reach <= 0) return
  ctx.beginPath()
  ctx.moveTo(ch.pts[0][0], ch.pts[0][1])
  for (let i = 1; i < ch.pts.length; i++) {
    if (ch.len[i] > reach) {
      const k = (reach - ch.len[i - 1]) / (ch.len[i] - ch.len[i - 1])
      ctx.lineTo(ch.pts[i - 1][0] + (ch.pts[i][0] - ch.pts[i - 1][0]) * k, ch.pts[i - 1][1] + (ch.pts[i][1] - ch.pts[i - 1][1]) * k)
      break
    }
    ctx.lineTo(ch.pts[i][0], ch.pts[i][1])
  }
  ctx.stroke()
}

const STORM_PERIOD = 3.8
const LEADER = 0.17
// When the return stroke and its re-strikes land after the leader, and how
// bright each is (each dies away quickly).
const STROKES: [number, number][] = [
  [0, 1],
  [0.15, 0.55],
  [0.27, 0.8],
  [0.42, 0.32],
]
const RAIN = (() => {
  const r = rand(29)
  return Array.from({ length: 18 }, () => ({ x: r(), off: r(), speed: 1.1 + r() * 0.6, size: 0.05 + r() * 0.05 }))
})()
const lightning: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const cloud = glow('#0B0B24')
  const lit = glow('#BFC9FF')
  // Each sector has its own storm: its own rhythm and its own bolts.
  const salt = Math.floor(seed * 997)
  const cycle = Math.floor(t / STORM_PERIOD)
  const local = t - cycle * STORM_PERIOD
  const tau = local - (0.2 + rand((((cycle + salt * 1009) * 977 + 3) * 2654435761) % 2147483646 + 1)() * 1.5)

  // How bright things are right now: the strokes, and a slow afterglow.
  let flash = 0
  let glowK = 0
  if (tau >= LEADER) {
    const since = tau - LEADER
    for (const [at, peak] of STROKES) if (since >= at) flash = Math.max(flash, peak * Math.exp(-(since - at) / 0.05))
    glowK = 0.3 * Math.exp(-since / 0.55)
  }
  const channels = tau >= 0 && tau < 1.8 ? boltFor(w, h, cycle + salt * 1009) : null

  // Gloom: the sector sits under the storm and brightens when it strikes.
  ctx.fillStyle = '#05051A'
  ctx.globalAlpha = 0.1 * (1 - Math.min(1, flash * 1.2))
  ctx.fillRect(0, 0, w, h)
  // Rain.
  ctx.strokeStyle = '#DDE4FF'
  ctx.lineWidth = Math.max(0.7, w * 0.005)
  ctx.lineCap = 'round'
  for (const d of RAIN) {
    const y = (((t * d.speed * h + d.off * h * 1.3) % (h * 1.3)) - h * 0.15)
    const x = d.x * w - y * 0.18
    ctx.globalAlpha = 0.2 + 0.2 * flash
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - h * d.size * 0.18, y + h * d.size)
    ctx.stroke()
  }
  // The cloud bank: dark smudges drifting slowly along the top, lit from
  // within where the bolt leaves it.
  for (let k = 0; k < 4; k++) {
    const x = ((((k * 0.3 + t * 0.01) % 1.4) + 1.4) % 1.4 - 0.2) * w
    ctx.globalAlpha = 0.46
    ctx.drawImage(cloud, x - w * 0.4, -h * 0.16 + (k % 2) * h * 0.05, w * 0.8, h * 0.42)
  }
  if (channels) {
    const top = channels[0].pts[0]
    ctx.globalAlpha = Math.min(1, flash * 0.9 + glowK * 0.5)
    ctx.drawImage(lit, top[0] - w * 0.45, -h * 0.2, w * 0.9, h * 0.55)
  }

  if (channels) {
    ctx.globalAlpha = 0.34 * flash
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const main = channels[0]
    const total = main.len[main.len.length - 1]
    // The leader feels its way down in steps, each a little further.
    const reached = tau < LEADER ? (Math.floor((tau / LEADER) * 16) / 16) * total : total + w
    const base = Math.max(1, w * 0.011)
    for (const ch of channels) {
      const reach = ch === main ? reached : reached - ch.fork
      if (reach <= 0) continue
      const bright = tau < LEADER ? 0.4 : Math.min(1, flash + glowK)
      if (bright < 0.02) continue
      // No outline: a thin white-hot channel whose own glow (a soft blur in
      // pale blue-white, like the air round a real discharge) does the rest.
      ctx.strokeStyle = '#EEF3FF'
      ctx.shadowColor = '#A9BEFF'
      ctx.shadowBlur = w * 0.1 * Math.min(1, bright + 0.2)
      ctx.globalAlpha = Math.min(1, bright * 1.1)
      ctx.lineWidth = Math.max(0.8, base * 1.15 * ch.weight)
      traceChannel(ctx, ch, reach)
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'
    }
  }
  ctx.globalAlpha = 1
}

// «Эхолот»: a fish finder's screen. A beam sweeps round, and like a real
// screen it only learns what is out there as it passes: each echo lights up
// as a dot where it was then and fades until the beam comes round again — and
// then the picture is new. Every turn has its own set of echoes (a school
// bunched together some turns, scattered singles others, one big one), its own
// target picked out, and its own kind of lock-on mark. A ping spreads from the
// centre every turn, and a bezel of ticks runs round the edge with the beam's
// own tick lit.
const SWEEP_TURN = 5.6
const SLOTS = 11
type Dot = { a: number; d: number; size: number }
type Sweep = { dots: Dot[]; target: number; style: number }
const sweepCache = new Map<number, Sweep>()
const SALTS = 997
// What the beam finds on one turn. The seed is scrambled, since turns are
// small neighbouring integers (see rand in this file's top).
function sweepOf(turn: number, salt: number): Sweep {
  const key = salt * 1_000_000 + turn
  let sw = sweepCache.get(key)
  if (!sw) {
    if (sweepCache.size > 200) sweepCache.clear()
    const r = rand(((turn + 1000) * 7919 + 13) * 31 + 5 + salt * 104729)
    const dots: Dot[] = []
    const school = r() < 0.55
    const ca = r() * TAU
    const cd = 0.3 + r() * 0.4
    for (let k = 0; k < SLOTS - 1; k++) {
      const inSchool = school && k < 5
      dots.push({
        a: (((inSchool ? ca + (r() - 0.5) * 0.5 : r() * TAU) % TAU) + TAU) % TAU,
        d: inSchool ? cd + (r() - 0.5) * 0.22 : 0.14 + r() * 0.78,
        size: 0.75 + r() * 0.6,
      })
    }
    dots.push({ a: r() * TAU, d: 0.25 + r() * 0.6, size: 1.9 })
    sw = { dots, target: r() < 0.45 ? SLOTS - 1 : Math.floor(r() * SLOTS), style: Math.floor(r() * 4) }
    sweepCache.set(key, sw)
  }
  return sw
}

// The lock-on mark round the target, `k` 0..1 as it closes in; four kinds.
function lockOn(ctx: CanvasRenderingContext2D, style: number, x: number, y: number, size: number, k: number, t: number, lw: number) {
  const half = size * (1.5 + (1 - k) * 1.2)
  ctx.lineWidth = lw * 0.9
  if (style === 0) {
    // Corner brackets.
    const arm = half * 0.55
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath()
      ctx.moveTo(x + sx * half, y + sy * (half - arm))
      ctx.lineTo(x + sx * half, y + sy * half)
      ctx.lineTo(x + sx * (half - arm), y + sy * half)
      ctx.stroke()
    }
  } else if (style === 1) {
    // A ring with cross-hair ticks.
    ctx.beginPath()
    ctx.arc(x, y, half * 0.8, 0, TAU)
    ctx.stroke()
    ctx.beginPath()
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4
      ctx.moveTo(x + Math.cos(a) * half * 0.55, y + Math.sin(a) * half * 0.55)
      ctx.lineTo(x + Math.cos(a) * half * 1.25, y + Math.sin(a) * half * 1.25)
    }
    ctx.stroke()
  } else if (style === 2) {
    // A diamond with its points picked out.
    const d = half * 1.15
    ctx.beginPath()
    ctx.moveTo(x, y - d)
    ctx.lineTo(x + d, y)
    ctx.lineTo(x, y + d)
    ctx.lineTo(x - d, y)
    ctx.closePath()
    ctx.stroke()
    ctx.lineWidth = lw * 1.8
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      ctx.moveTo(x + dx * d, y + dy * d)
      ctx.lineTo(x + dx * d * 1.001, y + dy * d * 1.001)
    }
    ctx.stroke()
  } else {
    // A dashed ring turning round it.
    ctx.setLineDash([half * 0.5, half * 0.32])
    ctx.lineDashOffset = -t * half * 1.4
    ctx.beginPath()
    ctx.arc(x, y, half * 0.95, 0, TAU)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

const sonar: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const cx = w / 2
  const cy = h / 2
  const R = w * 0.5
  const lw = Math.max(1, w * 0.016)
  // This sector's own sweep: turning one way or the other, a little faster or
  // slower, starting from its own bearing, finding its own echoes.
  const salt = Math.floor(seed * SALTS)
  const dir = seed < 0.5 ? 1 : -1
  const speed = 0.82 + 0.36 * ((seed * 7.13) % 1)
  const turn = (t * speed) / SWEEP_TURN + ((seed * 3.7) % 1)
  const turnIdx = Math.floor(turn)
  // `sweep` runs 0..TAU in the echoes' own bearings; `beam` is where it is drawn.
  const sweep = (turn % 1) * TAU
  const beam = dir * sweep
  ctx.strokeStyle = color
  ctx.fillStyle = color

  // Range rings, cross hairs, and the bezel of ticks (the beam's own lit).
  ctx.lineWidth = lw * 0.8
  ctx.globalAlpha = 0.45
  for (const k of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath()
    ctx.arc(cx, cy, R * k, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.26
  ctx.beginPath()
  ctx.moveTo(cx - R, cy)
  ctx.lineTo(cx + R, cy)
  ctx.moveTo(cx, cy - R)
  ctx.lineTo(cx, cy + R)
  ctx.stroke()
  ctx.lineWidth = Math.max(0.8, lw * 0.6)
  for (let n = 0; n < 48; n++) {
    const a = (n / 48) * TAU
    const near = Math.max(0, 1 - Math.abs((((a - beam) % TAU) + TAU * 1.5) % TAU - Math.PI) / 0.5)
    const long = n % 12 === 0 ? 0.075 : n % 4 === 0 ? 0.05 : 0.03
    ctx.globalAlpha = 0.4 + 0.6 * near
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * R * (1 - long - near * 0.03), cy + Math.sin(a) * R * (1 - long - near * 0.03))
    ctx.lineTo(cx + Math.cos(a) * R * 0.985, cy + Math.sin(a) * R * 0.985)
    ctx.stroke()
  }

  // The ping: two rings spreading from the centre as each turn begins.
  const pingAge = (turn % 1) * SWEEP_TURN
  for (const lag of [0, 0.35]) {
    const k = (pingAge - lag) / 1.5
    if (k <= 0 || k >= 1) continue
    ctx.globalAlpha = 0.6 * (1 - k) ** 1.5
    ctx.lineWidth = lw * (1.4 - k)
    ctx.beginPath()
    ctx.arc(cx, cy, R * 1.05 * k, 0, TAU)
    ctx.stroke()
  }

  // The trail behind the beam: thin wedges, each fainter than the last.
  const slices = 24
  const trail = 1.35
  for (let n = 0; n < slices; n++) {
    const from = beam - dir * ((n + 1) / slices) * trail
    const to = from + dir * (trail / slices + 0.01)
    ctx.globalAlpha = 0.5 * (1 - n / slices) ** 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, R * 1.04, Math.min(from, to), Math.max(from, to))
    ctx.closePath()
    ctx.fill()
  }

  // Echoes: each slot shows what the beam found the last time it passed that
  // bearing — this turn's, or, if it hasn't got there yet, last turn's.
  for (let slot = 0; slot < SLOTS; slot++) {
    const now = sweepOf(turnIdx, salt)
    const found = sweep >= now.dots[slot].a
    const owner = found ? turnIdx : turnIdx - 1
    const sw = found ? now : sweepOf(turnIdx - 1, salt)
    const dot = sw.dots[slot]
    const since = (found ? sweep - dot.a : sweep - dot.a + TAU) / TAU
    const x = cx + Math.cos(dir * dot.a) * R * dot.d
    const y = cy + Math.sin(dir * dot.a) * R * dot.d
    const live = (1 - since) ** 2
    ctx.globalAlpha = 0.16 + 0.84 * live
    ctx.beginPath()
    ctx.arc(x, y, lw * (0.9 + 1.5 * live) * dot.size, 0, TAU)
    ctx.fill()
    if (since < 0.13) {
      ctx.globalAlpha = 0.8 * (1 - since / 0.13)
      ctx.lineWidth = lw * 0.7
      ctx.beginPath()
      ctx.arc(x, y, lw * (1.8 + since * 40) * dot.size, 0, TAU)
      ctx.stroke()
    }
    if (slot === sw.target && since < 0.45 && owner >= -1) {
      ctx.globalAlpha = (1 - since / 0.45) * (0.65 + 0.35 * Math.sin(t * 14))
      lockOn(ctx, sw.style, x, y, lw * 3.4 * Math.min(dot.size, 1.4), Math.min(1, since / 0.1), t, lw)
    }
  }

  ctx.globalAlpha = 1
  ctx.lineWidth = lw * 1.3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(beam) * R * 1.04, cy + Math.sin(beam) * R * 1.04)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, lw * 1.3, 0, TAU)
  ctx.fill()
}

// «Маяк»: a lighthouse on a rock over a night sea, always standing in the
// middle of the sector. Its lamp turns a full circle: the beam sweeps round the
// tower in perspective — behind it, out to one side, then toward the viewer,
// where it comes up short and wide and the lamp flares, a bloom of light and a
// column of it on the water — and away to the other side, and so on round.
// Stars flicker, waves roll. Sectors differ only in how the light goes round:
// clockwise or the other way, fast or slow, from its own starting bearing.
const lighthouse: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const r = rand(Math.floor(seed * 997) + 23)
  const sprite = glow(color)
  const x = w * 0.5
  const base = h * 0.86
  const height = h * 0.58
  const topW = w * 0.075
  const baseW = w * 0.125
  const lampY = base - height - h * 0.035
  // A full circle, either way round, at this sector's own pace and bearing.
  const spin = (seed < 0.5 ? 1 : -1) * (0.5 + 0.35 * ((seed * 5.1) % 1))
  const beamAngle = t * spin + seed * 20
  const front = Math.max(0, Math.sin(beamAngle))
  // 0..1: how squarely the lamp faces the viewer right now.
  const face = Math.max(0, Math.sin(beamAngle)) ** 7
  const reach = w * 0.95

  // Night.
  ctx.fillStyle = '#040A22'
  ctx.globalAlpha = 0.32
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#FFFFFF'
  for (let n = 0; n < 8; n++) {
    const k = 0.5 + 0.5 * Math.sin(t * (0.8 + (n % 4) * 0.5) + n * 2.1)
    ctx.globalAlpha = 0.15 + 0.7 * k * k
    const sz = Math.max(1, w * 0.012)
    ctx.fillRect(w * (0.06 + ((n * 0.37) % 0.88)), h * (0.05 + ((n * 0.23) % 0.4)), sz, sz)
  }

  // The sea: rolling lines, glinting brighter near the beam.
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.8, w * 0.007)
  ctx.lineCap = 'round'
  for (let n = 0; n < 7; n++) {
    const y = base + h * 0.015 + n * h * 0.022
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    for (let px = 0; px <= w; px += w / 24) {
      const yy = y + Math.sin(px * 0.08 + t * (0.9 + n * 0.12) + n) * h * 0.007
      if (px === 0) ctx.moveTo(px, yy)
      else ctx.lineTo(px, yy)
    }
    ctx.stroke()
  }

  // The beam: a cone from the lamp to where it points on a flattened circle
  // round the tower — long out to the sides, short and wide toward the viewer,
  // dim when it is behind the tower (then drawn before it, else after).
  const drawBeam = () => {
    const ex = x + Math.cos(beamAngle) * reach
    const ey = lampY + Math.sin(beamAngle) * h * 0.13 + h * 0.02
    const dx = ex - x
    const dy = ey - lampY
    const len = Math.hypot(dx, dy)
    const px = -dy / len
    const py = dx / len
    const near = 0.5 + 0.5 * front
    const gradient = (rgb: string, a0: number) => {
      const g = ctx.createLinearGradient(x, lampY, ex, ey)
      g.addColorStop(0, `rgba(${rgb},${a0})`)
      g.addColorStop(0.5, `rgba(${rgb},${a0 * 0.38})`)
      g.addColorStop(1, `rgba(${rgb},0)`)
      return g
    }
    const [cr, cg, cb] = ((): [number, number, number] => {
      const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
      if (!m) return [255, 255, 255]
      const hex = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
    })()
    ctx.globalCompositeOperation = 'lighter'
    for (const [spread, alpha, rgb] of [
      [0.2, 0.34, `${cr},${cg},${cb}`],
      [0.07, 0.85, '255,255,255'],
    ] as [number, number, string][]) {
      const half = h * spread * (0.5 + 0.9 * front)
      ctx.globalAlpha = alpha * near
      ctx.fillStyle = gradient(rgb, 1)
      ctx.beginPath()
      ctx.moveTo(x, lampY)
      ctx.lineTo(ex + px * half, ey + py * half)
      ctx.lineTo(ex - px * half, ey - py * half)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  const behind = Math.sin(beamAngle) < 0
  if (behind) drawBeam()
  // The column of light on the water below the lamp, and the bloom round it.
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.18 + 0.7 * face
  const bloom = w * (0.2 + 0.5 * face)
  ctx.drawImage(sprite, x - bloom / 2, lampY - bloom / 2, bloom, bloom)
  if (face > 0.05) {
    ctx.globalAlpha = 0.5 * face
    ctx.fillStyle = '#FFFFFF'
    for (let n = 0; n < 9; n++) {
      const y = base + h * 0.02 + n * h * 0.014
      const half = w * (0.03 + n * 0.004) * (0.6 + 0.4 * Math.sin(t * 6 + n * 2))
      ctx.fillRect(x - half, y, half * 2, Math.max(1, h * 0.006))
    }
  }
  ctx.globalCompositeOperation = 'source-over'

  // The rock and the tower: stripes alternating the sector's colour and white,
  // a dark gallery, the lamp room, and a cap.
  ctx.fillStyle = '#050A1C'
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(x - w * 0.2, h * 1.02)
  ctx.lineTo(x - w * 0.13, base + h * 0.01)
  ctx.lineTo(x - w * 0.06, base - h * 0.03 + r() * 0)
  ctx.lineTo(x + w * 0.07, base - h * 0.02)
  ctx.lineTo(x + w * 0.14, base + h * 0.02)
  ctx.lineTo(x + w * 0.22, h * 1.02)
  ctx.closePath()
  ctx.fill()
  const stripes = 5
  for (let n = 0; n < stripes; n++) {
    const y0 = base - ((n + 1) / stripes) * height
    const y1 = base - (n / stripes) * height
    const wAt = (y: number) => baseW + (topW - baseW) * ((base - y) / height)
    ctx.globalAlpha = 1
    ctx.fillStyle = n % 2 === 0 ? '#F4F7FF' : color
    ctx.beginPath()
    ctx.moveTo(x - wAt(y1) / 2, y1)
    ctx.lineTo(x + wAt(y1) / 2, y1)
    ctx.lineTo(x + wAt(y0) / 2, y0)
    ctx.lineTo(x - wAt(y0) / 2, y0)
    ctx.closePath()
    ctx.fill()
  }
  // Shade down one side so the tower reads as round.
  ctx.fillStyle = '#050A1C'
  ctx.globalAlpha = 0.28
  ctx.beginPath()
  ctx.moveTo(x + baseW * 0.12, base)
  ctx.lineTo(x + baseW / 2, base)
  ctx.lineTo(x + topW / 2, base - height)
  ctx.lineTo(x + topW * 0.12, base - height)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = '#0A1230'
  ctx.fillRect(x - topW * 0.78, base - height - h * 0.012, topW * 1.56, h * 0.016)
  ctx.fillStyle = '#FFFFFF'
  ctx.globalAlpha = 0.45 + 0.55 * Math.max(face, 0.35)
  ctx.fillRect(x - topW * 0.36, lampY - h * 0.02, topW * 0.72, h * 0.045)
  ctx.globalAlpha = 1
  ctx.fillStyle = '#0A1230'
  ctx.beginPath()
  ctx.moveTo(x - topW * 0.52, lampY - h * 0.02)
  ctx.lineTo(x, lampY - h * 0.075)
  ctx.lineTo(x + topW * 0.52, lampY - h * 0.02)
  ctx.closePath()
  ctx.fill()
  if (!behind) drawBeam()

  // Dazzle: when the lamp looks straight at the viewer the light floods the
  // sector — a white wash over everything (the tower washed out in it) and a huge
  // bloom round the lamp — then eases off as it turns away.
  const dazzle = Math.sin(beamAngle) > 0 ? Math.sin(beamAngle) ** 12 : 0
  const wash = 0.3 * front ** 4 + 0.42 * dazzle
  if (wash > 0.01) {
    ctx.globalCompositeOperation = 'lighter'
    const flood = w * (0.9 + 0.9 * dazzle)
    ctx.globalAlpha = Math.min(1, 0.55 * front ** 3 + 0.5 * dazzle)
    ctx.drawImage(sprite, x - flood / 2, lampY - flood / 2, flood, flood)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = wash
    ctx.fillRect(0, 0, w, h)
  }
  ctx.globalAlpha = 1
}

// A colour mixed toward another, for shading a fish from the sector's colour.
function mixColor(color: string, to: string, k: number) {
  const parse = (c: string): [number, number, number] | null => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
    if (!m) return null
    const hex = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  }
  const a = parse(color)
  const b = parse(to)
  if (!a || !b) return color
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`
}

// One aquarium fish facing +x (length 1): a shaded body, a belly highlight, a
// gill line, an eye, a dorsal fin, and a tail swaying by `wag`; `bands` paints
// two pale bands across it.
function tankFish(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, wag: number, body: CanvasGradient, fins: string, bands: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(len, len)
  ctx.save()
  ctx.translate(-0.28, 0)
  ctx.rotate(wag)
  ctx.fillStyle = fins
  ctx.beginPath()
  ctx.moveTo(0.05, 0)
  ctx.bezierCurveTo(-0.08, -0.06, -0.2, -0.22, -0.3, -0.24)
  ctx.quadraticCurveTo(-0.24, 0, -0.3, 0.24)
  ctx.bezierCurveTo(-0.2, 0.22, -0.08, 0.06, 0.05, 0)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = fins
  ctx.beginPath()
  ctx.moveTo(0.2, -0.14)
  ctx.quadraticCurveTo(0.06, -0.34, -0.2, -0.24)
  ctx.quadraticCurveTo(-0.08, -0.14, -0.14, -0.1)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0.5, 0.02)
  ctx.bezierCurveTo(0.34, -0.22, -0.1, -0.24, -0.32, -0.02)
  ctx.bezierCurveTo(-0.1, 0.2, 0.34, 0.22, 0.5, 0.02)
  ctx.fillStyle = body
  ctx.fill()
  ctx.save()
  ctx.clip()
  if (bands) {
    ctx.fillStyle = 'rgba(255,255,255,.6)'
    ctx.fillRect(0.2, -0.3, 0.07, 0.6)
    ctx.fillRect(-0.06, -0.3, 0.06, 0.6)
  }
  ctx.fillStyle = 'rgba(255,255,255,.22)'
  ctx.beginPath()
  ctx.ellipse(0.04, 0.09, 0.3, 0.05, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(0,0,0,.25)'
  ctx.lineWidth = 0.012
  ctx.beginPath()
  ctx.arc(0.22, 0, 0.13, -0.9, 0.9)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(0.34, -0.045, 0.045, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#0A1020'
  ctx.beginPath()
  ctx.arc(0.35, -0.045, 0.024, 0, TAU)
  ctx.fill()
  ctx.restore()
}

// «Аквариум»: the sector is a tank. Fish swim across it from left to right on
// three planes of depth — small pale ones far back, medium ones, a few big
// ones up front — each at a steady pace, rising and dipping a little, tails
// swaying, everything in tones of the sector's own colour. Light slants in from above, bubbles climb from an air stone, sea
// grass sways on a sandy floor, and the glass catches a gloss. Each sector's
// tank has its own fish and its own light.
// Three kinds of fish, all in tones of the sector's colour: the colour itself,
// a pale one with bands, and a dark one — so the tank stays calm.
const BANDED = [false, true, false]
const tankLayers = [
  { count: 8, len: 0.085, y0: 0.2, y1: 0.55, speed: 0.03, alpha: 0.5 },
  { count: 6, len: 0.15, y0: 0.25, y1: 0.68, speed: 0.045, alpha: 0.8 },
  { count: 3, len: 0.27, y0: 0.38, y1: 0.7, speed: 0.065, alpha: 1 },
]
const aquarium: AnimatedSkinDraw = (ctx, w, h, t, color, seed = 0) => {
  const r = rand(Math.floor(seed * 997) + 59)
  const shades = [
    [mixColor(color, '#000000', 0.38), color, mixColor(color, '#FFFFFF', 0.6)],
    [mixColor(color, '#000000', 0.12), mixColor(color, '#FFFFFF', 0.32), mixColor(color, '#FFFFFF', 0.78)],
    [mixColor(color, '#000000', 0.55), mixColor(color, '#000000', 0.18), mixColor(color, '#FFFFFF', 0.5)],
  ]
  const bodies = shades.map(([dark, mid, light]) => {
    const g = ctx.createLinearGradient(0, -0.22, 0, 0.22)
    g.addColorStop(0, dark)
    g.addColorStop(0.45, mid)
    g.addColorStop(0.75, light)
    g.addColorStop(1, '#FFFFFF')
    return g
  })

  // The water: light on top, deep below, and slanted shafts swaying.
  const water = ctx.createLinearGradient(0, 0, 0, h)
  water.addColorStop(0, 'rgba(255,255,255,.38)')
  water.addColorStop(0.4, 'rgba(255,255,255,.04)')
  water.addColorStop(1, 'rgba(4,16,44,.42)')
  ctx.fillStyle = water
  ctx.globalAlpha = 1
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#FFFFFF'
  for (let n = 0; n < 4; n++) {
    const base = w * (0.12 + n * 0.24) + Math.sin(t * 0.25 + n * 1.9) * w * 0.04
    ctx.globalAlpha = 0.07 + 0.05 * Math.sin(t * 0.5 + n)
    ctx.beginPath()
    ctx.moveTo(base, 0)
    ctx.lineTo(base + w * 0.09, 0)
    ctx.lineTo(base + w * 0.09 - w * 0.2, h)
    ctx.lineTo(base - w * 0.2, h)
    ctx.closePath()
    ctx.fill()
  }

  // Swaying grass on the floor, drawn once far and once near.
  const grass = (alpha: number, count: number, tall: number, shade: string) => {
    ctx.strokeStyle = shade
    ctx.lineCap = 'round'
    for (let n = 0; n < count; n++) {
      const gx = w * ((n + 0.4 + ((n * 7 + Math.floor(seed * 10)) % 5) * 0.08) / count)
      for (let b = 0; b < 3; b++) {
        const bx = gx + (b - 1) * w * 0.012
        const height = h * tall * (0.7 + 0.3 * ((n * 3 + b * 5) % 4) / 3)
        const sway = Math.sin(t * 0.8 + n * 1.3 + b * 0.7) * w * 0.025
        ctx.globalAlpha = alpha
        ctx.lineWidth = Math.max(1.4, w * 0.014)
        ctx.beginPath()
        ctx.moveTo(bx, h * 0.93)
        ctx.quadraticCurveTo(bx + sway * 0.3, h * 0.93 - height * 0.55, bx + sway, h * 0.93 - height)
        ctx.stroke()
      }
    }
  }
  grass(0.45, 5, 0.3, mixColor(color, '#000000', 0.3))

  // The fish, far to near.
  tankLayers.forEach((layer, li) => {
    const len = w * layer.len
    const span = w + len * 4
    for (let n = 0; n < layer.count; n++) {
      const f = {
        start: r(),
        y: layer.y0 + (layer.y1 - layer.y0) * r(),
        bob: 0.015 + r() * 0.03,
        rate: 0.5 + r() * 0.5,
        phase: r() * TAU,
        speedK: 0.85 + r() * 0.3,
        sp: r() < 0.5 ? 0 : r() < 0.55 ? 1 : 2,
        size: 0.85 + r() * 0.3,
      }
      const run = layer.speed * f.speedK * w
      const x = ((((f.start * span + t * run) % span) + span) % span) - len * 2
      const y = h * f.y + Math.sin(t * f.rate + f.phase) * h * f.bob
      // The climb: slope of the bob over the swim, so the nose follows it.
      const slope = (Math.cos(t * f.rate + f.phase) * f.rate * h * f.bob) / run
      const wag = Math.sin(t * (4 + li) + f.phase * 3) * 0.28
      ctx.globalAlpha = layer.alpha
      tankFish(ctx, x, y, len * f.size, Math.atan(slope), wag, bodies[f.sp], shades[f.sp][1], BANDED[f.sp])
    }
    // Water between the planes: the farther fish sit in a little haze.
    if (li < 2) {
      ctx.fillStyle = 'rgba(190,225,248,.1)'
      ctx.globalAlpha = 1
      ctx.fillRect(0, 0, w, h)
    }
  })

  // Bubbles from an air stone.
  const bx = w * (0.14 + 0.72 * ((seed * 3.3) % 1))
  ctx.strokeStyle = '#FFFFFF'
  for (let n = 0; n < 9; n++) {
    const k = (n / 9 + t * 0.12) % 1
    const size = w * (0.008 + 0.02 * k)
    ctx.globalAlpha = 0.7 * Math.min(1, (1 - k) * 3)
    ctx.lineWidth = Math.max(0.8, w * 0.005)
    ctx.beginPath()
    ctx.arc(bx + Math.sin(t * 2 + n * 1.7 + k * 7) * w * 0.012 * (1 + k), h * 0.92 - k * h * 0.88, size, 0, TAU)
    ctx.stroke()
  }

  // The floor: sand dunes, pebbles, near grass.
  const sand = ctx.createLinearGradient(0, h * 0.88, 0, h)
  sand.addColorStop(0, 'rgba(255,255,255,.55)')
  sand.addColorStop(1, 'rgba(255,255,255,.22)')
  ctx.fillStyle = sand
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let px = 0; px <= w; px += w / 20) ctx.lineTo(px, h * (0.92 + 0.012 * Math.sin(px * 0.05 + seed * 6) + 0.008 * Math.sin(px * 0.13)))
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(8,20,48,.28)'
  for (let n = 0; n < 9; n++) {
    ctx.beginPath()
    ctx.ellipse(w * ((n * 0.113 + seed) % 1), h * (0.95 + ((n * 0.37) % 0.04)), w * 0.018, w * 0.01, 0, 0, TAU)
    ctx.fill()
  }
  grass(0.85, 3, 0.2, mixColor(color, '#000000', 0.5))

  // The glass: a gloss down one side and along the top.
  const gloss = ctx.createLinearGradient(0, 0, w * 0.35, 0)
  gloss.addColorStop(0, 'rgba(255,255,255,.28)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  ctx.globalAlpha = 1
  ctx.fillRect(0, 0, w * 0.35, h)
  ctx.fillStyle = 'rgba(255,255,255,.35)'
  ctx.fillRect(0, 0, w, Math.max(1.5, h * 0.015))
  ctx.globalAlpha = 1
}

export const ANIMATED_SKINS: Record<string, AnimatedSkinDraw> = {
  skin_lightning: lightning,
  skin_lighthouse: lighthouse,
  skin_aquarium: aquarium,
  skin_sonar: sonar,
}

export function isAnimatedSkin(id: string | null | undefined): boolean {
  return !!id && id in ANIMATED_SKINS
}
