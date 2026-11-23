'use client'

import type { ReactNode } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { RaceBoat } from '@/components/app-shell/RaceBoat'
import { SkinPreview } from '@/components/app-shell/SkinPreview'
import type { GoalItem } from '@/lib/clan2/types'
import { crestShape, resolveCrest } from '@/lib/data/clanCrests'
import { frameGeometry } from '@/lib/data/crestGeometry'

// The things the clan shop sells, drawn the way the game shows them: a sector skin as a sector in the clan's colour,
// a boat as the clan battle's boat in the new colours, a frame round the clan's crest.


export { itemName } from '@/lib/clan2/itemName'

// A frame round the crest. Its inner edge always follows the crest's own outline (shield, round, hexagon, pennant…):
// a band of metal just outside the crest's edge with rivets set evenly along it. The bronze and the silver frames are
// that band (the silver with a second thin ring); the gold and the legendary ones change the outline itself — the gold
// is a laurel wreath closing round the crest with a crown on top, the legendary a pair of wings and a star over the
// crest. It is drawn round the crest, so the crest keeps its own size and place: `size` is the crest's
// box.
type FrameLook = { a: string; b: string; c: string; studs: string; double?: boolean; glow?: string; outline?: 'laurel' | 'wings' | 'rays' }
const FRAME_LOOK: Record<string, FrameLook> = {
  frame_bronze: { a: '#F6C995', b: '#B8743F', c: '#6E4020', studs: '#FFE3C2' },
  frame_silver: { a: '#FFFFFF', b: '#B7C0CC', c: '#5F6977', studs: '#FFFFFF', double: true },
  frame_gold: { a: '#FFF3B8', b: '#E0A63A', c: '#7F5205', studs: '#FFF7D6', outline: 'laurel' },
  frame_legend: { a: '#FFE7A0', b: '#E0447B', c: '#4E2475', studs: '#FFF3C0', glow: '#FFB547', outline: 'wings' },
  // Not sold: the clan gets it at level 10 (lib/clan2/rules.ts, `reward`).
  frame_champion: { a: '#FFF8D6', b: '#F4B63E', c: '#5A2E00', studs: '#FFF4CC', double: true, glow: '#FFC83D', outline: 'rays' },
}
// The band round a 100 x 100 crest: the crest's outline grown about its middle.
const BAND = 'translate(50 50) scale(1.15) translate(-50 -50)'
const OUTER = 'translate(50 50) scale(1.24) translate(-50 -50)'
// How far the frame reaches beyond the crest's box, above and below (a share of the box), so it never runs into
// what is under it.
export const frameRoom = (id: string | null | undefined) => (id && FRAME_LOOK[id]?.outline ? 0.3 : 0.2)
// How wide the frame is next to the crest's box (the wings spread out).
export const frameSpan = (id: string | null | undefined) => (id && FRAME_LOOK[id]?.outline === 'wings' ? 1.95 : id && FRAME_LOOK[id]?.outline === 'rays' ? 1.7 : id && FRAME_LOOK[id]?.outline ? 1.55 : 1.4)
// Rivets: 24 round dots of a dashed line over the band's whole length (pathLength makes the length 96 for any shape),
// so they stand evenly all the way round, the join included.
const RIVETS = 24

// The gold frame's wreath: one closed ring of laurel — two branches crossing at the bottom and running up both sides to
// the crown, which covers where they meet.
function Laurel({ fill, edge }: { fill: string; edge: string }) {
  const leaves: ReactNode[] = []
  const R = 69
  for (const side of [-1, 1]) {
    for (let k = 0; k < 21; k++) {
      // from the bottom all the way round to the crown, close enough to overlap into one wreath
      const deg = 91 + k * 8.2
      const a = (deg * Math.PI) / 180
      const x = 50 + side * -R * Math.cos(a)
      const y = 50 + R * Math.sin(a)
      // the branch's direction going up, and the leaf pointing along it, alternately out and in
      const tang = Math.atan2(Math.cos(a), side * Math.sin(a)) * (180 / Math.PI)
      const tilt = (k % 2 ? 30 : -30) * side
      leaves.push(<path key={`${side}${k}`} d="M 0 0 Q 7 -5.6 16 0 Q 7 5.6 0 0 Z" transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(tang + tilt).toFixed(1)})`} fill={fill} stroke={edge} strokeWidth={1} strokeLinejoin="round" />)
    }
  }
  const arc = (side: number) => {
    const p = (deg: number) => {
      const a = (deg * Math.PI) / 180
      return `${(50 + side * -R * Math.cos(a)).toFixed(2)} ${(50 + R * Math.sin(a)).toFixed(2)}`
    }
    return `M ${p(84)} A ${R} ${R} 0 0 ${side > 0 ? 0 : 1} ${p(266)}`
  }
  return (
    <g>
      <path d={`${arc(-1)} ${arc(1)}`} fill="none" stroke={edge} strokeWidth={3.6} strokeLinecap="round" />
      <path d={`${arc(-1)} ${arc(1)}`} fill="none" stroke={fill} strokeWidth={2} strokeLinecap="round" />
      {leaves}
    </g>
  )
}

function Crown({ fill, edge, gem }: { fill: string; edge: string; gem: string }) {
  return (
    <g strokeLinejoin="round">
      <path d="M 31 -3 L 29 -21 L 40 -12 L 50 -27 L 60 -12 L 71 -21 L 69 -3 Q 50 -7 31 -3 Z" fill={fill} stroke={edge} strokeWidth={1.4} />
      <path d="M 31.5 -6.5 Q 50 -10.5 68.5 -6.5" fill="none" stroke={edge} strokeWidth={1} opacity={0.7} />
      {[
        [29, -21],
        [50, -27],
        [71, -21],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={2.6} fill={gem} stroke={edge} strokeWidth={0.9} />
      ))}
      <circle cx={50} cy={-12} r={2.4} fill="#E0447B" stroke={edge} strokeWidth={0.8} />
    </g>
  )
}

// The legendary frame's wings: five feathers fanning out from each side of the crest, longest in the middle.
function Wings({ fill, edge, light }: { fill: string; edge: string; light: string }) {
  const feathers = [
    { deg: 192, len: 40 },
    { deg: 205, len: 50 },
    { deg: 219, len: 55 },
    { deg: 233, len: 48 },
    { deg: 247, len: 36 },
  ]
  return (
    <g strokeLinejoin="round">
      {[-1, 1].map((side) => (
        <g key={side} transform={side > 0 ? 'translate(100 0) scale(-1 1)' : undefined}>
          {feathers.map((f, n) => (
            <g key={n} transform={`translate(4 ${60 - n * 2.5}) rotate(${f.deg})`}>
              <path d={`M 0 -7 Q ${f.len * 0.55} -10.5 ${f.len} 0 Q ${f.len * 0.55} 9 0 7 Z`} fill={fill} stroke={edge} strokeWidth={1.2} />
              <path d={`M 4 0 H ${f.len - 6}`} stroke={light} strokeWidth={1} strokeLinecap="round" opacity={0.75} />
            </g>
          ))}
        </g>
      ))}
    </g>
  )
}

function Star({ fill, edge }: { fill: string; edge: string }) {
  const p = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 6 : 14
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(-15 + r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
  return <polygon points={p} fill={fill} stroke={edge} strokeWidth={1.4} strokeLinejoin="round" />
}

// The champion's frame (clan level 10): a sunburst of gold rays turning slowly behind the crest over a golden halo that
// breathes, a double band with pearl studs and sparks twinkling round it. The motion
// is CSS (.c2-frame_champion in globals.css) and stops for reduced motion.
function Rays({ fill, edge }: { fill: string; edge: string }) {
  const rays: ReactNode[] = []
  const N = 16
  for (let i = 0; i < N; i++) {
    const deg = (i * 360) / N
    const long = i % 2 === 0
    // A ray starts deep behind the crest (r 18) and widens to its shoulder (r 54) before narrowing to the tip, so on
    // any shape — a notch, a merlon, a wave — it comes out from under the frame, never from the air.
    const r1 = long ? 84 : 72
    const w = long ? 7 : 5
    rays.push(<path key={i} d={`M ${50 - w * 0.35} 32 L ${50 - w} -4 L 50 ${50 - r1} L ${50 + w} -4 L ${50 + w * 0.35} 32 Z`} transform={`rotate(${deg} 50 50)`} fill={fill} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" opacity={long ? 0.95 : 0.7} />)
  }
  return <g className="c2-frame-rays">{rays}</g>
}

// Studs for the champion's band: round pearls set by frameGeometry — one in every corner, the same gaps between.
function Studs({ points, fill, edge }: { points: { x: number; y: number }[]; fill: string; edge: string }) {
  return (
    <g>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={2.5} fill={fill} stroke={edge} strokeWidth={0.9} />
          <circle cx={p.x - 0.7} cy={p.y - 0.7} r={0.8} fill="#FFFFFF" opacity={0.9} />
        </g>
      ))}
    </g>
  )
}

// A four-pointed spark.
function Spark({ x, y, r, delay }: { x: number; y: number; r: number; delay: number }) {
  const k = r * 0.28
  return (
    <path
      className="c2-frame-spark"
      style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px` }}
      d={`M ${x} ${y - r} Q ${x + k} ${y - k} ${x + r} ${y} Q ${x + k} ${y + k} ${x} ${y + r} Q ${x - k} ${y + k} ${x - r} ${y} Q ${x - k} ${y - k} ${x} ${y - r} Z`}
      fill="#FFFFFF"
    />
  )
}

export function ClanFrame({ id, size, crest, children }: { id: string | null | undefined; size: number; crest: unknown; children: ReactNode }) {
  const look = id ? FRAME_LOOK[id] : null
  if (!look) return <>{children}</>
  const uid = `${id!.replace(/[^a-z]/g, '')}${size}`
  const d = crestShape(resolveCrest(crest).shape).d
  const metal = `url(#c2f-${uid})`
  // The champion's frame sets its studs by the crest's own outline.
  const geo = look.outline === 'rays' ? frameGeometry(d, 1.15, 12) : null
  return (
    // The same room above and below as the frame takes, so it never runs into the name under it.
    <span className={`c2-frame c2-${id}`} style={{ width: size, height: size, margin: `${Math.round(size * frameRoom(id))}px 0` }}>
      <svg className="c2-frame-art" viewBox="-20 -20 140 140" overflow="visible" aria-hidden="true">
        <defs>
          <linearGradient id={`c2f-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={look.a} />
            <stop offset=".45" stopColor={look.b} />
            <stop offset="1" stopColor={look.c} />
          </linearGradient>
          {look.outline === 'rays' && (
            <>
              <radialGradient id={`c2h-${uid}`} cx="50" cy="50" r="86" gradientUnits="userSpaceOnUse">
                <stop offset=".35" stopColor={look.glow} stopOpacity={0.6} />
                <stop offset=".6" stopColor={look.glow} stopOpacity={0.28} />
                <stop offset=".82" stopColor={look.b} stopOpacity={0.08} />
                <stop offset="1" stopColor={look.b} stopOpacity={0} />
              </radialGradient>
              {/* A wide region in the picture's own units, so the blur fades out instead of being cut off at an edge. */}
              <filter id={`c2b-${uid}`} filterUnits="userSpaceOnUse" x="-60" y="-60" width="220" height="220">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </>
          )}
        </defs>
        {look.outline === 'rays' && (
          <>
            <circle className="c2-frame-halo" cx={50} cy={50} r={86} fill={`url(#c2h-${uid})`} />
            {/* The rays' own light: a blurred golden copy under them, turning with them. */}
            <g filter={`url(#c2b-${uid})`} opacity={0.6}>
              <Rays fill={look.glow!} edge={look.glow!} />
            </g>
            <Rays fill={metal} edge={look.c} />
            <path className="c2-frame-glow" d={d} transform={BAND} fill="none" stroke={look.glow} strokeWidth={14} strokeLinejoin="round" filter={`url(#c2b-${uid})`} />
          </>
        )}
        {look.glow && look.outline !== 'rays' && <path className="c2-frame-glow" d={d} transform={BAND} fill="none" stroke={look.glow} strokeWidth={16} strokeLinejoin="round" opacity={0.35} />}
        {/* The outline of its own, behind the band: the wreath or the wings. */}
        {look.outline === 'laurel' && <Laurel fill={metal} edge={look.c} />}
        {look.outline === 'wings' && <Wings fill={metal} edge={look.c} light={look.a} />}
        {/* The dark edge, the metal band, its light inner edge — along the crest's outline. */}
        <path d={d} transform={BAND} fill="none" stroke={look.c} strokeWidth={11.5} strokeLinejoin="round" />
        <path d={d} transform={BAND} fill="none" stroke={metal} strokeWidth={9} strokeLinejoin="round" />
        <path d={d} transform={BAND} fill="none" stroke={look.a} strokeOpacity={0.55} strokeWidth={1.3} strokeLinejoin="round" />
        {look.double && <path d={d} transform={OUTER} fill="none" stroke={metal} strokeWidth={2.2} strokeLinejoin="round" opacity={0.9} />}
        {/* Rivets, evenly along the band. */}
        {geo ? (
          <Studs points={geo.studs} fill={look.studs} edge={look.c} />
        ) : (
          <>
            <path d={d} transform={BAND} pathLength={RIVETS * 4} fill="none" stroke={look.c} strokeWidth={5.2} strokeLinecap="round" strokeDasharray="0 4" />
            <path d={d} transform={BAND} pathLength={RIVETS * 4} fill="none" stroke={look.studs} strokeWidth={3.4} strokeLinecap="round" strokeDasharray="0 4" />
          </>
        )}
        {/* On top of the band: the gold crown, the legendary star. */}
        {look.outline === 'laurel' && <Crown fill={metal} edge={look.c} gem={look.studs} />}
        {look.outline === 'wings' && <Star fill={metal} edge={look.c} />}
        {look.outline === 'rays' && (
          <>
            <Spark x={-6} y={14} r={6} delay={0} />
            <Spark x={108} y={30} r={5} delay={0.7} />
            <Spark x={100} y={104} r={6.5} delay={1.4} />
            <Spark x={-2} y={92} r={4.5} delay={2.1} />
            <Spark x={84} y={-10} r={4} delay={1.05} />
          </>
        )}
      </svg>
      <span className="c2-frame-in">{children}</span>
    </span>
  )
}

export function BoatPreview({ id, crest, width = 132 }: { id: string; crest: unknown; width?: number }) {
  const crew = 5
  // boatUnits(5) = 117 boat units: the boat fills `width`.
  const unit = width / 117
  return (
    <span className="c2-boat-preview" style={{ width }}>
      <span className="c2-boat-water" aria-hidden="true" />
      <RaceBoat crest={crest} crew={crew} unit={unit} skin={id} />
    </span>
  )
}

// A crest with the clan's frame for lists (clan list, rating, podium): the frame and the crest fit in a `size` box
// (the frame may stick out a little at the sides), so a framed row is as tall as a plain one. No frame — the bare crest.
export function FramedCrest({ crest, frame, size, shine }: { crest: unknown; frame: string | null | undefined; size: number; shine?: boolean }) {
  if (!frame || !FRAME_LOOK[frame]) return <ClanCrest crest={crest} size={size} shine={shine} />
  const inner = Math.round(size / (frameSpan(frame) * 0.9))
  return (
    <span className="c2-framed-crest" style={{ width: size, height: size }}>
      <ClanFrame id={frame} size={inner} crest={crest}>
        <ClanCrest crest={crest} size={inner} shine={shine} />
      </ClanFrame>
    </span>
  )
}

// The item as a picture: `size` is the width of the picture.
export function ItemPreview({ item, crest, size = 76 }: { item: GoalItem; crest: unknown; size?: number }) {
  if (item.kind === 'clan_skin') return <SkinPreview skinId={item.id} color={resolveCrest(crest).primary} width={size} />
  if (item.kind === 'boat') return <BoatPreview id={item.id} crest={crest} width={Math.max(size, 96)} />
  return (
    <span className="c2-frame-preview" style={{ width: size, height: size }}>
      <ClanFrame id={item.id} size={Math.round(size / (frameSpan(item.id) + 0.05))} crest={crest}>
        <ClanCrest crest={crest} size={Math.round(size / (frameSpan(item.id) + 0.05))} />
      </ClanFrame>
    </span>
  )
}
