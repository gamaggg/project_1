// One slide of «Неделя в городе», drawn at 1080×1920. Pure markup with
// inline styles and flexbox only — the same component is rendered by the
// in-app player (scaled to the screen, numbers counting up via `anim`) and
// by the server's image renderer for «Поделиться» (anim = 1), which
// understands only that subset of CSS. No hooks, no classes.

import type { ReactNode } from 'react'
import { busiestWindow, type SlideId, type WeekRecap } from '@/lib/recap'
import type { CityId } from '@/lib/data/city'
import type { Lang, TKey, TVars } from '@/lib/i18n/core'

export const SLIDE_W = 1080
export const SLIDE_H = 1920

export type SlideEnv = {
  data: WeekRecap
  city: CityId
  lang: Lang
  t: (key: TKey, vars?: TVars) => string
  // 0 → 1 over the slide's first second: numbers count up, bars grow.
  anim: number
  // Where a photo comes from at a given box (an image-service URL in the
  // app, a pre-fetched data: URL on the server); null — leave it out.
  img: (url: string, w: number, h: number) => string | null
  logo: string | null
  fonts: { display: string; body: string }
  // The shared image carries the site's address at the bottom.
  branded?: boolean
  // In the app: a moving background layer (bubbles, drifting light) drawn
  // under the text. The still image has none.
  decor?: ReactNode
}

const YELLOW = '#FFE14D'

export const SLIDE_BG: Record<SlideId, string> = {
  intro: 'linear-gradient(165deg, #3B12E8 0%, #7A1CFF 55%, #B42BFF 100%)',
  numbers: 'linear-gradient(165deg, #FF2E3B 0%, #FF5A1F 60%, #FF8A00 100%)',
  species: 'linear-gradient(165deg, #5A1DFF 0%, #3A16C9 55%, #23108F 100%)',
  trophy: '#0B1A20',
  angler: 'linear-gradient(165deg, #00B2A9 0%, #0A7BFF 100%)',
  sector: 'linear-gradient(165deg, #E600C8 0%, #9B00FF 100%)',
  time: 'linear-gradient(165deg, #FF8A00 0%, #FF3D6E 100%)',
  you: 'linear-gradient(165deg, #15C46F 0%, #078A55 100%)',
  final: 'linear-gradient(165deg, #FC5200 0%, #FF2E62 100%)',
}

const ease = (a: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, a)), 3)
const count = (v: number, anim: number) => Math.round(v * ease(anim))
const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

function dayRange(env: SlideEnv) {
  const f = new Intl.DateTimeFormat(env.lang, { day: 'numeric', month: 'short' })
  const a = new Date(`${env.data.weekStart}T12:00:00`)
  const b = new Date(`${env.data.weekEnd}T12:00:00`)
  return `${f.format(a)} – ${f.format(b)}`
}

function Frame({ id, env, children, photo }: { id: SlideId; env: SlideEnv; children: ReactNode; photo?: ReactNode }) {
  return (
    <div
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        background: SLIDE_BG[id],
        fontFamily: env.fonts.body,
        color: '#fff',
      }}
    >
      {/* A soft glow so the colour fields aren't flat. */}
      <div style={{ position: 'absolute', top: -260, right: -300, width: 900, height: 900, borderRadius: 450, background: 'radial-gradient(circle, rgba(255,255,255,.22), rgba(255,255,255,0) 70%)', display: 'flex' }} />
      <div style={{ position: 'absolute', bottom: -320, left: -280, width: 860, height: 860, borderRadius: 430, background: 'radial-gradient(circle, rgba(255,225,77,.18), rgba(255,225,77,0) 70%)', display: 'flex' }} />
      {!photo && env.decor}
      {photo}
      <div style={{ position: 'absolute', top: 170, left: 84, right: 84, display: 'flex', color: YELLOW, fontSize: 38, fontWeight: 800, letterSpacing: 1 }}>
        {env.t('recap.kicker')} · {dayRange(env)}
      </div>
      <div style={{ position: 'absolute', top: 250, left: 84, right: 84, bottom: env.branded ? 170 : 220, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {env.branded && (
        <div style={{ position: 'absolute', left: 84, right: 84, bottom: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {env.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- shared markup for the image renderer
            <img src={env.logo} width={230} height={66} alt="" />
          ) : (
            <span style={{ fontSize: 40, fontWeight: 800 }}>RANGE</span>
          )}
          <span style={{ fontSize: 34, color: 'rgba(255,255,255,.75)' }}>catchrange.com</span>
        </div>
      )}
    </div>
  )
}

function Title({ env, children }: { env: SlideEnv; children: ReactNode }) {
  return <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, fontFamily: env.fonts.body }}>{children}</div>
}

function Avatar({ env, url, name, size, ring }: { env: SlideEnv; url: string | null; name: string | null; size: number; ring?: string }) {
  const src = url ? env.img(url, size * 2, size * 2) : null
  const border = ring ? `${Math.round(size / 28)}px solid ${ring}` : 'none'
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- shared markup for the image renderer
    <img src={src} width={size} height={size} style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', border }} alt="" />
  ) : (
    <div style={{ width: size, height: size, borderRadius: size / 2, border, background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 2.6, fontWeight: 800 }}>
      {(name ?? '?').slice(0, 2).toUpperCase()}
    </div>
  )
}

function Delta({ env, now, prev }: { env: SlideEnv; now: number; prev: number }) {
  if (!prev) return null
  const pct = Math.round(((now - prev) / prev) * 100)
  if (pct === 0) return null
  return (
    <div style={{ display: 'flex', marginTop: 10, alignSelf: 'flex-start', padding: '8px 22px', borderRadius: 40, background: 'rgba(255,255,255,.2)', fontSize: 34, fontWeight: 800 }}>
      {env.t('recap.vsPrev', { sign: pct > 0 ? '+' : '−', pct: Math.abs(pct) })}
    </div>
  )
}

function Intro({ env }: { env: SlideEnv }) {
  const d = env.data
  return (
    <Frame id="intro" env={env}>
      <Title env={env}>{env.t('recap.introTitle', { cityIn: env.t(`recap.cityIn.${env.city}` as TKey) })}</Title>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto' }}>
        <div style={{ display: 'flex', fontFamily: env.fonts.display, fontSize: 420, lineHeight: 0.9, color: YELLOW }}>{count(d.catches, env.anim)}</div>
        <div style={{ display: 'flex', fontSize: 110, fontWeight: 800, marginTop: 10 }}>{env.t('recap.introBig', { count: d.catches })}</div>
        <div style={{ display: 'flex', fontSize: 46, marginTop: 24, color: 'rgba(255,255,255,.85)' }}>{env.t('recap.introSub')}</div>
      </div>
    </Frame>
  )
}

function Numbers({ env }: { env: SlideEnv }) {
  const d = env.data
  const rows: { value: number; label: string; prev?: number }[] = [
    { value: d.anglers, label: env.t('recap.anglers', { count: d.anglers }), prev: d.prev.anglers },
    { value: d.captures, label: env.t('recap.captures', { count: d.captures }), prev: d.prev.captures },
  ]
  if (d.newPlayers > 0) rows.push({ value: d.newPlayers, label: env.t('recap.newPlayers', { count: d.newPlayers }) })
  return (
    <Frame id="numbers" env={env}>
      <Title env={env}>{env.t('recap.numbersTitle')}</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 70, marginTop: 'auto', marginBottom: 'auto' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 30 }}>
              <span style={{ fontFamily: env.fonts.display, fontSize: 230, lineHeight: 0.9, color: YELLOW }}>{count(r.value, env.anim)}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 54, fontWeight: 800 }}>{r.label}</div>
            {r.prev !== undefined && <Delta env={env} now={r.value} prev={r.prev} />}
          </div>
        ))}
      </div>
    </Frame>
  )
}

function Species({ env }: { env: SlideEnv }) {
  const d = env.data
  return (
    <Frame id="species" env={env}>
      <Title env={env}>{env.t('recap.speciesTitle')}</Title>
      <div style={{ display: 'flex', fontSize: 44, marginTop: 18, color: 'rgba(255,255,255,.8)' }}>{env.t('recap.speciesSub')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 54, marginTop: 'auto', marginBottom: 'auto' }}>
        {d.topSpecies.map((s, i) => {
          const src = s.photoUrl ? env.img(s.photoUrl, 440, 440) : null
          const shown = env.anim >= i * 0.22
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 36, opacity: shown ? 1 : 0 }}>
              <span style={{ display: 'flex', width: 90, fontFamily: env.fonts.display, fontSize: 150, color: YELLOW }}>{i + 1}</span>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- shared markup for the image renderer
                <img src={src} width={220} height={220} style={{ width: 220, height: 220, borderRadius: 28, objectFit: 'cover' }} alt="" />
              ) : (
                <div style={{ width: 220, height: 220, borderRadius: 28, background: 'rgba(255,255,255,.2)', display: 'flex' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>{s.name}</span>
                <span style={{ fontSize: 42, color: 'rgba(255,255,255,.75)', marginTop: 8 }}>{env.t('recap.speciesCount', { count: s.count })}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

function Trophy({ env }: { env: SlideEnv }) {
  const tr = env.data.trophy!
  const src = env.img(tr.photoUrl, SLIDE_W, SLIDE_H)
  const size = [tr.lengthCm ? `${tr.lengthCm} ${env.lang === 'en' ? 'cm' : env.lang === 'ka' ? 'სმ' : 'см'}` : null, tr.weightKg ? `${new Intl.NumberFormat(env.lang, { maximumFractionDigits: 1 }).format(tr.weightKg)} ${env.lang === 'en' ? 'kg' : env.lang === 'ka' ? 'კგ' : 'кг'}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <Frame
      id="trophy"
      env={env}
      photo={
        <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: SLIDE_H, display: 'flex' }}>
          {src && (
            // eslint-disable-next-line @next/next/no-img-element -- shared markup for the image renderer
            <img src={src} width={SLIDE_W} height={SLIDE_H} style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: SLIDE_H, objectFit: 'cover' }} alt="" />
          )}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 640, display: 'flex', background: 'linear-gradient(rgba(10,6,40,.92), rgba(10,6,40,.55) 55%, rgba(10,6,40,0))' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1100, display: 'flex', background: 'linear-gradient(rgba(10,6,40,0), rgba(10,6,40,.6) 40%, rgba(10,6,40,.95))' }} />
        </div>
      }
    >
      <Title env={env}>{env.t('recap.trophyTitle')}</Title>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
        <div style={{ display: 'flex', fontFamily: env.fonts.display, fontSize: 150, lineHeight: 0.95, textTransform: 'uppercase' }}>{tr.species}</div>
        {size && <div style={{ display: 'flex', fontFamily: env.fonts.display, fontSize: 110, color: YELLOW, marginTop: 12 }}>{size}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 40 }}>
          <Avatar env={env} url={tr.avatarUrl} name={tr.name} size={104} ring={YELLOW} />
          <span style={{ fontSize: 46, fontWeight: 800 }}>{env.t('recap.trophyBy', { name: tr.name ?? '—', sector: tr.territoryId })}</span>
        </div>
      </div>
    </Frame>
  )
}

function Angler({ env }: { env: SlideEnv }) {
  const a = env.data.angler!
  return (
    <Frame id="angler" env={env}>
      <Title env={env}>{env.t('recap.anglerTitle')}</Title>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
        <Avatar env={env} url={a.avatarUrl} name={a.name} size={440} ring={YELLOW} />
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, marginTop: 44 }}>{a.name ?? '—'}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 20 }}>
          <span style={{ fontFamily: env.fonts.display, fontSize: 230, lineHeight: 0.9, color: YELLOW }}>{count(a.catches, env.anim)}</span>
          <span style={{ fontSize: 52, fontWeight: 800 }}>{env.t('recap.anglerCatches', { count: a.catches })}</span>
        </div>
        {a.captures > 0 && <div style={{ display: 'flex', fontSize: 46, marginTop: 14, color: 'rgba(255,255,255,.85)' }}>{env.t('recap.anglerCaptures', { count: a.captures })}</div>}
      </div>
    </Frame>
  )
}

// Flat-top hex (corners left and right, like the map's sectors) as SVG points.
function hexPoints(cx: number, cy: number, w: number): string {
  const h = (w * Math.sqrt(3)) / 2
  return [
    [cx - w / 4, cy - h / 2],
    [cx + w / 4, cy - h / 2],
    [cx + w / 2, cy],
    [cx + w / 4, cy + h / 2],
    [cx - w / 4, cy + h / 2],
    [cx - w / 2, cy],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
}

// Sized so the whole honeycomb — centre plus a neighbour on each side —
// fits the slide's 912 px of content width with room for the strokes.
const HEX_W = 330
const HEX_H = (HEX_W * Math.sqrt(3)) / 2
const COMB_W = Math.round(HEX_W * 2.5 + 24)
const COMB_H = Math.round(HEX_H * 3 + 24)

function Sector({ env }: { env: SlideEnv }) {
  const s = env.data.sector!
  const c = env.data.contested
  const cx = COMB_W / 2
  const cy = COMB_H / 2
  // The six neighbours, as on the map: left and right ones half a row up and down.
  const around = [
    [cx, cy - HEX_H],
    [cx, cy + HEX_H],
    [cx - HEX_W * 0.75, cy - HEX_H / 2],
    [cx - HEX_W * 0.75, cy + HEX_H / 2],
    [cx + HEX_W * 0.75, cy - HEX_H / 2],
    [cx + HEX_W * 0.75, cy + HEX_H / 2],
  ]
  const kind = s.kind && ['sea', 'river', 'lake', 'pond'].includes(s.kind) ? env.t(`recap.kinds.${s.kind}` as TKey) : null
  return (
    <Frame id="sector" env={env}>
      <Title env={env}>{env.t('recap.sectorTitle')}</Title>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
        <div style={{ display: 'flex', position: 'relative', width: COMB_W, height: COMB_H, alignItems: 'center', justifyContent: 'center' }}>
          <svg width={COMB_W} height={COMB_H} viewBox={`0 0 ${COMB_W} ${COMB_H}`} style={{ position: 'absolute', top: 0, left: 0 }}>
            {around.map(([x, y], i) => (
              <polygon key={i} points={hexPoints(x, y, HEX_W - 16)} fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.4)" strokeWidth={4} strokeLinejoin="round" />
            ))}
            {/* Same size and the same stroke as its neighbours, so every gap in
                the honeycomb is equal — one grid, like the map. */}
            <polygon points={hexPoints(cx, cy, HEX_W - 16)} fill={YELLOW} stroke="#FFFFFF" strokeWidth={4} strokeLinejoin="round" />
          </svg>
          {/* Positioned so it paints above the absolutely placed honeycomb. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <span style={{ fontFamily: env.fonts.display, fontSize: 80, lineHeight: 1, color: '#6A00C8' }}>{s.territoryId}</span>
            {kind && <span style={{ fontSize: 32, fontWeight: 800, color: 'rgba(106,0,200,.7)', marginTop: 6 }}>{kind}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, marginTop: 40 }}>{env.t('recap.sectorCatches', { count: count(s.catches, env.anim) })}</div>
        {c && (
          <div style={{ display: 'flex', marginTop: 34, padding: '22px 36px', borderRadius: 36, background: 'rgba(255,255,255,.18)', fontSize: 42, fontWeight: 800, textAlign: 'center' }}>
            {env.t('recap.contested', { id: c.territoryId, count: c.changes })}
          </div>
        )}
      </div>
    </Frame>
  )
}

function Time({ env }: { env: SlideEnv }) {
  const d = env.data
  const win = busiestWindow(d.hours)
  const peak = Math.max(1, ...d.hours)
  const inWin = (h: number) => !!win && ((h - win.from + 24) % 24) < 3
  const bestDay = d.weekdays.indexOf(Math.max(...d.weekdays))
  // 2026-09-28 was a Monday: index 0 → Monday.
  const dayName = new Intl.DateTimeFormat(env.lang, { weekday: 'long' }).format(new Date(Date.UTC(2026, 8, 28 + bestDay, 12)))
  return (
    <Frame id="time" env={env}>
      <Title env={env}>{env.t('recap.timeTitle')}</Title>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto' }}>
        <div style={{ display: 'flex', fontSize: 50, fontWeight: 800 }}>{env.t('recap.timeSub')}</div>
        {win && (
          // Three pieces in one row: the image renderer would break the line at the dash.
          <div style={{ display: 'flex', fontFamily: env.fonts.display, fontSize: 170, lineHeight: 1, color: '#FFF2A8', marginTop: 16 }}>
            <span>{hh(win.from)}</span>
            <span style={{ margin: '0 12px' }}>–</span>
            <span>{hh(win.to)}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 420, marginTop: 70 }}>
          {d.hours.map((n, h) => (
            <div
              key={h}
              style={{
                display: 'flex',
                flex: 1,
                height: Math.max(10, Math.round((n / peak) * 400 * ease(env.anim))),
                borderRadius: 10,
                background: inWin(h) ? '#FFF2A8' : 'rgba(255,255,255,.4)',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 34, color: 'rgba(255,255,255,.8)' }}>
          <span>0</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, marginTop: 70 }}>{env.t('recap.timeDay', { day: dayName })}</div>
      </div>
    </Frame>
  )
}

function You({ env }: { env: SlideEnv }) {
  const me = env.data.me
  const active = !!me && me.catches > 0
  return (
    <Frame id="you" env={env}>
      <Title env={env}>{env.t('recap.youTitle')}</Title>
      {active ? (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <Avatar env={env} url={me!.avatarUrl} name={me!.name} size={150} ring={YELLOW} />
            <span style={{ fontSize: 62, fontWeight: 800 }}>{me!.name ?? ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 26, marginTop: 50 }}>
            <span style={{ fontFamily: env.fonts.display, fontSize: 300, lineHeight: 0.9, color: YELLOW }}>{count(me!.catches, env.anim)}</span>
            <span style={{ fontSize: 72, fontWeight: 800 }}>{env.t('recap.youCatches', { count: me!.catches })}</span>
          </div>
          {me!.place && (
            <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, padding: '14px 32px', borderRadius: 40, background: YELLOW, color: '#0B5B37', fontSize: 50, fontWeight: 800 }}>
              {env.t('recap.youPlace', { place: me!.place })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 20, marginTop: 30, fontSize: 46, fontWeight: 800, color: 'rgba(255,255,255,.9)' }}>
            <span>{env.t('recap.youCaptures', { count: me!.captures })}</span>
            <span>·</span>
            <span>{env.t('recap.youSpecies', { count: me!.species })}</span>
          </div>
          {me!.best?.species && <div style={{ display: 'flex', fontSize: 44, marginTop: 30, color: 'rgba(255,255,255,.85)' }}>{env.t('recap.youBest', { catch: me!.best.species + (me!.best.lengthCm ? ` ${me!.best.lengthCm} ${env.lang === 'en' ? 'cm' : env.lang === 'ka' ? 'სმ' : 'см'}` : '') })}</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto' }}>
          <div style={{ display: 'flex', fontFamily: env.fonts.display, fontSize: 300, lineHeight: 0.9, color: YELLOW }}>0</div>
          <div style={{ display: 'flex', fontSize: 78, fontWeight: 800, marginTop: 30, lineHeight: 1.1 }}>{env.t('recap.youEmpty')}</div>
          <div style={{ display: 'flex', fontSize: 48, marginTop: 24, color: 'rgba(255,255,255,.88)', lineHeight: 1.3 }}>{env.t('recap.youEmptySub')}</div>
        </div>
      )}
    </Frame>
  )
}

// The last slide sums the whole week up as one card of tiles — the slide
// people share most, so everything worth bragging about is on it.
const TILE_GAP = 24
const TILE_W = (912 - TILE_GAP) / 2

function Tile({ children, photo, bg, height, width = TILE_W, shown }: { children: ReactNode; photo?: string | null; bg?: string; height: number; width?: number; shown: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width,
        height,
        borderRadius: 36,
        overflow: 'hidden',
        background: bg ?? 'rgba(255,255,255,.16)',
        opacity: shown ? 1 : 0,
      }}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- shared markup for the image renderer
        <img src={photo} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, width, height, objectFit: 'cover' }} alt="" />
      )}
      {photo && <div style={{ position: 'absolute', top: 0, left: 0, width, height, display: 'flex', background: 'linear-gradient(rgba(20,6,30,.05), rgba(20,6,30,.8))' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', width, height, padding: 28 }}>{children}</div>
    </div>
  )
}

function Final({ env }: { env: SlideEnv }) {
  const d = env.data
  const top = d.topSpecies[0]
  const win = busiestWindow(d.hours)
  const me = d.me
  const shown = (i: number) => env.anim >= i * 0.1
  const label = (text: string) => <span style={{ fontSize: 30, fontWeight: 800, color: 'rgba(255,255,255,.85)' }}>{text}</span>
  const sizeOf = (cm: number | null, kg: number | null) =>
    cm ? `${cm} ${env.lang === 'en' ? 'cm' : env.lang === 'ka' ? 'სმ' : 'см'}` : kg ? `${new Intl.NumberFormat(env.lang, { maximumFractionDigits: 1 }).format(kg)} ${env.lang === 'en' ? 'kg' : env.lang === 'ka' ? 'კგ' : 'кг'}` : ''

  return (
    <Frame id="final" env={env}>
      <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{env.t('recap.finalTitle', { cityIn: env.t(`recap.cityIn.${env.city}` as TKey) })}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: TILE_GAP, marginTop: 44 }}>
        <Tile height={290} bg="rgba(255,225,77,.95)" shown={shown(0)}>
          <span style={{ fontFamily: env.fonts.display, fontSize: 150, lineHeight: 0.9, color: '#C2185B' }}>{count(d.catches, env.anim)}</span>
          <span style={{ fontSize: 40, fontWeight: 800, color: '#7A0E3A' }}>{env.t('recap.introBig', { count: d.catches })}</span>
        </Tile>
        <Tile height={290} shown={shown(1)}>
          <span style={{ fontFamily: env.fonts.display, fontSize: 150, lineHeight: 0.9, color: YELLOW }}>{count(d.anglers, env.anim)}</span>
          <span style={{ fontSize: 40, fontWeight: 800 }}>{env.t('recap.finalAnglers', { count: d.anglers })}</span>
        </Tile>
        {top && (
          <Tile height={300} photo={top.photoUrl ? env.img(top.photoUrl, 888, 600) : null} shown={shown(2)}>
            {label(env.t('recap.finalTop'))}
            <span style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.05 }}>{top.name}</span>
          </Tile>
        )}
        {d.trophy && (
          <Tile height={300} photo={env.img(d.trophy.photoUrl, 888, 600)} shown={shown(3)}>
            {label(env.t('recap.finalTrophy'))}
            <span style={{ fontFamily: env.fonts.display, fontSize: 84, lineHeight: 1, color: YELLOW }}>{sizeOf(d.trophy.lengthCm, d.trophy.weightKg)}</span>
            <span style={{ fontSize: 34, fontWeight: 800 }}>{d.trophy.species}</span>
          </Tile>
        )}
        {d.sector && (
          <Tile height={230} shown={shown(4)}>
            {label(env.t('recap.sectorTitle'))}
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 72, fontFamily: env.fonts.display, fontSize: 66, lineHeight: 1 }}>{d.sector.territoryId}</div>
          </Tile>
        )}
        {win && (
          <Tile height={230} shown={shown(5)}>
            {label(env.t('recap.timeTitle'))}
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 72, fontFamily: env.fonts.display, fontSize: 66, lineHeight: 1 }}>
              <span>{hh(win.from)}</span>
              <span style={{ margin: '0 6px' }}>–</span>
              <span>{hh(win.to)}</span>
            </div>
          </Tile>
        )}
        <Tile height={170} width={912} bg="rgba(0,0,0,.18)" shown={shown(6)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, height: 114 }}>
            {me && <Avatar env={env} url={me.avatarUrl} name={me.name} size={100} ring={YELLOW} />}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {label(env.t('recap.youTitle'))}
              <span style={{ fontSize: 48, fontWeight: 800 }}>
                {me && me.catches > 0
                  ? `${me.catches} ${env.t('recap.youCatches', { count: me.catches })}${me.place ? ` · ${env.t('recap.youPlace', { place: me.place })}` : ''}`
                  : env.t('recap.youEmpty')}
              </span>
            </div>
          </div>
        </Tile>
      </div>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, marginTop: 40, color: 'rgba(255,255,255,.92)', lineHeight: 1.3 }}>{env.t('recap.finalSub')}</div>
    </Frame>
  )
}

export function RecapSlide({ id, env }: { id: SlideId; env: SlideEnv }) {
  switch (id) {
    case 'intro':
      return <Intro env={env} />
    case 'numbers':
      return <Numbers env={env} />
    case 'species':
      return <Species env={env} />
    case 'trophy':
      return <Trophy env={env} />
    case 'angler':
      return <Angler env={env} />
    case 'sector':
      return <Sector env={env} />
    case 'time':
      return <Time env={env} />
    case 'you':
      return <You env={env} />
    case 'final':
      return <Final env={env} />
  }
}

// Every photo a slide draws, so the server can fetch them up front.
export function slideImages(id: SlideId, d: WeekRecap): { url: string; w: number; h: number }[] {
  switch (id) {
    case 'species':
      return d.topSpecies.filter((s) => s.photoUrl).map((s) => ({ url: s.photoUrl!, w: 440, h: 440 }))
    case 'trophy':
      return d.trophy
        ? [{ url: d.trophy.photoUrl, w: SLIDE_W, h: SLIDE_H }, ...(d.trophy.avatarUrl ? [{ url: d.trophy.avatarUrl, w: 208, h: 208 }] : [])]
        : []
    case 'angler':
      return d.angler?.avatarUrl ? [{ url: d.angler.avatarUrl, w: 880, h: 880 }] : []
    case 'you':
      return d.me?.avatarUrl ? [{ url: d.me.avatarUrl, w: 300, h: 300 }] : []
    case 'final':
      return [
        ...(d.topSpecies[0]?.photoUrl ? [{ url: d.topSpecies[0].photoUrl, w: 888, h: 600 }] : []),
        ...(d.trophy ? [{ url: d.trophy.photoUrl, w: 888, h: 600 }] : []),
        ...(d.me?.avatarUrl ? [{ url: d.me.avatarUrl, w: 200, h: 200 }] : []),
      ]
    default:
      return []
  }
}
