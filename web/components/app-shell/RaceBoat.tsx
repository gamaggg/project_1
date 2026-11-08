'use client'

import { memo, useId, useMemo, type ReactNode } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { BOAT_LOOKS } from '@/lib/clan2/rules'
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
//
// A clan can dress its boat from the clan shop (lib/clan2/rules.ts BOAT_LOOKS): not only other colours but its own
// details — the coral boat shells and a starfish, the night boat stars and lanterns, the golden one a crown and
// sparkles. The dragon is a hull of its own: one body whose bow rises into a neck and a head and whose stern curls up
// into a tail, with scales along the side.
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

// A head: the face, a full cap of hair over its top and the back, and the headband in the clan's second colour.
function Head({ cx, cy, r, band, fine }: { cx: number; cy: number; r: number; band: string; fine: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={SKIN} />
      <path d={`M${cx - r} ${cy + r * 0.15}A${r} ${r} 0 0 1 ${cx + r} ${cy - r * 0.05}Q${cx + r * 0.2} ${cy - r * 0.55} ${cx - r * 0.35} ${cy - r * 0.25}Q${cx - r * 0.85} ${cy + r * 0.05} ${cx - r} ${cy + r * 0.85}Z`} fill={HAIR} />
      {fine && <circle cx={cx + r * 0.45} cy={cy + r * 0.05} r={r * 0.16} fill="#3A2A20" />}
      <path d={`M${cx - r * 0.98} ${cy - r * 0.28}Q${cx} ${cy - r * 0.62} ${cx + r * 0.98} ${cy - r * 0.32}`} fill="none" stroke={band} strokeWidth={r * 0.42} strokeLinecap="round" />
    </g>
  )
}

// The ornaments along the side, by the boat's look.
function ornament(skin: string | null, x: number, y: number, light: string, key: number): ReactNode {
  if (skin === 'boat_coral')
    // a scallop shell
    return <path key={key} d={`M${x - 2.6} ${y + 1.4}Q${x - 2.8} ${y - 2.6} ${x} ${y - 2.8}Q${x + 2.8} ${y - 2.6} ${x + 2.6} ${y + 1.4}Q${x} ${y + 2.6} ${x - 2.6} ${y + 1.4}ZM${x} ${y - 2.6}V${y + 2}M${x - 1.5} ${y - 2}L${x - 0.8} ${y + 2}M${x + 1.5} ${y - 2}L${x + 0.8} ${y + 2}`} fill="#FFE1D2" stroke="#E0573A" strokeWidth=".55" strokeLinejoin="round" />
  if (skin === 'boat_night')
    // a four-pointed star
    return <path key={key} d={`M${x} ${y - 2.6}L${x + 0.7} ${y - 0.7}L${x + 2.6} ${y}L${x + 0.7} ${y + 0.7}L${x} ${y + 2.6}L${x - 0.7} ${y + 0.7}L${x - 2.6} ${y}L${x - 0.7} ${y - 0.7}Z`} fill="#FFD66B" />
  if (skin === 'boat_gold')
    // a cut gem
    return <path key={key} d={`M${x} ${y - 2.4}L${x + 2.2} ${y}L${x} ${y + 2.4}L${x - 2.2} ${y}Z`} fill="#FFF6CF" stroke="#A8721A" strokeWidth=".5" />
  if (skin === 'boat_dragon')
    // two rows of scales
    return (
      <g key={key} fill="none" stroke={light} strokeWidth=".8" opacity=".9">
        <path d={`M${x - 4} ${y - 1}q2 2.4 4 0q2 2.4 4 0`} />
        <path d={`M${x - 2} ${y + 1.6}q2 2.4 4 0`} />
      </g>
    )
  return <circle key={key} cx={x} cy={y} r="1.3" fill={light} />
}

// A point on a quadratic curve, to set spines along the dragon's neck and tail.
const qp = (a: number[], c: number[], b: number[], t: number) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]

// The dragon's body, stern to bow: the tail curling up out of the stern, the gunwale, the neck rising out of the bow,
// the head with its open jaws, the throat and the chest running down into the stem, the keel.
function dragonHull(L: number): string {
  return (
    `M18 ${T}L${L - 24} ${T}` +
    `Q${L - 9} ${T} ${L - 7.5} ${T - 10}Q${L - 7} ${T - 19} ${L - 4.5} ${T - 24}` +
    `Q${L - 5} ${T - 28.5} ${L + 1} ${T - 29}Q${L + 7} ${T - 29} ${L + 13.5} ${T - 25.8}L${L + 13.8} ${T - 23.6}` +
    `L${L + 7.5} ${T - 22.6}L${L + 12.5} ${T - 20.4}Q${L + 7} ${T - 18} ${L + 3.5} ${T - 17.5}` +
    `Q${L + 4.5} ${T - 7} ${L + 1.5} ${T + 1}Q${L - 1} ${BASE - 2} ${L - 12} ${BASE}L14 ${BASE}` +
    `Q-1 ${BASE - 2} -2.5 ${T - 5}Q-4.5 ${T - 15} -0.5 ${T - 22}L6.5 ${T - 27.5}L3 ${T - 20.6}Q2.2 ${T - 19} 2 ${T - 17}Q3 ${T - 1} 18 ${T}Z`
  )
}

function DragonDetails({ L, hull, hl, hd, crest }: { L: number; hull: string; hl: string; hd: string; crest: string }) {
  // spines: along the back of the neck (pointing back) and the top of the tail (pointing out)
  const neck = [0.85, 0.15, 0.5].map((t, n) => (n === 0 ? qp([L - 24, T], [L - 9, T], [L - 7.5, T - 10], t) : qp([L - 7.5, T - 10], [L - 7, T - 19], [L - 4.5, T - 24], t)))
  const tail = [0.25, 0.55, 0.85].map((t) => qp([-2.5, T - 5], [-4.5, T - 15], [-0.5, T - 22], t))
  return (
    <g strokeLinejoin="round">
      {neck.map(([x, y], n) => (
        <path key={`n${n}`} d={`M${x + 0.5} ${y - 1.9}L${x - 3.6} ${y + 0.2}L${x + 0.3} ${y + 1.9}Z`} fill={crest} stroke={hd} strokeWidth=".45" />
      ))}
      {tail.map(([x, y], n) => (
        <path key={`t${n}`} d={`M${x + 0.4} ${y - 1.7}L${x - 3.2} ${y - 1.2}L${x + 0.5} ${y + 1.7}Z`} fill={crest} stroke={hd} strokeWidth=".45" />
      ))}
      {/* the chest: a lighter band of belly plates down the front of the neck */}
      <path d={`M${L + 1.8} ${T - 16.6}Q${L + 2.6} ${T - 7} ${L - 0.2} ${T + 0.4}`} fill="none" stroke={hl} strokeWidth="2.6" strokeLinecap="round" opacity=".75" />
      {[-13, -9, -5].map((y) => (
        <path key={y} d={`M${L + 0.6} ${T + y}h2.6`} stroke={hd} strokeWidth=".45" opacity=".6" />
      ))}
      {/* scales on the neck */}
      <g fill="none" stroke={hl} strokeWidth=".7" opacity=".85">
        {[
          [L - 3.4, T - 6],
          [L - 1.2, T - 11],
          [L - 3.8, T - 15],
          [L - 1.4, T - 20],
        ].map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x - 1.8} ${y}q1.8 2 3.6 0`} />
        ))}
      </g>
      {/* the horn sweeping back, a frowning brow over a narrow eye with a slit pupil, the nostril, the teeth */}
      <path d={`M${L - 1.6} ${T - 27.8}Q${L - 7} ${T - 33} ${L - 11.8} ${T - 31.6}Q${L - 7} ${T - 30} ${L - 3.8} ${T - 25.4}Z`} fill={crest} stroke={hd} strokeWidth=".5" />
      <path d={`M${L + 1.6} ${T - 26.5}L${L + 5.8} ${T - 25.3}Q${L + 4.6} ${T - 23.7} ${L + 2.6} ${T - 24.4}Z`} fill="#FFD23F" stroke={hd} strokeWidth=".45" strokeLinejoin="round" />
      <ellipse cx={L + 3.9} cy={T - 24.9} rx=".42" ry=".95" fill="#1B1B1B" />
      <path d={`M${L + 0.6} ${T - 28.4}L${L + 6.8} ${T - 26}L${L + 6.2} ${T - 25}L${L + 0.9} ${T - 26.9}Z`} fill={hd} strokeLinejoin="round" />
      <circle cx={L + 12} cy={T - 25.1} r=".45" fill={hd} />
      <path d={`M${L + 12.6} ${T - 23.5}l.5 1.3l.7 -1.4zM${L + 10.2} ${T - 23.1}l.5 1.2l.7 -1.3zM${L + 11.4} ${T - 20.8}l.2 -1.3l.9 1z`} fill="#fff" />
      <path d={`M${L + 1} ${T - 28.6}Q${L + 7} ${T - 28.6} ${L + 13.2} ${T - 25.7}`} fill="none" stroke={hull} strokeWidth=".8" opacity=".9" />
    </g>
  )
}

function boatParts(uid: string, primary: string, secondary: string, crew: number, fine: boolean, skin: string | null): ReactNode {
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
        <Head cx={cx} cy={cy} r={r} band={stripe} fine={fine} />
        {fine && (
          <>
            <line x1={x + 2} y1={T - 6} x2={x + 7.5} y2={T - 7.5} stroke={SKIN_FAR} strokeWidth="2.4" strokeLinecap="round" />
            <line x1={x + 2} y1={T - 6} x2={x + 7.5} y2={T - 7.5} stroke={SKIN} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </g>,
    )
    // The paddle: a shaft and a flat blade dipping into the water (drawn under the waterline, so its tip is submerged).
    const bx = x - 3.2
    const by = T + 9.5
    paddles.push(
      <g key={i}>
        <line x1={x + 8} y1={T - 13} x2={bx} y2={by} stroke={WOOD} strokeWidth="1.5" strokeLinecap="round" />
        <path d={`M${bx + 1.6} ${by - 3.6}L${bx - 1.2} ${by + 2.6}Q${bx - 1.6} ${by + 4} ${bx - 0.2} ${by + 3.6}L${bx + 2.4} ${by - 2.6}Z`} fill={stripe} stroke={hd} strokeWidth=".5" strokeLinejoin="round" />
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
      <Head cx={dx} cy={T - 17.5} r={3.7} band={stripe} fine={fine} />
    </g>
  )

  const dragon = skin === 'boat_dragon'
  const hp = dragon ? dragonHull(L) : `M0 ${T - 12}Q5 ${T + 1} 18 ${T}L${L - 20} ${T}Q${L - 6} ${T} ${L} ${T - 17}Q${L + 1} ${T + 4} ${L - 12} ${BASE}L14 ${BASE}Q3 ${BASE - 1} 0 ${T - 12}Z`
  // the gilded gunwale: for the dragon it runs up the inside of the tail and the back of the neck
  const rim = dragon ? `M2.2 ${T - 16}Q3 ${T - 1} 18 ${T}L${L - 24} ${T}Q${L - 9} ${T} ${L - 7.5} ${T - 10}` : `M1 ${T - 11}Q5 ${T + 1} 18 ${T}L${L - 20} ${T}Q${L - 6} ${T} ${L} ${T - 17}`
  const k = Math.max(1, Math.floor((L - 26) / 8))
  const wave = `M10 ${WL}q4 -2.2 8 0${'t8 0'.repeat(k - 1)}`
  // The band along the side: two thin lines in the second colour and the look's ornaments between them.
  const bandEnd = L - 30
  const marks: ReactNode[] = []
  for (let x = 24, n = 0; x < bandEnd - 4; x += skin === 'boat_dragon' ? 9 : 12, n++) marks.push(ornament(skin, x, T + 6.6, hl, n))
  const accent = skin === 'boat_night' ? '#FFD66B' : skin === 'boat_gold' ? '#FFF3C0' : stripe

  return (
    <>
      <defs>
        {dragon ? (
          // the body runs from the head down to the keel: the same light-to-dark, over the whole height
          <linearGradient id={`${uid}h`} gradientUnits="userSpaceOnUse" x1="0" y1={T - 30} x2="0" y2={BASE}>
            <stop offset="0" stopColor={hl} />
            <stop offset=".55" stopColor={hull} />
            <stop offset="1" stopColor={hd} />
          </linearGradient>
        ) : (
          <linearGradient id={`${uid}h`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hl} />
            <stop offset=".4" stopColor={hull} />
            <stop offset="1" stopColor={hd} />
          </linearGradient>
        )}
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB547" />
          <stop offset="1" stopColor="#E0731B" />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <path d={hp} />
        </clipPath>
        <radialGradient id={`${uid}l`}>
          <stop offset="0" stopColor="#FFE9A0" stopOpacity=".95" />
          <stop offset="1" stopColor="#FFE9A0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the soft reflection, and the wake: thin streaks behind the stern */}
      <g transform={`translate(0 ${WL * 1.55}) scale(1 -0.55)`}>
        <path d={hp} fill={hull} fillOpacity=".16" />
      </g>
      <path d={`M-3 ${WL + 0.5}q-9 -1.6 -20 -0.4`} fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
      <path d={`M-14 ${WL + 2.4}q-12 -1.2 -26 0`} fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".3" />
      <g className="rb-lean" style={origin}>
        {bodies}
      </g>
      {leader}
      <path d={hp} fill={`url(#${uid}h)`} />
      <path d={`M16 ${T + 3.2}H${bandEnd}`} stroke={accent} strokeWidth="1.4" opacity=".9" />
      <path d={`M16 ${T + 10}H${bandEnd}`} stroke={accent} strokeWidth="1.1" opacity=".75" />
      {marks}
      <path d={rim} fill="none" stroke="#C99557" strokeWidth="2.6" strokeLinecap="round" />
      <path d={rim} fill="none" stroke="#F3D8A6" strokeWidth=".9" transform="translate(0 -0.9)" opacity=".85" strokeLinecap="round" />
      {dragon && <path d={hp} fill="none" stroke={hd} strokeWidth=".7" strokeLinejoin="round" opacity=".7" />}
      {!dragon && <circle cx="0" cy={T - 12} r="2.7" fill={GOLD} stroke="#9B6C1B" strokeWidth=".7" />}
      {/* the bow: a gold knob, or the look's own — a starfish, a crown, the dragon's head (part of its body) */}
      {skin === 'boat_coral' ? (
        <path d={`M${L} ${T - 23}L${L + 1.4} ${T - 19.4}L${L + 5} ${T - 19.2}L${L + 2.2} ${T - 16.8}L${L + 3.2} ${T - 13.2}L${L} ${T - 15.2}L${L - 3.2} ${T - 13.2}L${L - 2.2} ${T - 16.8}L${L - 5} ${T - 19.2}L${L - 1.4} ${T - 19.4}Z`} fill="#FF9A6B" stroke="#C2410C" strokeWidth=".6" strokeLinejoin="round" />
      ) : skin === 'boat_gold' ? (
        <g>
          <circle cx={L} cy={T - 17} r="3.1" fill={GOLD} stroke="#9B6C1B" strokeWidth=".7" />
          {/* the crown sits on the knob: its band overlaps the knob's top, three points with pearls, a red jewel */}
          <path d={`M${L - 4.2} ${T - 20.6}L${L - 5} ${T - 26}L${L - 2.2} ${T - 23.4}L${L} ${T - 27.4}L${L + 2.2} ${T - 23.4}L${L + 5} ${T - 26}L${L + 4.2} ${T - 20.6}Z`} fill="#FFD25A" stroke="#9B6C1B" strokeWidth=".6" strokeLinejoin="round" />
          <rect x={L - 4.6} y={T - 21.8} width="9.2" height="2.4" rx=".8" fill={GOLD} stroke="#9B6C1B" strokeWidth=".6" />
          {[
            [L - 5, T - 26],
            [L, T - 27.4],
            [L + 5, T - 26],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r=".95" fill="#FFF3C4" stroke="#9B6C1B" strokeWidth=".45" />
          ))}
          <circle cx={L} cy={T - 20.6} r=".85" fill="#E24B4A" stroke="#8E2A22" strokeWidth=".35" />
        </g>
      ) : dragon ? (
        <DragonDetails L={L} hull={hull} hl={hl} hd={hd} crest={stripe} />
      ) : (
        <circle cx={L} cy={T - 17} r="3.1" fill={GOLD} stroke="#9B6C1B" strokeWidth=".7" />
      )}
      {/* the night boat's lanterns at bow and stern, glowing: each pole stands straight up from the top of its gold knob */}
      {skin === 'boat_night' &&
        [
          [L, T - 17 - 3.1],
          [0, T - 12 - 2.7],
        ].map(([x, y], n) => (
          <g key={n}>
            <line x1={x} y1={y} x2={x} y2={y - 8} stroke="#5B4A2E" strokeWidth="1" strokeLinecap="round" />
            <circle className="rb-lamp" cx={x} cy={y - 10} r="6" fill={`url(#${uid}l)`} style={{ animationDelay: `${n * -0.9}s` }} />
            <rect x={x - 1.8} y={y - 12.4} width="3.6" height="4.6" rx="1" fill="#FFD66B" stroke="#5B4A2E" strokeWidth=".6" />
          </g>
        ))}
      {/* the paddles' blades dip under the waterline */}
      <g className="rb-pad" style={origin}>
        {paddles}
      </g>
      {/* the water over the hull's lower part: cut to the hull, so it tints what is under water and nothing else */}
      <g clipPath={`url(#${uid}c)`}>
        <path d={`${wave}V${BASE + 3}H10Z`} fill="#12607F" opacity=".5" />
        <path d={wave} fill="none" stroke="#fff" strokeWidth="1" opacity=".55" />
      </g>
      {/* the bow wave: two thin curls of foam, not blobs */}
      <g transform={dragon ? 'translate(3.5 0)' : undefined}>
        <path d={`M${L - 3} ${WL - 0.5}q5 -2 9 -7`} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".85" />
        <path d={`M${L - 1} ${WL + 1}q7 -0.6 13 -3.4`} fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".6" />
      </g>
      {/* the golden boat sparkles */}
      {skin === 'boat_gold' &&
        [
          [L * 0.3, T - 22],
          [L * 0.62, T - 25],
          [L * 0.85, T - 6],
        ].map(([x, y], n) => (
          <path key={n} className="rb-twinkle" style={{ animationDelay: `${n * -0.7}s`, transformOrigin: `${x}px ${y}px` }} d={`M${x} ${y - 3}L${x + 0.8} ${y - 0.8}L${x + 3} ${y}L${x + 0.8} ${y + 0.8}L${x} ${y + 3}L${x - 0.8} ${y + 0.8}L${x - 3} ${y}L${x - 0.8} ${y - 0.8}Z`} fill="#FFF3C0" />
        ))}
    </>
  )
}

// `unit` is px per boat unit. The clan's crest and the roster size sit above
// the stern as a tag — the boat itself carries no flag. `skin`: the boat the clan
// bought in its shop (an id of BOAT_LOOKS); none — the clan's own colours.
export const RaceBoat = memo(function RaceBoat({ crest, crew, unit, skin = null }: { crest: unknown; crew: number; unit: number; skin?: string | null }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const c = resolveCrest(crest)
  const look = skin ? BOAT_LOOKS[skin] : undefined
  const primary = look?.primary ?? c.primary
  const secondary = look?.secondary ?? c.secondary
  const fine = unit >= 0.38
  const parts = useMemo(() => boatParts(uid, primary, secondary, crew, fine, look ? skin : null), [uid, primary, secondary, crew, fine, look, skin])
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
