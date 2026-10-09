// «Живая карта» behind the welcome screen: the Batumi coast — sea, shoreline,
// rivers, lakes (OpenStreetMap water, the same layers as the promo video) —
// with the game's sectors on it, seen from a tilted camera that glides along
// the shore from capture to capture. Captures are made up (names of real
// anglers, no dates); the map and the sector grid are real. Data:
// public/welcome/batumi-coast.json, in the grid's metres.

export type CoastData = {
  sea: number[][]
  water: number[][]
  rivers: number[][]
  streams: number[][]
  sectors: [string, number, number][]
}

export type TickerLine = { name: string; verb: string; id: string; day: string }

// Where the map may show: below the headline, above the buttons.
export type CoastView = { w: number; h: number; clearTop: number; clearBottom: number }

type Cam = { x: number; y: number; k: number; pitch: number; F: number; cx: number; cy: number; yaw: number }
type Sector = { id: string; x: number; y: number; color: string | null }
type Pt = [number, number, number]

const HEX = [0, 1, 2, 3, 4, 5].map((i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)] as const)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, t: number) {
  const A = rgb(a)
  const B = rgb(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
function shade(hex: string, f: number, a = 1) {
  const [r, g, b] = rgb(hex)
  return `rgba(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)},${a})`
}
const lift = (hex: string, t: number) => mix(hex, '#ffffff', t)

function project(cam: Cam, x: number, y: number, z: number): Pt {
  let dx = (x - cam.x) * cam.k
  let dy = (y - cam.y) * cam.k
  const dz = z * cam.k
  const c = Math.cos(cam.yaw)
  const s = Math.sin(cam.yaw)
  ;[dx, dy] = [dx * c - dy * s, dx * s + dy * c]
  const ct = Math.cos(cam.pitch)
  const st = Math.sin(cam.pitch)
  const yc = dy * ct - dz * st
  const zc = dy * st + dz * ct
  const p = cam.F / (cam.F - zc)
  return [cam.cx + dx * p, cam.cy + yc * p, p]
}

function hexPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

// A held sector: the side faces turned towards the camera, then the top.
function prism(ctx: CanvasRenderingContext2D, cam: Cam, x: number, y: number, R: number, h: number, color: string) {
  const T = HEX.map(([a, b]) => project(cam, x + a * R, y + b * R, h))
  if (h > 0.4) {
    const B = HEX.map(([a, b]) => project(cam, x + a * R, y + b * R, 0))
    for (let i = 0; i < 6; i++) {
      const facing = Math.sin(((i * 60 + 30) * Math.PI) / 180 + cam.yaw)
      if (facing <= 0.05) continue
      const j = (i + 1) % 6
      ctx.beginPath()
      ctx.moveTo(B[i][0], B[i][1])
      ctx.lineTo(B[j][0], B[j][1])
      ctx.lineTo(T[j][0], T[j][1])
      ctx.lineTo(T[i][0], T[i][1])
      ctx.closePath()
      ctx.fillStyle = shade(color, 0.62 - 0.2 * facing)
      ctx.fill()
    }
  }
  hexPath(ctx, T)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = lift(color, 0.45)
  ctx.lineWidth = 1.4
  ctx.stroke()
}

function groundRing(ctx: CanvasRenderingContext2D, cam: Cam, x: number, y: number, rad: number, color: string, alpha: number, lw: number) {
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const [px, py] = project(cam, x + Math.cos(a) * rad, y + Math.sin(a) * rad, 0)
    if (i) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  }
  ctx.strokeStyle = shade(color, 1, alpha)
  ctx.lineWidth = lw
  ctx.stroke()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Anglers from the game (their own names). About a third of the water is held.
const NAMES = ['Ruslan', 'catchntravel', 'MaZz', 'Aleksandr', 'AxeLn', 'Mike', 'Maksym', 'Сергей', 'Vitaliy', 'IlyaTelesh', 'Игорь', 'Wesson']
const PALETTE = ['#FB6A16', '#4C9BFF', '#2FD08A', '#A77BFF', '#FF5A4E', '#E8EEF6', '#4CC9F0', '#B5E254']
const colorOf = (name: string) => PALETTE[NAMES.indexOf(name) % PALETTE.length]
// Captures walk the coast south → north and back, so the camera only glides
// to the next sector along the shore — never across the city.
const PATH_IDS = ['B0537', 'B0782', 'B0934', 'B1031', 'B1173', 'B1316', 'B1461', 'B1607']
const STEP = 2.6
const HELD = 9
const R = 30
const S = R / 347.2 // a sector is 347 m from centre to corner

export const COAST_STILL_AT = STEP * 4.4

export function createCoastScene(data: CoastData, labelFont: string, onTicker: (line: TickerLine) => void) {
  const cam: Cam = { x: 0, y: 0, k: 1, pitch: 0.98, F: 1250, cx: 0, cy: 0, yaw: -0.65 }
  const hash = (s: string) => {
    let h = 7
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003
    return h
  }
  const W: Sector[] = data.sectors.map(([id, x, y]) => {
    const h = hash(id)
    return { id, x: x * S, y: y * S, color: h % 100 < 32 ? colorOf(NAMES[h % NAMES.length]) : null }
  })
  const byId = new Map(W.map((s) => [s.id, s]))
  const PATH = PATH_IDS.map((id) => byId.get(id)).filter((s): s is Sector => !!s)
  const ORDER = [...PATH.keys(), ...[...PATH.keys()].slice(1, -1).reverse()]
  const taker = (n: number) => NAMES[(n * 5 + 3) % NAMES.length]
  // far to near along the turned board — sorted once, the yaw never changes
  const sy = Math.sin(cam.yaw)
  const cy = Math.cos(cam.yaw)
  const drawOrder = W.slice().sort((a, b) => a.x * sy + a.y * cy - (b.x * sy + b.y * cy))
  cam.x = PATH[0].x
  cam.y = PATH[0].y
  let lastT = -1
  let lastLine = ''

  return function draw(ctx: CanvasRenderingContext2D, t: number, view: CoastView, still: boolean) {
    const { w, h, clearTop, clearBottom } = view
    const dt = lastT < 0 ? 0 : Math.min(0.05, Math.max(0, t - lastT))
    lastT = t
    const n = Math.floor(t / STEP)
    const idx = ORDER[n % ORDER.length]
    const target = PATH[idx]
    // each stage sector's latest capture so far
    const lastCapture = new Map<Sector, number>()
    for (let m = Math.max(0, n - ORDER.length + 1); m <= n; m++) lastCapture.set(PATH[ORDER[m % ORDER.length]], m)
    const f = still || dt === 0 ? 1 : 1 - Math.exp(-dt * 1.5)
    cam.x += (target.x - cam.x) * f
    cam.y += (target.y - cam.y) * f
    cam.k = Math.min(1.25, Math.max(0.85, w / 390)) * (1 + 0.03 * Math.sin(t * 0.25))
    cam.cx = w / 2
    cam.cy = clearTop + (clearBottom - clearTop) * 0.78

    let held = !!target.color
    for (let m = n - 1; m >= 0 && m > n - ORDER.length; m--) if (ORDER[m % ORDER.length] === idx) { held = true; break }
    const line: TickerLine = { name: taker(n), verb: held ? 'перехватил' : 'захватил', id: target.id, day: n % 3 === 2 ? 'вчера' : 'сегодня' }
    const lineKey = `${line.name}|${line.verb}|${line.id}|${line.day}`
    if (lineKey !== lastLine) {
      lastLine = lineKey
      onTicker(line)
    }

    ctx.fillStyle = '#050C14'
    ctx.fillRect(0, 0, w, h)
    const glow = ctx.createRadialGradient(w * 0.62, cam.cy - 30, 20, w * 0.62, cam.cy - 30, 460)
    glow.addColorStop(0, 'rgba(30,52,78,.5)')
    glow.addColorStop(1, 'rgba(5,12,20,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    // The water reaches far behind the camera as it flies north; a point
    // behind it would project across the whole screen as a flash, so every
    // ring and line is cut at a plane just in front of the camera first.
    const ct = Math.cos(cam.pitch)
    const st = Math.sin(cam.pitch)
    const cyw = Math.cos(cam.yaw)
    const syw = Math.sin(cam.yaw)
    const LIM = (cam.F - 90) / st
    const toCam = (x: number, y: number): [number, number] => {
      const dx = (x * S - cam.x) * cam.k
      const dy = (y * S - cam.y) * cam.k
      return [dx * cyw - dy * syw, dx * syw + dy * cyw]
    }
    const toScr = ([dx, dy]: [number, number]): [number, number] => {
      const p = cam.F / (cam.F - dy * st)
      return [cam.cx + dx * p, cam.cy + dy * ct * p]
    }
    const cut = (a: [number, number], b: [number, number]): [number, number] => {
      const k = (LIM - a[1]) / (b[1] - a[1])
      return [a[0] + (b[0] - a[0]) * k, LIM]
    }
    const trace = (p: number[], close: boolean) => {
      const pts: [number, number][] = []
      for (let j = 0; j < p.length; j += 2) pts.push(toCam(p[j], p[j + 1]))
      if (close) {
        const out: [number, number][] = []
        for (let j = 0; j < pts.length; j++) {
          const a = pts[(j + pts.length - 1) % pts.length]
          const b = pts[j]
          const ain = a[1] <= LIM
          if (b[1] <= LIM) {
            if (!ain) out.push(cut(a, b))
            out.push(b)
          } else if (ain) out.push(cut(a, b))
        }
        out.forEach((q, j) => {
          const [x, y] = toScr(q)
          if (j) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        })
        if (out.length) ctx.closePath()
        return
      }
      let pen = false
      for (let j = 0; j < pts.length; j++) {
        const b = pts[j]
        const a = pts[j - 1]
        if (b[1] > LIM) {
          if (pen && a) {
            const [x, y] = toScr(cut(a, b))
            ctx.lineTo(x, y)
          }
          pen = false
          continue
        }
        if (!pen) {
          const start = a && a[1] > LIM ? cut(b, a) : b
          const [x, y] = toScr(start)
          ctx.moveTo(x, y)
          pen = true
          if (start !== b) {
            const [x2, y2] = toScr(b)
            ctx.lineTo(x2, y2)
          }
        } else {
          const [x, y] = toScr(b)
          ctx.lineTo(x, y)
        }
      }
    }
    const sea = ctx.createLinearGradient(0, h * 0.24, w, h * 1.07)
    sea.addColorStop(0, '#163B62')
    sea.addColorStop(1, '#0C2440')
    ctx.beginPath()
    for (const p of data.sea) trace(p, true)
    ctx.fillStyle = sea
    ctx.fill('evenodd')
    ctx.beginPath()
    for (const p of data.water) trace(p, true)
    ctx.fillStyle = '#0F2A46'
    ctx.fill()
    ctx.strokeStyle = 'rgba(110,160,220,.38)'
    ctx.lineWidth = 1
    ctx.stroke()
    const lines = (set: number[][], style: string, lw: number) => {
      ctx.beginPath()
      for (const p of set) trace(p, false)
      ctx.strokeStyle = style
      ctx.lineWidth = lw
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    lines(data.streams, 'rgba(70,120,180,.45)', 1)
    lines(data.rivers, 'rgba(110,170,235,.8)', 2.2)
    // no line along the shore — the sea's own edge draws it

    // sectors: free ones are outlines on the map, held ones stand in their colour
    const events: { s: Sector; local: number; name: string; col: string }[] = []
    for (const s of drawOrder) {
      const [px, py, sc] = project(cam, s.x, s.y, 0)
      if (px < -80 || px > w + 80 || py < 60 || py > h + 100 || sc < 0.3) continue
      let col = s.color
      let hh = col ? HELD : 0
      const m = lastCapture.get(s)
      if (m !== undefined) {
        const local = t - m * STEP
        const next = colorOf(taker(m))
        let prev = s.color
        for (let q = m - 1; q >= 0 && q > m - ORDER.length; q--)
          if (PATH[ORDER[q % ORDER.length]] === s) {
            prev = colorOf(taker(q))
            break
          }
        // no jumps: the old colour sinks a little and melts into the new one
        if (local < 0.45) {
          const p = easeOut(local / 0.45)
          col = prev ? mix(prev, next, p) : next
          hh = prev ? HELD * (1 - 0.45 * p) : 0
        } else {
          const p = easeOut((local - 0.45) / 0.6)
          col = next
          const from = prev ? HELD * 0.55 : 0
          hh = from + (HELD - from) * p
        }
        if (local < 1.9) events.push({ s, local, name: taker(m), col: next })
      }
      if (col) prism(ctx, cam, s.x, s.y, R * 0.92, hh, col)
      else {
        hexPath(ctx, HEX.map(([a, b]) => project(cam, s.x + a * R * 0.92, s.y + b * R * 0.92, 0)))
        ctx.fillStyle = 'rgba(70,110,160,.16)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(150,185,225,.42)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // nothing behind the headline; below it the far city melts into the night
    const fog = ctx.createLinearGradient(0, clearTop - 20, 0, clearTop + 130)
    fog.addColorStop(0, 'rgba(5,12,20,1)')
    fog.addColorStop(1, 'rgba(5,12,20,0)')
    ctx.fillStyle = fog
    ctx.fillRect(0, 0, w, clearTop + 130)

    // the capture: rings on the water, a beam, the name over the sector
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const e of events) {
      const rl = e.local - 0.35
      const rg = easeOut(rl / 1.2)
      if (rl > 0 && rl < 1.2) {
        groundRing(ctx, cam, e.s.x, e.s.y, R * (0.8 + 2.2 * rg), e.col, 0.7 * (1 - rg), 2.5)
        groundRing(ctx, cam, e.s.x, e.s.y, R * (0.6 + 1.2 * rg), '#ffffff', 0.28 * (1 - rg), 1.2)
      }
      const beamA = e.local < 0.4 ? 0.65 * easeOut(e.local / 0.4) : 0.65 * Math.max(0, 1 - (e.local - 0.4) / 1.3)
      if (beamA > 0) {
        const [bx, by, bs] = project(cam, e.s.x, e.s.y, HELD)
        const [, ty] = project(cam, e.s.x, e.s.y, 260)
        const gr = ctx.createLinearGradient(0, by, 0, ty)
        gr.addColorStop(0, shade(e.col, 1, 0.85 * beamA))
        gr.addColorStop(1, shade(e.col, 1, 0))
        ctx.fillStyle = gr
        const bw = 9 * bs
        ctx.fillRect(bx - bw / 2, ty, bw, by - ty)
        ctx.fillStyle = `rgba(255,255,255,${0.45 * beamA})`
        ctx.fillRect(bx - bw / 6, ty, bw / 3, by - ty)
      }
    }
    ctx.restore()
    for (const e of events) {
      const a = Math.min(1, e.local / 0.35) * Math.min(1, (1.9 - e.local) / 0.45)
      if (a <= 0) continue
      const [lx, ly] = project(cam, e.s.x, e.s.y, HELD)
      const rise = 12 * easeOut(e.local / 0.5)
      ctx.save()
      ctx.globalAlpha = a
      ctx.font = `800 13px ${labelFont}`
      const label = `${e.name} · ${e.s.id}`
      const lw = ctx.measureText(label).width + 30
      const x0 = Math.max(10, Math.min(w - 10 - lw, lx - lw / 2))
      const y0 = ly - 58 - rise
      ctx.shadowColor = 'rgba(0,0,0,.35)'
      ctx.shadowBlur = 14
      ctx.shadowOffsetY = 4
      roundRect(ctx, x0, y0, lw, 28, 14)
      ctx.fillStyle = '#F4F6FA'
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.beginPath()
      ctx.arc(x0 + 14, y0 + 14, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = e.col
      ctx.fill()
      ctx.fillStyle = '#121822'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x0 + 24, y0 + 14.5)
      ctx.beginPath()
      ctx.moveTo(lx - 6, y0 + 28)
      ctx.lineTo(lx, y0 + 35)
      ctx.lineTo(lx + 6, y0 + 28)
      ctx.fillStyle = '#F4F6FA'
      ctx.fill()
      ctx.restore()
    }
  }
}
