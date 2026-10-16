import { tn } from '@/lib/i18n/runtime'
import { HELD, HEX, NAMES, R, S, easeOut, groundRing, hexPath, mix, prism, project, roundRect, shade, type Cam, type CoastData } from '@/lib/welcome/coastScene'

// The two intro screens' map: the same night coast as the welcome screen — sea,
// shore, rivers, the game's sectors standing in their owners' colours — but
// one you can play with. A sector can be claimed (it rises in orange with
// rings on the water, a beam and a name over it), whether it was free or held
// by someone else. The screen decides when (a tap, a self-playing demo, the
// shutter button); this draws it and answers «what is under this point».

const MINE = '#FF7A1F'
const OTHERS = ['#4C9BFF', '#2FD08A', '#A77BFF', '#FF5A4E', '#E8EEF6', '#4CC9F0', '#B5E254']

export type IntroView = { w: number; h: number; top: number; bottom: number }
export type IntroOptions = {
  // The sector the camera looks at (a real id in batumi-coast.json).
  center: string
  // 1 = the welcome screen's zoom.
  zoom: number
  // How far from the centre sectors are drawn (map units; a sector's centres are ~52 apart).
  radius: number
  // Where in the free band the centre sits: 0 top … 1 bottom.
  at?: number
  pitch?: number
  yaw?: number
}
export type IntroRole = 'free' | 'other' | 'mine'

type Sec = { id: string; x: number; y: number; color: string | null; holder: string | null; mine: boolean }
type Ev = { t0: number; from: string | null; to: string; label: string }
type Hit = { id: string; poly: [number, number][] }

const hash = (s: string) => {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003
  return h
}

export function createIntroScene(data: CoastData, labelFont: string, opts: IntroOptions) {
  const cam: Cam = { x: 0, y: 0, k: 1, pitch: opts.pitch ?? 0.98, F: 1250, cx: 0, cy: 0, yaw: opts.yaw ?? -0.65 }
  const all = data.sectors.map(([id, x, y]) => ({ id, x: x * S, y: y * S }))
  const centre = all.find((s) => s.id === opts.center) ?? all[Math.floor(all.length / 2)]
  const sy = Math.sin(cam.yaw)
  const cyw = Math.cos(cam.yaw)
  // Initial holders: about a third of the sectors, like the welcome map — and
  // among the dozen-odd nearest the middle, one in three for sure, so there is
  // always somebody's sector to take in the frame wherever the map is.
  const nearest = all
    .map((s) => ({ id: s.id, d: Math.hypot(s.x - centre.x, s.y - centre.y) }))
    .sort((p, q) => p.d - q.d)
    .slice(1, 19)
  const forced = new Map(nearest.map((n, i) => [n.id, i]).filter(([, i]) => (i as number) % 3 === 1) as [string, number][])
  const initial = (s: { id: string }): { color: string | null; holder: string | null } => {
    const f = forced.get(s.id)
    if (f !== undefined) return { color: OTHERS[f % OTHERS.length], holder: NAMES[(f * 5 + 2) % NAMES.length] }
    const h = hash(s.id)
    if (h % 100 >= 32) return { color: null, holder: null }
    return { color: OTHERS[h % OTHERS.length], holder: NAMES[h % NAMES.length] }
  }
  const secs: Sec[] = all
    .filter((s) => Math.hypot(s.x - centre.x, s.y - centre.y) <= opts.radius)
    .map((s) => ({ ...s, ...initial(s), mine: false }))
  // far to near on the turned board
  secs.sort((a, b) => a.x * sy + a.y * cyw - (b.x * sy + b.y * cyw))
  const byId = new Map(secs.map((s) => [s.id, s]))
  const events = new Map<string, Ev>()
  let hits: Hit[] = []
  let now = 0
  cam.x = centre.x
  cam.y = centre.y

  function label(s: Sec) {
    return s.holder && !s.mine ? tn('onb.stolenFrom', { name: s.holder }) : tn('onb.yoursSector')
  }

  const api = {
    centreId: centre.id,
    ids: () => secs.map((s) => s.id),
    roleOf(id: string): IntroRole {
      const s = byId.get(id)
      return !s ? 'free' : s.mine ? 'mine' : s.color ? 'other' : 'free'
    },
    holderOf: (id: string) => byId.get(id)?.holder ?? null,
    mineCount: () => secs.filter((s) => s.mine).length,
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
    // Put a sector back as it was, or as a free one / held by a named player.
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
    // Screen position (px) of a sector's middle, for overlays.
    screenOf(id: string): [number, number] | null {
      const s = byId.get(id)
      if (!s) return null
      const [x, y] = project(cam, s.x, s.y, s.mine ? HELD : 0)
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
    // Free / held sectors near the middle of the screen — where a demo may tap.
    candidates(role: 'free' | 'other', view: IntroView): string[] {
      const out: string[] = []
      for (const s of secs) {
        if (s.mine || (role === 'free') !== !s.color) continue
        const [x, y] = project(cam, s.x, s.y, 0)
        if (x > view.w * 0.14 && x < view.w * 0.86 && y > view.top + 30 && y < view.bottom - 110) out.push(s.id)
      }
      return out
    },
    draw(ctx: CanvasRenderingContext2D, time: number, view: IntroView) {
      const t = Number.isFinite(time) ? Math.max(0, time) : 0
      now = t
      const { w, h, top, bottom } = view
      cam.k = opts.zoom * Math.min(1.25, Math.max(0.85, w / 390)) * (1 + 0.012 * Math.sin(t * 0.4))
      cam.cx = w / 2
      cam.cy = top + (bottom - top) * (opts.at ?? 0.55)

      ctx.fillStyle = '#050C14'
      ctx.fillRect(0, 0, w, h)
      const glow = ctx.createRadialGradient(w * 0.55, cam.cy - 30, 20, w * 0.55, cam.cy - 30, 460)
      glow.addColorStop(0, 'rgba(30,52,78,.5)')
      glow.addColorStop(1, 'rgba(5,12,20,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // terrain — a copy of the welcome map's: every ring and line is cut at a
      // plane in front of the camera so nothing flashes across the screen.
      const ct = Math.cos(cam.pitch)
      const st = Math.sin(cam.pitch)
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

      // sectors
      hits = []
      const live: { s: Sec; local: number; col: string; label: string }[] = []
      for (const s of secs) {
        const [px, py, sc] = project(cam, s.x, s.y, 0)
        // none whose middle sinks into the fog at the bottom of the band — a hexagon half melted into the night reads as a cut one
        if (px < -80 || px > w + 80 || py < 40 || py > bottom - 108 || sc < 0.3) continue
        let col = s.color
        let hh = col ? HELD : 0
        const ev = events.get(s.id)
        if (ev) {
          const local = t - ev.t0
          if (local < 0.45) {
            const p = easeOut(local / 0.45)
            col = ev.from ? mix(ev.from, ev.to, p) : ev.to
            hh = ev.from ? HELD * (1 - 0.45 * p) : 0
          } else {
            const p = easeOut((local - 0.45) / 0.6)
            col = ev.to
            const from = ev.from ? HELD * 0.55 : 0
            hh = from + (HELD * 1.25 - from) * p
          }
          if (local < 2.1) live.push({ s, local, col: ev.to, label: ev.label })
        } else if (s.mine) hh = HELD * 1.25
        const rad = R * 0.92
        if (col) prism(ctx, cam, s.x, s.y, rad, hh, col)
        else {
          hexPath(ctx, HEX.map(([a, b]) => project(cam, s.x + a * rad, s.y + b * rad, 0)))
          ctx.fillStyle = 'rgba(70,110,160,.16)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(150,185,225,.42)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        hits.push({ id: s.id, poly: HEX.map(([a, b]) => { const q = project(cam, s.x + a * rad, s.y + b * rad, hh); return [q[0], q[1]] as [number, number] }) })
      }

      // the map melts into the night above and below the free band
      const fogT = ctx.createLinearGradient(0, top - 30, 0, top + 70)
      fogT.addColorStop(0, 'rgba(5,12,20,1)')
      fogT.addColorStop(1, 'rgba(5,12,20,0)')
      ctx.fillStyle = fogT
      ctx.fillRect(0, 0, w, top + 70)
      const fogB = ctx.createLinearGradient(0, bottom - 60, 0, bottom + 24)
      fogB.addColorStop(0, 'rgba(5,12,20,0)')
      fogB.addColorStop(1, 'rgba(5,12,20,1)')
      ctx.fillStyle = fogB
      ctx.fillRect(0, bottom - 60, w, h - bottom + 60)

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

export type IntroScene = ReturnType<typeof createIntroScene>
