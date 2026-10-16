import { tn } from '@/lib/i18n/runtime'
import { HELD, HEX, NAMES, R, S, easeOut, groundRing, hexPath, mix, prism, project, roundRect, shade, type Cam, type CoastData, type TickerLine } from '@/lib/welcome/coastScene'

// One map for the welcome screen and the two intro screens after it: the same
// night coast, the same sectors standing in their owners' colours, with one
// camera that flies from stop to stop —
//   welcome          the coast with captures coming in, the camera gliding along it
//   territory-intro  a stretch of the boulevard, sectors to tap and take
//   catch-intro      another stretch, a photo flying into a sector
// — in about a second, with a gentle arc (it rises a little in the middle of the
// flight and settles), instead of three separate maps that cut from one to the
// next. Sectors keep their state between stops: what was taken stays taken.

export type Stage = 'welcome' | 'territory-intro' | 'catch-intro'
export type Band = { top: number; bottom: number }
export type Bands = Record<Stage, Band>
export type IntroRole = 'free' | 'other' | 'mine'

type Look = { x: number; y: number; zoom: number; pitch: number; yaw: number; at: number }
type Sec = { id: string; x: number; y: number; color: string | null; holder: string | null; mine: boolean }
type Ev = { t0: number; from: string | null; to: string; label: string }
type Hit = { id: string; poly: [number, number][] }
type Tween = { t0: number; dur: number; from: Look; to: Look; arc: number; bandFrom: Band; bandTo: Band }

const MINE = '#FF7A1F'
const OTHERS = ['#4C9BFF', '#2FD08A', '#A77BFF', '#FF5A4E', '#E8EEF6', '#4CC9F0', '#B5E254']
const STEP = 2.6
const PATH_IDS = ['B0537', 'B0782', 'B0934', 'B1031', 'B1173', 'B1316', 'B1461', 'B1607']
// Where the two playable stops look (real ids in batumi-coast.json): the
// boulevard by «Али и Нино», and another stretch of the shore, at the same zoom.
const STOPS = {
  'territory-intro': { center: 'B1126', zoom: 2.0, pitch: 0.8, yaw: 0.35, at: 0.5 },
  'catch-intro': { center: 'B0689', zoom: 2.0, pitch: 0.8, yaw: 0.35, at: 0.5 },
} as const
const WELCOME_LOOK = { zoom: 1, pitch: 0.98, yaw: -0.65, at: 0.78 }

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const hash = (s: string) => {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003
  return h
}
const colorOfName = (name: string) => OTHERS[Math.max(0, NAMES.indexOf(name)) % OTHERS.length]

export function createJourneyScene(data: CoastData, labelFont: string, onTicker: (line: TickerLine) => void) {
  const cam: Cam = { x: 0, y: 0, k: 1, pitch: WELCOME_LOOK.pitch, F: 1250, cx: 0, cy: 0, yaw: WELCOME_LOOK.yaw }
  const secs: Sec[] = data.sectors.map(([id, x, y]) => ({ id, x: x * S, y: y * S, color: null, holder: null, mine: false }))
  const byId = new Map(secs.map((s) => [s.id, s]))
  const need = (id: string) => byId.get(id) ?? secs[Math.floor(secs.length / 2)]

  // Initial holders: about a third of the sectors, like the welcome map was —
  // and among the nearest to each playable stop, one in three for sure, so
  // there is always somebody's sector to take in the frame.
  const forced = new Map<string, number>()
  for (const stop of Object.values(STOPS)) {
    const c = need(stop.center)
    secs
      .map((s) => ({ id: s.id, d: Math.hypot(s.x - c.x, s.y - c.y) }))
      .sort((p, q) => p.d - q.d)
      .slice(1, 19)
      .forEach((n, i) => i % 3 === 1 && forced.set(n.id, i))
  }
  const initial = (s: { id: string }): { color: string | null; holder: string | null } => {
    const f = forced.get(s.id)
    if (f !== undefined) return { color: OTHERS[f % OTHERS.length], holder: NAMES[(f * 5 + 2) % NAMES.length] }
    const h = hash(s.id)
    if (h % 100 >= 32) return { color: null, holder: null }
    return { color: OTHERS[h % OTHERS.length], holder: NAMES[h % NAMES.length] }
  }
  for (const s of secs) Object.assign(s, initial(s))

  const events = new Map<string, Ev>()
  let hits: Hit[] = []
  let now = 0
  let lastT = -1
  let stage: Stage = 'welcome'
  let tween: Tween | null = null
  const path = PATH_IDS.map((id) => byId.get(id)).filter((s): s is Sec => !!s)
  if (path.length === 0) path.push(secs[Math.floor(secs.length / 2)])
  const order = [...path.keys(), ...[...path.keys()].slice(1, -1).reverse()]
  const taker = (n: number) => NAMES[(n * 5 + 3) % NAMES.length]
  let ambT0 = 0
  let ambN = -1
  let look: Look = { x: path[0].x, y: path[0].y, ...WELCOME_LOOK }
  let band: Band = { top: 0, bottom: 0 }

  const ambientTarget = (): Sec => path[order[Math.max(0, Math.floor((now - ambT0) / STEP)) % order.length]]
  const stopLook = (st: Exclude<Stage, 'welcome'>): Look => {
    const c = need(STOPS[st].center)
    return { x: c.x, y: c.y, zoom: STOPS[st].zoom, pitch: STOPS[st].pitch, yaw: STOPS[st].yaw, at: STOPS[st].at }
  }
  const lookOf = (st: Stage): Look => (st === 'welcome' ? { x: ambientTarget().x, y: ambientTarget().y, ...WELCOME_LOOK } : stopLook(st))

  function label(s: Sec) {
    return s.holder && !s.mine ? tn('onb.stolenFrom', { name: s.holder }) : tn('onb.yoursSector')
  }

  const api = {
    centreId: (st: Exclude<Stage, 'welcome'>) => STOPS[st].center,
    roleOf(id: string): IntroRole {
      const s = byId.get(id)
      return !s ? 'free' : s.mine ? 'mine' : s.color ? 'other' : 'free'
    },
    holderOf: (id: string) => byId.get(id)?.holder ?? null,
    mineCount: () => secs.filter((s) => s.mine).length,
    flying: () => tween !== null,
    // Fly to a stop — about a second, eased at both ends, with a small rise in
    // the middle of a long one. `instant` just puts the camera there. Returns
    // how long it takes, in seconds.
    setStage(next: Stage, bands: Bands, instant = false): number {
      if (next === stage && !tween) return 0
      stage = next
      if (next === 'welcome') {
        ambT0 = now
        ambN = -1
      }
      const to = lookOf(next)
      const bandTo = bands[next]
      if (instant) {
        look = to
        band = bandTo
        tween = null
        return 0
      }
      const dist = Math.hypot(to.x - look.x, to.y - look.y)
      const dur = 0.9 + Math.min(0.45, dist / 1800)
      tween = { t0: now, dur, from: { ...look }, to, arc: Math.min(0.32, dist / 1200), bandFrom: { ...band }, bandTo }
      return dur
    },
    // Take a sector for the player — free or held (a bounce if already theirs).
    claim(id: string) {
      const s = byId.get(id)
      if (!s) return null
      const lbl = s.mine ? tn('onb.yoursSector') : label(s)
      events.set(id, { t0: now, from: s.mine ? MINE : s.color, to: MINE, label: lbl })
      s.mine = true
      s.color = MINE
      return lbl
    },
    // Put a sector back as free, or held by a named player.
    set(id: string, to: 'free' | { holder: string; color: string }) {
      const s = byId.get(id)
      if (!s) return
      events.delete(id)
      s.mine = false
      if (to === 'free') {
        s.color = null
        s.holder = null
      } else {
        s.color = to.color
        s.holder = to.holder
      }
    },
    restoreAll() {
      events.clear()
      for (const s of secs) Object.assign(s, initial(s), { mine: false })
    },
    screenOf(id: string): [number, number] | null {
      const s = byId.get(id)
      if (!s) return null
      const [x, y] = project(cam, s.x, s.y, s.mine ? HELD * 1.25 : s.color ? HELD : 0)
      return [x, y]
    },
    // What is under a point: nearest sector first.
    pick(px: number, py: number): string | null {
      for (let i = hits.length - 1; i >= 0; i--) {
        const poly = hits[i].poly
        let inside = false
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
          const [xa, ya] = poly[a]
          const [xb, yb] = poly[b]
          if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside
        }
        if (inside) return hits[i].id
      }
      return null
    },
    // Free / held sectors in the frame where a demo may tap, the best first: well
    // inside the band; failing that, anywhere in it that still shows; failing
    // that, none (see `ensure`).
    candidates(role: 'free' | 'other', view: { w: number }): string[] {
      const tiers: string[][] = [[], []]
      for (const s of secs) {
        if (s.mine || (role === 'free') !== !s.color) continue
        const [x, y] = project(cam, s.x, s.y, 0)
        if (x > view.w * 0.14 && x < view.w * 0.86 && y > band.top + 30 && y < band.bottom - 110) tiers[0].push(s.id)
        else if (x > view.w * 0.06 && x < view.w * 0.94 && y > band.top + 10 && y < band.bottom - 56) tiers[1].push(s.id)
      }
      return tiers[0].length ? tiers[0] : tiers[1]
    },
    // A sector of the wanted kind next to the middle of the frame — made one if
    // there is none: the demo always has something to show, whatever the screen.
    ensure(role: 'free' | 'other'): string | null {
      let best: Sec | null = null
      let bd = Infinity
      for (const s of secs) {
        if (s.mine) continue
        const d = Math.hypot(s.x - look.x, s.y - look.y)
        if (d < bd) {
          bd = d
          best = s
        }
      }
      if (!best) return null
      if (role === 'free') {
        best.color = null
        best.holder = null
      } else if (!best.color) {
        const i = hash(best.id)
        best.color = OTHERS[i % OTHERS.length]
        best.holder = NAMES[i % NAMES.length]
      }
      return best.id
    },
    draw(ctx: CanvasRenderingContext2D, time: number, view: { w: number; h: number }, bands: Bands) {
      const t = Number.isFinite(time) ? Math.max(0, time) : 0
      const dt = lastT < 0 ? 0 : Math.min(0.05, Math.max(0, t - lastT))
      lastT = t
      now = t
      const { w, h } = view
      const bandNow = bands[stage]

      // ---- the camera
      let zoomMul = 1
      if (tween) {
        const p = clamp01((t - tween.t0) / tween.dur)
        const e = easeInOut(p)
        const to = stage === 'welcome' ? lookOf('welcome') : tween.to
        look = {
          x: lerp(tween.from.x, to.x, e),
          y: lerp(tween.from.y, to.y, e),
          zoom: lerp(tween.from.zoom, to.zoom, e),
          pitch: lerp(tween.from.pitch, to.pitch, e),
          yaw: lerp(tween.from.yaw, to.yaw, e),
          at: lerp(tween.from.at, to.at, e),
        }
        zoomMul = 1 - tween.arc * Math.sin(Math.PI * e)
        band = { top: lerp(tween.bandFrom.top, tween.bandTo.top, e), bottom: lerp(tween.bandFrom.bottom, tween.bandTo.bottom, e) }
        if (p >= 1) tween = null
      } else {
        band = bandNow
        if (stage === 'welcome') {
          // the camera glides to each capture along the shore
          const target = ambientTarget()
          const f = dt === 0 ? 1 : 1 - Math.exp(-dt * 1.5)
          look = { ...look, x: look.x + (target.x - look.x) * f, y: look.y + (target.y - look.y) * f }
        } else look = lookOf(stage)
      }
      cam.x = look.x
      cam.y = look.y
      cam.pitch = look.pitch
      cam.yaw = look.yaw
      cam.k = look.zoom * zoomMul * Math.min(1.25, Math.max(0.85, w / 390)) * (1 + 0.012 * Math.sin(t * 0.4))
      cam.cx = w / 2
      cam.cy = band.top + (band.bottom - band.top) * look.at

      // ---- the captures coming in on the welcome map
      if (stage === 'welcome' && !tween) {
        const n = Math.floor((t - ambT0) / STEP)
        if (n !== ambN && n >= 0) {
          ambN = n
          const target = path[order[n % order.length]]
          const name = taker(n)
          const col = colorOfName(name)
          if (!target.mine) {
            const held = !!target.color
            events.set(target.id, { t0: t, from: target.color, to: col, label: `${name} · ${target.id}` })
            target.color = col
            target.holder = name
            onTicker({ name, verb: held ? tn('onb.tickerTook') : tn('onb.tickerClaimed'), id: target.id, day: n % 3 === 2 ? tn('onb.tickerYesterday') : tn('onb.tickerToday') })
          }
        }
      }

      // ---- background
      ctx.fillStyle = '#050C14'
      ctx.fillRect(0, 0, w, h)
      const glow = ctx.createRadialGradient(w * 0.6, cam.cy - 30, 20, w * 0.6, cam.cy - 30, 460)
      glow.addColorStop(0, 'rgba(30,52,78,.5)')
      glow.addColorStop(1, 'rgba(5,12,20,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // ---- terrain (the welcome map's): every ring and line is cut at a plane
      // in front of the camera, so nothing flashes across the screen.
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

      // ---- sectors, far to near on the (turning) board; the ones sinking into
      // the night at the bottom of the band fade out instead of being cut
      const seen: { s: Sec; px: number; py: number; depth: number }[] = []
      for (const s of secs) {
        const [px, py, sc] = project(cam, s.x, s.y, 0)
        if (px < -90 || px > w + 90 || py < 30 || py > h + 100 || sc < 0.3) continue
        seen.push({ s, px, py, depth: s.x * syw + s.y * cyw })
      }
      seen.sort((a, b) => a.depth - b.depth)
      hits = []
      const live: { s: Sec; local: number; col: string; label: string }[] = []
      const fadeTo = band.bottom - 20
      for (const { s, py } of seen) {
        const alpha = stage === 'welcome' && !tween ? 1 : clamp01((fadeTo - py) / 90)
        let col = s.color
        let hh = col ? HELD : 0
        const ev = events.get(s.id)
        if (ev) {
          const local = t - ev.t0
          const settled = s.mine ? HELD * 1.25 : HELD
          if (local < 0.45) {
            const p = easeOut(local / 0.45)
            col = ev.from ? mix(ev.from, ev.to, p) : ev.to
            hh = ev.from ? HELD * (1 - 0.45 * p) : 0
          } else {
            const p = easeOut((local - 0.45) / 0.6)
            col = ev.to
            const from = ev.from ? HELD * 0.55 : 0
            hh = from + (settled - from) * p
          }
          if (local < 2.1) live.push({ s, local, col: ev.to, label: ev.label })
        } else if (s.mine) hh = HELD * 1.25
        if (alpha <= 0.02) continue
        const rad = R * 0.92
        ctx.globalAlpha = alpha
        if (col) prism(ctx, cam, s.x, s.y, rad, hh, col)
        else {
          hexPath(ctx, HEX.map(([a, b]) => project(cam, s.x + a * rad, s.y + b * rad, 0)))
          ctx.fillStyle = 'rgba(70,110,160,.16)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(150,185,225,.42)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        if (alpha > 0.4) hits.push({ id: s.id, poly: HEX.map(([a, b]) => { const q = project(cam, s.x + a * rad, s.y + b * rad, hh); return [q[0], q[1]] as [number, number] }) })
      }

      // the map melts into the night above the band
      const fogT = ctx.createLinearGradient(0, band.top - 30, 0, band.top + 90)
      fogT.addColorStop(0, 'rgba(5,12,20,1)')
      fogT.addColorStop(1, 'rgba(5,12,20,0)')
      ctx.fillStyle = fogT
      ctx.fillRect(0, 0, w, band.top + 90)

      // the capture: rings on the water, a beam, the name over the sector
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const e of live) {
        const rl = e.local - 0.35
        const rg = easeOut(rl / 1.2)
        if (rl > 0 && rl < 1.2) {
          groundRing(ctx, cam, e.s.x, e.s.y, R * (0.8 + 2.2 * rg), e.col, 0.75 * (1 - rg), 2.5)
          groundRing(ctx, cam, e.s.x, e.s.y, R * (0.6 + 1.2 * rg), '#ffffff', 0.3 * (1 - rg), 1.2)
        }
        const beamA = e.local < 0.4 ? 0.7 * easeOut(e.local / 0.4) : 0.7 * Math.max(0, 1 - (e.local - 0.4) / 1.5)
        if (beamA > 0) {
          const [bx, by, bs] = project(cam, e.s.x, e.s.y, HELD * 1.25)
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
      for (const e of live) {
        const a = Math.min(1, e.local / 0.35) * Math.min(1, (2.1 - e.local) / 0.45)
        if (a <= 0) continue
        const [lx, ly] = project(cam, e.s.x, e.s.y, HELD * 1.25)
        const rise = 12 * easeOut(e.local / 0.5)
        ctx.save()
        ctx.globalAlpha = a
        ctx.font = `800 13px ${labelFont}`
        const lw = ctx.measureText(e.label).width + 30
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
        ctx.fillText(e.label, x0 + 24, y0 + 14.5)
        ctx.beginPath()
        ctx.moveTo(lx - 6, y0 + 28)
        ctx.lineTo(lx, y0 + 35)
        ctx.lineTo(lx + 6, y0 + 28)
        ctx.fillStyle = '#F4F6FA'
        ctx.fill()
        ctx.restore()
      }
    },
  }
  return api
}

export type JourneyScene = ReturnType<typeof createJourneyScene>
