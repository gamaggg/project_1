'use client'

import { memo, useId, useMemo, type ReactNode } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { resolveCrest, shadeHex } from '@/lib/data/clanCrests'
import { tn } from '@/lib/i18n/runtime'

// A Pacu Jalur boat — the long dugout racing canoes of Sumatra. The hull is
// as long as the crew: every rower has the same seat, so a clan of 24 has a
// boat eight times longer than a clan of three. One standing leader at the
// bow sets the rhythm (arms swing in time with the paddles), nobody at the
// stern. The bow points right, at the finish.
//
// Everything is drawn in boat units (BOAT_PITCH units per seat) and scaled by
// `unit` px per unit, so RaceRiver can give every boat of one river the same
// scale and the lengths stay comparable.
export const BOAT_PITCH = 13
export const BOAT_ENDS = 52
export const BOAT_HEIGHT = 54
const BASE = 44 // keel
const WL = BASE - 3 // waterline
const T = BASE - 14 // gunwale

export const boatUnits = (crew: number) => crew * BOAT_PITCH + BOAT_ENDS

// The crew is the roster: the finish is 200 m per player (at least three).
export function crewOf(finish: number): number {
  return Math.max(3, Math.min(60, Math.round(finish / 200)))
}

const SKIN = '#E8B98A'
const SKIN_FAR = '#C99A6B'
const HAIR = '#2A211C'
const WOOD = '#D9BE88'
const GOLD = '#EBBC4B'

function Arm({ x, sh, col, delay, far }: { x: number; sh: number; col: string; delay: number; far?: boolean }) {
  return (
    <g className={far ? 'rb-sw b' : 'rb-sw'} style={{ transformOrigin: `${x}px ${sh}px`, animationDelay: `-${delay}s` }}>
      <line x1={x} y1={sh} x2={x} y2={sh + 9.5} stroke={col} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={x} cy={sh + 10.2} r="1.8" fill={col} />
    </g>
  )
}

function boatParts(uid: string, primary: string, secondary: string, crew: number, fine: boolean): ReactNode {
  const L = boatUnits(crew)
  const hull = primary
  const hl = shadeHex(primary, 0.3)
  const hd = shadeHex(primary, -0.5)
  const jd = shadeHex(primary, -0.4)
  const j1 = shadeHex(primary, 0.35)
  const stripe = secondary
  const d = (crew % 5) * 0.2 // one phase for the whole boat: paddles, torsos and the leader move together
  const r = 4.2
  const tw = 6
  const origin = { transformOrigin: `0px ${T}px`, animationDelay: `-${d}s` }

  const bodies: ReactNode[] = []
  const paddles: ReactNode[] = []
  for (let i = 0; i < crew; i++) {
    const x = 18 + i * BOAT_PITCH + BOAT_PITCH / 2
    const jersey = i % 2 ? hull : j1
    const cx = x + 2.6
    const cy = T - 9 - r * 0.9
    bodies.push(
      <g key={i}>
        <line x1={x - 0.8} y1={T + 3} x2={x + 1.4} y2={T - 9} stroke={jd} strokeWidth={tw} strokeLinecap="round" />
        <line x1={x - 0.2} y1={T + 3} x2={x + 2.2} y2={T - 9} stroke={jersey} strokeWidth={tw * 0.68} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill={SKIN} />
        {fine && <path d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx} ${cy - r}L${cx} ${cy}Z`} fill={HAIR} />}
        <line x1={cx - r} y1={cy - r * 0.35} x2={cx + r} y2={cy - r * 0.35} stroke={stripe} strokeWidth="1.9" />
        {fine && (
          <>
            <line x1={x + 2} y1={T - 6} x2={x + 7.5} y2={T - 7.5} stroke={SKIN_FAR} strokeWidth="2.4" strokeLinecap="round" />
            <line x1={x + 2} y1={T - 6} x2={x + 7.5} y2={T - 7.5} stroke={SKIN} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </g>,
    )
    const bx = x - 3.5
    const by = T + 8
    paddles.push(
      <g key={i}>
        <line x1={x + 8} y1={T - 13} x2={bx} y2={by} stroke={WOOD} strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx={bx} cy={by} rx="4.6" ry="1.8" transform={`rotate(118.7 ${bx} ${by})`} fill={stripe} stroke={hd} strokeWidth=".6" />
        {fine && <circle cx={bx - 3} cy={by - 2} r="1.1" fill="#fff" opacity=".8" />}
      </g>,
    )
  }

  const dx = L - 17
  const sh = T - 12
  const leader = (
    <g className="rb-dn" style={{ animationDelay: `-${d}s` }}>
      <Arm x={dx - 1.5} sh={sh} col={SKIN_FAR} delay={d + 1.3} far />
      <line x1={dx - 1.6} y1={T - 1} x2={dx - 3.8} y2={T + 2.5} stroke="#E0731B" strokeWidth="3" strokeLinecap="round" />
      <line x1={dx + 1.6} y1={T - 1} x2={dx + 3.8} y2={T + 2.5} stroke="#E0731B" strokeWidth="3" strokeLinecap="round" />
      <path d={`M${dx - 3.4} ${T - 1}L${dx - 2.6} ${T - 13}L${dx + 2.6} ${T - 13}L${dx + 3.4} ${T - 1}Z`} fill={`url(#${uid}r)`} />
      <line x1={dx - 3} y1={T - 6.5} x2={dx + 3} y2={T - 6.5} stroke={hd} strokeWidth="1.2" />
      <Arm x={dx + 1.5} sh={sh} col={SKIN} delay={d} />
      <circle cx={dx} cy={T - 17.5} r="3.7" fill={SKIN} />
      <path d={`M${dx - 3.7} ${T - 17.5}A3.7 3.7 0 0 1 ${dx} ${T - 21.2}L${dx} ${T - 17.5}Z`} fill={HAIR} />
      <line x1={dx - 3.7} y1={T - 18.8} x2={dx + 3.7} y2={T - 18.8} stroke={stripe} strokeWidth="1.6" />
    </g>
  )

  const hp = `M0 ${T - 12}Q5 ${T + 1} 18 ${T}L${L - 20} ${T}Q${L - 6} ${T} ${L} ${T - 17}Q${L + 1} ${T + 4} ${L - 12} ${BASE}L14 ${BASE}Q3 ${BASE - 1} 0 ${T - 12}Z`
  const rim = `M1 ${T - 11}Q5 ${T + 1} 18 ${T}L${L - 20} ${T}Q${L - 6} ${T} ${L} ${T - 17}`
  const k = Math.max(1, Math.floor((L - 26) / 8))
  const wave = `M10 ${WL}q4 -2.2 8 0${'t8 0'.repeat(k - 1)}`

  return (
    <>
      <defs>
        <linearGradient id={`${uid}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hl} />
          <stop offset=".4" stopColor={hull} />
          <stop offset="1" stopColor={hd} />
        </linearGradient>
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB547" />
          <stop offset="1" stopColor="#E0731B" />
        </linearGradient>
        <pattern id={`${uid}t`} width="10" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 0H10L5 7Z" fill={stripe} />
        </pattern>
      </defs>
      {/* the reflection, the shadow and the wake behind the stern */}
      <g transform={`translate(0 ${WL * 1.55}) scale(1 -0.55)`}>
        <path d={hp} fill={hull} fillOpacity=".28" />
      </g>
      <ellipse cx={L / 2} cy={BASE + 3} rx={L / 2} ry="3.4" fill="#04293a" opacity=".4" />
      <ellipse cx="-6" cy={WL} rx="16" ry="2.8" fill="#fff" opacity=".35" />
      <ellipse cx="-26" cy={WL + 1} rx="20" ry="2" fill="#fff" opacity=".2" />
      <ellipse cx="-52" cy={WL + 1} rx="22" ry="1.6" fill="#fff" opacity=".12" />
      <g className="rb-lean" style={origin}>
        {bodies}
      </g>
      {leader}
      <path d={hp} fill={`url(#${uid}h)`} />
      <g transform={`translate(16 ${T + 3.5})`}>
        <rect width={Math.max(10, L - 62)} height="7" fill={`url(#${uid}t)`} opacity=".92" />
      </g>
      <path d={`M16 ${T + 11.5}H${L - 30}`} stroke={hd} strokeWidth=".9" opacity=".6" />
      <path d={`M20 ${T + 1.8}H${L - 30}`} stroke={hd} strokeWidth=".7" opacity=".35" />
      <path d={rim} fill="none" stroke="#C99557" strokeWidth="2.6" strokeLinecap="round" />
      <path d={rim} fill="none" stroke="#F3D8A6" strokeWidth=".9" transform="translate(0 -0.9)" opacity=".85" strokeLinecap="round" />
      <circle cx="0" cy={T - 12} r="2.7" fill={GOLD} stroke="#9B6C1B" strokeWidth=".7" />
      <circle cx={L} cy={T - 17} r="3.1" fill={GOLD} stroke="#9B6C1B" strokeWidth=".7" />
      {/* the waterline over the hull */}
      <path d={`${wave}V${BASE + 3}H10Z`} fill="#12607F" opacity=".6" />
      <path d={wave} fill="none" stroke="#fff" strokeWidth="1" opacity=".55" />
      <g className="rb-pad" style={origin}>
        {paddles}
      </g>
      {/* foam at the bow */}
      <ellipse cx={L - 4} cy={WL} rx="12" ry="3.4" fill="#fff" opacity=".78" />
      <ellipse cx={L + 6} cy={WL - 2.5} rx="6.5" ry="2.6" fill="#fff" opacity=".9" />
      <circle cx={L + 12} cy={WL - 8} r="1.5" fill="#fff" opacity=".85" />
      <circle cx={L + 17} cy={WL - 4} r="1.1" fill="#fff" opacity=".8" />
      <circle cx={L + 9} cy={WL - 12} r="1" fill="#fff" opacity=".7" />
    </>
  )
}

// `unit` is px per boat unit. The clan's crest and the roster size sit above
// the stern as a tag — the boat itself carries no flag.
export const RaceBoat = memo(function RaceBoat({ crest, crew, unit }: { crest: unknown; crew: number; unit: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const c = resolveCrest(crest)
  const fine = unit >= 0.38
  const parts = useMemo(() => boatParts(uid, c.primary, c.secondary, crew, fine), [uid, c.primary, c.secondary, crew, fine])
  const L = boatUnits(crew)
  return (
    <span className="race-boat" style={{ width: L * unit, height: BOAT_HEIGHT * unit }}>
      <svg viewBox={`0 0 ${L} ${BOAT_HEIGHT}`} width={L * unit} height={BOAT_HEIGHT * unit} aria-hidden>
        {parts}
      </svg>
      <span className="race-boat-tag">
        <ClanCrest crest={crest} size={15} />
        <span>{tn('race.warPlayers', { count: crew })}</span>
      </span>
    </span>
  )
})
