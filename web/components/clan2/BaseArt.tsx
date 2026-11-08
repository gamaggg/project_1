import type { ReactNode } from 'react'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'

// The pictures of the clan base: six buildings, each in three stages that look clearly different. Drawn in a light
// three-quarter view (redrawn 08.11.2026 — the flat boxes and triangles before looked cheap): a lit front, a shaded
// side going back to the right, roofs as two slopes, one dark outline for everything, and a shadow cast by the shape
// itself (no ovals). Every drawing stands on the ground line y = 0, is centred on x = 0 and fits about 100 x 95.
// Roofs, awnings and flags take the clan's colours (p, s). The moving pieces (flags, beam, smoke, glow) are classes
// animated in app/clan2.css.

type Art = { level: ProjectLevel; p: string; s: string }

// The depth of a block goes back and up to the right.
const DX = 0.62
const DY = -0.42
const OUT = '#3A2E24'
const OW = 0.9
const WOOD = '#B07A43'
const WOOD_S = '#8A5A2E'
const WOOD_T = '#D3A56C'
const WOOD_D = '#5E3D1E'
const STONE = '#E1E3E8'
const STONE_S = '#B5BBC7'
const STONE_T = '#F4F5F8'
const STONE_L = '#9AA2B0'
const PLASTER = '#F2E3C4'
const PLASTER_S = '#D7C29A'
const GOLD = '#F0B53E'
const GOLD_D = '#9B6C1B'
const GLASS = '#FFE08A'
const WATER = '#6FA9C9'

// Mixes a #RRGGBB colour toward black (k < 0) or white (k > 0).
function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  if (Number.isNaN(n)) return hex
  const t = k < 0 ? 0 : 255
  const a = Math.abs(k)
  const ch = (v: number) => Math.round(v + (t - v) * a)
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`
}

const pts = (...p: number[][]) => p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

// A box: the front face x..x+w from the ground line y up h, its side and top going back d.
function Block({ x, y, w, h, d, front, side, top }: { x: number; y: number; w: number; h: number; d: number; front: string; side: string; top?: string }) {
  const ox = d * DX
  const oy = d * DY
  return (
    <g stroke={OUT} strokeWidth={OW} strokeLinejoin="round">
      <polygon points={pts([x + w, y], [x + w + ox, y + oy], [x + w + ox, y - h + oy], [x + w, y - h])} fill={side} />
      {top && <polygon points={pts([x, y - h], [x + w, y - h], [x + w + ox, y - h + oy], [x + ox, y - h + oy])} fill={top} />}
      <rect x={x} y={y - h} width={w} height={h} fill={front} />
    </g>
  )
}

// A gabled roof over a box: the gable end over the front face, the roof slope seen going back on the right.
function Gable({ x, y, w, d, rise, roof, wall, over = 3 }: { x: number; y: number; w: number; d: number; rise: number; roof: string; wall: string; over?: number }) {
  const ox = d * DX
  const oy = d * DY
  const ridge = [x + w / 2, y - rise]
  return (
    <g stroke={OUT} strokeWidth={OW} strokeLinejoin="round">
      {/* the far slope: only a strip of it shows above the gable's left eave, but without it the roof lacks its back edge */}
      <polygon points={pts(ridge, [ridge[0] + ox, ridge[1] + oy], [x - over + ox, y + over * 0.5 + oy], [x - over, y + over * 0.5])} fill={shade(roof, -0.12)} />
      {/* the slope going back */}
      <polygon points={pts(ridge, [ridge[0] + ox, ridge[1] + oy], [x + w + over + ox, y + over * 0.5 + oy], [x + w + over, y + over * 0.5])} fill={roof} />
      {/* the ridge and the side eave, trimmed like the front */}
      <path d={`M ${ridge[0]} ${ridge[1] - 1.5} L ${ridge[0] + ox} ${ridge[1] - 1.5 + oy}`} stroke={OUT} strokeWidth={3.6} strokeLinecap="round" />
      <path d={`M ${ridge[0]} ${ridge[1] - 1.5} L ${ridge[0] + ox} ${ridge[1] - 1.5 + oy}`} stroke={shade(roof, -0.1)} strokeWidth={2.2} strokeLinecap="round" />
      <path d={`M ${x + w + over} ${y + over * 0.5} L ${x + w + over + ox} ${y + over * 0.5 + oy}`} stroke={OUT} strokeWidth={2.6} strokeLinecap="round" />
      <path d={`M ${x + w + over} ${y + over * 0.5} L ${x + w + over + ox} ${y + over * 0.5 + oy}`} stroke={shade(roof, -0.1)} strokeWidth={1.4} strokeLinecap="round" />
      {/* the gable wall, and the eaves along it in the roof's colour */}
      <polygon points={pts([x, y], ridge, [x + w, y])} fill={wall} />
      <path d={`M ${x - over} ${y + over * 0.5} L ${ridge[0]} ${ridge[1] - 1.5} L ${x + w + over} ${y + over * 0.5}`} fill="none" stroke={OUT} strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M ${x - over} ${y + over * 0.5} L ${ridge[0]} ${ridge[1] - 1.5} L ${x + w + over} ${y + over * 0.5}`} fill="none" stroke={shade(roof, -0.1)} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

// The shadow a footprint casts on the ground, to the right and back (a slanted band, not an oval).
function Shadow({ x, w, d }: { x: number; w: number; d: number }) {
  const ox = d * DX
  const oy = d * DY
  return <polygon className="c2-shadow" points={pts([x + 2, 1.5], [x + w + 6, 1.5], [x + w + ox + 10, oy + 1], [x + ox + 4, oy + 1])} fill="rgba(30,25,15,.16)" />
}

function Flag({ x, y, s, w = 15 }: { x: number; y: number; s: string; w?: number }) {
  return (
    <g>
      <rect x={x - 0.9} y={y} width={1.8} height={21} rx={0.9} fill={WOOD_D} />
      <circle cx={x} cy={y - 0.6} r={1.4} fill={GOLD} stroke={GOLD_D} strokeWidth={0.5} />
      <path className="c2-flag" d={`M ${x + 0.9} ${y + 1} h ${w} l -3.6 4.6 l 3.6 4.6 h -${w} z`} fill={s} stroke={OUT} strokeWidth={0.7} strokeLinejoin="round" />
    </g>
  )
}

function Lamp({ x, y, h = 18 }: { x: number; y: number; h?: number }) {
  return (
    <g>
      <rect x={x - 0.9} y={y - h} width={1.8} height={h} fill={WOOD_D} />
      <circle className="c2-glow" cx={x} cy={y - h - 2.5} r={5} fill={GLASS} opacity={0.35} />
      <rect x={x - 2.2} y={y - h - 5} width={4.4} height={5} rx={1} fill={GLASS} stroke={OUT} strokeWidth={0.7} />
    </g>
  )
}

function Crate({ x, y, sz = 9 }: { x: number; y: number; sz?: number }) {
  return (
    <g>
      <Block x={x} y={y} w={sz} h={sz} d={sz * 0.7} front={WOOD_T} side={WOOD} top="#E6C08D" />
      <path d={`M ${x + 1} ${y - 1} L ${x + sz - 1} ${y - sz + 1} M ${x + 1} ${y - sz + 1} L ${x + sz - 1} ${y - 1}`} stroke={WOOD_S} strokeWidth={0.8} />
    </g>
  )
}

function Barrel({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={OUT} strokeWidth={OW}>
      <path d={`M ${x - 4.5} ${y} Q ${x - 6} ${y - 6} ${x - 4.5} ${y - 12} H ${x + 4.5} Q ${x + 6} ${y - 6} ${x + 4.5} ${y} Z`} fill={WOOD} />
      <path d={`M ${x - 5.3} ${y - 3.5} H ${x + 5.3} M ${x - 5.3} ${y - 8.5} H ${x + 5.3}`} stroke={WOOD_D} strokeWidth={1} />
      <path d={`M ${x - 4.5} ${y - 12} Q ${x} ${y - 13.8} ${x + 4.5} ${y - 12}`} fill="#D9AE76" />
    </g>
  )
}

// A window with a lit pane.
function Win({ x, y, w = 7, h = 7, lit = false }: { x: number; y: number; w?: number; h?: number; lit?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1} fill={lit ? GLASS : '#9CC3DA'} stroke={OUT} strokeWidth={0.8} />
      <path d={`M ${x + w / 2} ${y} V ${y + h} M ${x} ${y + h / 2} H ${x + w}`} stroke={OUT} strokeWidth={0.6} opacity={0.6} />
    </g>
  )
}

// ───────────── «Причал»: a pier going into the water, then lanterns and crates, then a boathouse ─────────────
export function Dock({ level }: Art) {
  const len = [0, 50, 66, 80][level]
  const x0 = -len / 2 - 4
  const d = 18
  const ox = d * DX
  const oy = d * DY
  return (
    <g>
      {/* a little water under the pier, as a slanted band */}
      <polygon points={pts([x0 - 6, 6], [x0 + len + 8, 6], [x0 + len + 8 + ox, 6 + oy], [x0 - 6 + ox, 6 + oy])} fill={WATER} opacity={0.35} />
      <path d={`M ${x0 + 4} ${4} q 4 -1.6 8 0 t 8 0 M ${x0 + len - 10} ${3} q 4 -1.6 8 0`} fill="none" stroke="#fff" strokeWidth={0.9} opacity={0.75} />
      {/* posts */}
      {[0, 0.5, 1].map((k) =>
        [0, 1].map((back) => (
          <rect key={`${k}${back}`} x={x0 + 3 + k * (len - 6) + back * ox - 1.6} y={-4 + back * oy} width={3.2} height={10} fill={WOOD_D} stroke={OUT} strokeWidth={0.6} />
        )),
      )}
      {/* the deck: its top in planks, its front edge */}
      <polygon points={pts([x0, -4], [x0 + len, -4], [x0 + len + ox, -4 + oy], [x0 + ox, -4 + oy])} fill={WOOD_T} stroke={OUT} strokeWidth={OW} strokeLinejoin="round" />
      {Array.from({ length: Math.floor(len / 6) }).map((_, i) => (
        <path key={i} d={`M ${x0 + 6 + i * 6} -4 l ${ox} ${oy}`} stroke={WOOD_S} strokeWidth={0.7} opacity={0.7} />
      ))}
      <rect x={x0} y={-4} width={len} height={4} fill={WOOD} stroke={OUT} strokeWidth={OW} />
      {/* bollards with rope */}
      {[x0 + 5, x0 + len - 6].map((x) => (
        <g key={x}>
          <rect x={x - 1.8} y={-10} width={3.6} height={6.5} rx={1.4} fill={WOOD_D} stroke={OUT} strokeWidth={0.6} />
          <path d={`M ${x - 2.2} -7.5 h 4.4`} stroke="#E8D7A8" strokeWidth={1.2} />
        </g>
      ))}
      {level >= 2 && (
        <g>
          <Lamp x={x0 + 2 + ox} y={-4 + oy} h={20} />
          {/* the barrel stands behind the crate */}
          <Barrel x={x0 + len - 21 + ox * 0.7} y={-4 + oy * 0.7} />
          <Crate x={x0 + len - 22} y={-4} sz={8} />
        </g>
      )}
      {level === 3 && (
        <g>
          {/* a boathouse at the root of the pier */}
          <Block x={x0 + 6} y={-4} w={26} h={20} d={14} front={PLASTER} side={PLASTER_S} />
          <Gable x={x0 + 6} y={-24} w={26} d={14} rise={13} roof="#C0624A" wall={PLASTER} />
          <rect x={x0 + 13} y={-18} width={12} height={14} rx={1} fill={WOOD_D} stroke={OUT} strokeWidth={0.7} />
          <Win x={x0 + 16.5} y={-34} w={5} h={5} lit />
          <Lamp x={x0 + len - 2 + ox} y={-4 + oy} h={20} />
        </g>
      )}
    </g>
  )
}

// ───────────── «Маяк»: a tapering striped tower, then taller with a turning beam, then on a stone base, gold dome ─────────────
export function Beacon({ level, p, s }: Art) {
  const h = [0, 48, 62, 74][level]
  const base = level === 3 ? 7 : 0
  const wb = 12 + level * 1.4 // half width at the bottom
  const wt = 7.5 // half width at the top
  const top = -h - base
  const ring = (y: number, k: number) => {
    const half = wb - (wb - wt) * k
    return half
  }
  return (
    <g>
      <Shadow x={-wb} w={wb * 2} d={14} />
      {level === 3 && (
        <g>
          <Block x={-22} y={0} w={44} h={base} d={14} front={STONE} side={STONE_S} top={STONE_T} />
          <path d="M -22 -3.5 H 22" stroke={STONE_L} strokeWidth={0.7} />
        </g>
      )}
      {/* the tower: a lit left half, a shaded right half */}
      <path d={`M ${-wb} ${-base} L ${-wt} ${top} L ${wt} ${top} L ${wb} ${-base} Z`} fill="#FFFFFF" stroke={OUT} strokeWidth={OW} strokeLinejoin="round" />
      <path d={`M ${wb * 0.15} ${-base} L ${wt * 0.15} ${top} L ${wt} ${top} L ${wb} ${-base} Z`} fill="rgba(70,80,100,.13)" />
      {/* the stripes in the clan's colour */}
      {[0.12, 0.42, 0.72].slice(0, level + 1).map((k) => {
        const y0 = -base - h * k
        const y1 = y0 - h * 0.13
        const a = ring(y0, k)
        const b = ring(y1, k + 0.13)
        return (
          <g key={k}>
            <path d={`M ${-a} ${y0} L ${-b} ${y1} L ${b} ${y1} L ${a} ${y0} Z`} fill={p} stroke={OUT} strokeWidth={0.6} strokeLinejoin="round" />
            <path d={`M ${a * 0.15} ${y0} L ${b * 0.15} ${y1} L ${b} ${y1} L ${a} ${y0} Z`} fill="rgba(0,0,0,.14)" />
          </g>
        )
      })}
      {/* a door and a small window */}
      <path d={`M -3.2 ${-base} v -8 a 3.2 3.2 0 0 1 6.4 0 v 8 z`} fill={WOOD_D} stroke={OUT} strokeWidth={0.6} />
      <Win x={-2.4} y={-base - h * 0.62} w={4.8} h={5.5} />
      {/* the gallery, the lantern room, the dome */}
      <path d={`M ${-wt - 4} ${top} H ${wt + 4} L ${wt + 2.5} ${top - 3} H ${-wt - 2.5} Z`} fill="#4A5160" stroke={OUT} strokeWidth={0.7} strokeLinejoin="round" />
      <rect x={-6} y={top - 13} width={12} height={10} rx={1.5} fill="#2B303A" stroke={OUT} strokeWidth={0.7} />
      <rect x={-4.4} y={top - 11.6} width={8.8} height={7.4} rx={1.2} fill={GLASS} className="c2-glow" />
      <path d={`M -7.4 ${top - 13} Q 0 ${top - 25} 7.4 ${top - 13} Z`} fill={level === 3 ? GOLD : s} stroke={OUT} strokeWidth={OW} strokeLinejoin="round" />
      <circle cx={0} cy={top - 21.5} r={1.4} fill={level === 3 ? '#FFF3C0' : GOLD} stroke={OUT} strokeWidth={0.5} />
      {level >= 2 && (
        <g className="c2-beam" style={{ transformOrigin: `0px ${top - 8}px` }}>
          <path d={`M 0 ${top - 8} L 56 ${top - 20} L 56 ${top + 4} Z`} fill="#FFE9A6" opacity={0.38} />
        </g>
      )}
    </g>
  )
}

// ───────────── «Крепость»: a stone wall with a gate, then a corner tower, then two towers and a keep ─────────────
function Merlons({ x, y, w, d }: { x: number; y: number; w: number; d: number }) {
  const n = Math.max(2, Math.floor(w / 9))
  const step = w / n
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => (
        <Block key={i} x={x + i * step + step * 0.18} y={y} w={step * 0.62} h={5.5} d={d * 0.35} front={STONE} side={STONE_S} top={STONE_T} />
      ))}
    </g>
  )
}

const TOWER_W = 18
function Tower({ x, h, p, d = 12 }: { x: number; h: number; p: string; d?: number }) {
  const w = TOWER_W
  return (
    <g>
      <Block x={x} y={0} w={w} h={h} d={d} front={STONE} side={STONE_S} top={STONE_T} />
      {[0.3, 0.6].map((k) => (
        <path key={k} d={`M ${x} ${-h * k} H ${x + w}`} stroke={STONE_L} strokeWidth={0.6} />
      ))}
      <path d={`M ${x + w / 2 - 2.2} ${-h * 0.55} v -7 a 2.2 2.2 0 0 1 4.4 0 v 7 z`} fill="#2B303A" />
      {/* a pointed roof in the clan's colour */}
      <polygon points={pts([x - 2, -h], [x + w / 2 + d * DX * 0.5, -h - 20], [x + w + 2, -h])} fill={p} stroke={OUT} strokeWidth={OW} strokeLinejoin="round" />
      <polygon points={pts([x + w / 2 + d * DX * 0.5, -h - 20], [x + w + 2, -h], [x + w + 2 + d * DX, -h + d * DY])} fill={shade(p, -0.25)} stroke={OUT} strokeWidth={OW} strokeLinejoin="round" />
    </g>
  )
}

// The apex of a tower's roof (where its flag stands).
const towerApex = (x: number, h: number, d: number) => [x + TOWER_W / 2 + d * DX * 0.5, -h - 20] as const

// A flag standing on a point (its pole's foot there).
function FlagOn({ at, s, w }: { at: readonly [number, number]; s: string; w?: number }) {
  return <Flag x={at[0]} y={at[1] - 20} s={s} w={w} />
}

export function Fort({ level, p, s }: Art) {
  const w = [0, 58, 72, 94][level]
  const d = 14
  const x0 = -(w + d * DX) / 2
  const th = 36
  // The towers are part of the wall: the same depth, their fronts in the wall's front, the wall running between them,
  // so only the outer side of the fort shows (the left tower is drawn first and the wall hides its inner side).
  const left = level >= 2
  const right = level === 3
  const ws = left ? x0 + TOWER_W : x0
  const we = right ? x0 + w - TOWER_W : x0 + w
  const gx = (ws + we) / 2
  return (
    <g>
      <Shadow x={x0} w={w} d={d} />
      {left && <Tower x={x0} h={th} p={p} d={d} />}
      {/* the wall, its stones and its battlements */}
      <Block x={ws} y={0} w={we - ws} h={22} d={d} front={STONE} side={STONE_S} top={STONE_T} />
      {[7, 14].map((y) => (
        <path key={y} d={`M ${ws} ${-y} H ${we}`} stroke={STONE_L} strokeWidth={0.6} />
      ))}
      {Array.from({ length: Math.floor((we - ws) / 12) }).map((_, i) => (
        <path key={i} d={`M ${ws + 6 + i * 12} 0 v -7 M ${ws + 12 + i * 12} -7 v -7 M ${ws + 6 + i * 12} -14 v -8`} stroke={STONE_L} strokeWidth={0.6} />
      ))}
      <Merlons x={ws} y={-22} w={we - ws} d={d} />
      {/* the keep and the gate stand in the middle of the wall */}
      <g transform={`translate(${gx} 0)`}>
        {level === 3 && (
          <g>
            {/* the keep behind the gate */}
            <Block x={-11} y={-14} w={22} h={34} d={10} front={STONE} side={STONE_S} top={STONE_T} />
            <Merlons x={-11} y={-48} w={22} d={10} />
            <Win x={-3} y={-38} w={6} h={7} lit />
            <FlagOn at={[10 * DX * 0.5, -48 + 10 * DY * 0.5]} s={s} />
          </g>
        )}
        {/* the gate: a wooden door under a stone arch, the clan's colour over it */}
        <path d="M -8.5 0 v -12 a 8.5 8.5 0 0 1 17 0 v 12 z" fill={STONE_S} stroke={OUT} strokeWidth={OW} />
        <path d="M -6.5 0 v -11 a 6.5 6.5 0 0 1 13 0 v 11 z" fill={WOOD} stroke={OUT} strokeWidth={0.7} />
        <path d="M -2.2 -1 v -15 M 2.2 -1 v -15 M -6.5 -6 h 13" stroke={WOOD_D} strokeWidth={0.8} />
        <path d={`M -5 -21 h 10 v 6 l -5 -2.4 l -5 2.4 z`} fill={p} stroke={OUT} strokeWidth={0.6} strokeLinejoin="round" />
      </g>
      {right && <Tower x={we} h={th} p={p} d={d} />}
      {/* a flag on the top of every tower roof */}
      {left && <FlagOn at={towerApex(x0, th, d)} s={s} />}
      {right && <FlagOn at={towerApex(we, th, d)} s={s} />}
      {level === 3 &&
        [x0, we].map((x) => <circle key={x} className="c2-glow" cx={x + TOWER_W / 2} cy={-th * 0.55 - 3.5} r={2.6} fill="#FFB35C" />)}
    </g>
  )
}

// ───────────── «Доска заданий»: a notice board, then roofed, then with a lantern, a flag and a bench ─────────────
export function Board({ level, p, s }: Art) {
  const w = [0, 40, 50, 60][level]
  const d = 8
  const x0 = -(w + d * DX) / 2
  const notes = [0, 2, 4, 6][level]
  return (
    <g>
      <Shadow x={x0} w={w} d={d} />
      {/* legs */}
      {[x0 + 3, x0 + w - 6].map((x) => (
        <Block key={x} x={x} y={0} w={3} h={30} d={3} front={WOOD} side={WOOD_S} top={WOOD_T} />
      ))}
      {/* the board: a frame with a cork face */}
      <Block x={x0} y={-12} w={w} h={30} d={d} front={WOOD} side={WOOD_S} top={WOOD_T} />
      <rect x={x0 + 3} y={-39} width={w - 6} height={24} rx={1.5} fill="#D9B27A" stroke={OUT} strokeWidth={0.6} />
      {Array.from({ length: notes }).map((_, i) => {
        const cols = Math.min(3, notes)
        const x = x0 + 5 + (i % cols) * ((w - 10) / cols) + 1
        const y = -37 + Math.floor(i / cols) * 11.5 + (i % 2) * 1.5
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${i % 2 ? 4 : -5})`}>
            <rect width={10} height={9.5} rx={1} fill={i % 3 === 1 ? '#FFF1B8' : '#FFFFFF'} stroke="#B9A57E" strokeWidth={0.6} />
            <path d="M2 3.4h6M2 5.8h6M2 8h3.6" stroke={i % 3 === 2 ? p : '#8A8F9A'} strokeWidth={0.8} strokeLinecap="round" />
            <circle cx={5} cy={0.8} r={1} fill={i % 2 ? '#E25A4A' : '#3F7BD8'} />
          </g>
        )
      })}
      {level >= 2 && <Gable x={x0 - 1} y={-42} w={w + 2} d={d + 2} rise={11} roof={p} wall={WOOD} over={2.5} />}
      {level === 3 && (
        <g>
          <Lamp x={x0 - 4} y={0} h={24} />
          {/* the flag stands on the middle of the roof's ridge */}
          <FlagOn at={[x0 + w / 2 + (d + 2) * DX * 0.5, -42 - 11 - 1.5 + (d + 2) * DY * 0.5]} s={s} w={13} />
          {/* a bench beside it */}
          <Block x={x0 + w + 2} y={0} w={14} h={4} d={6} front={WOOD} side={WOOD_S} top={WOOD_T} />
        </g>
      )}
    </g>
  )
}

// ───────────── «Склад»: a shed, then a barn with windows and barrels, then a two-storey warehouse with a gold coin ─────────────
export function Storage({ level, p }: Art) {
  const w = [0, 40, 50, 58][level]
  const h = [0, 20, 24, 34][level]
  const d = 18
  const x0 = -(w + d * DX) / 2 + 2
  return (
    <g>
      <Shadow x={x0} w={w} d={d} />
      <Block x={x0} y={0} w={w} h={h} d={d} front={PLASTER} side={PLASTER_S} />
      {/* planks on the front */}
      {Array.from({ length: Math.floor(w / 6) }).map((_, i) => (
        <path key={i} d={`M ${x0 + 6 + i * 6} 0 V ${-h}`} stroke={PLASTER_S} strokeWidth={0.7} />
      ))}
      <Gable x={x0} y={-h} w={w} d={d} rise={12 + level * 2} roof={p} wall={PLASTER} />
      {/* the barn door with its cross braces */}
      <rect x={-8 + x0 + w / 2} y={-15} width={16} height={15} fill={WOOD} stroke={OUT} strokeWidth={0.8} />
      <path d={`M ${x0 + w / 2 - 8} 0 L ${x0 + w / 2 + 8} -15 M ${x0 + w / 2 - 8} -15 L ${x0 + w / 2 + 8} 0 M ${x0 + w / 2} 0 V -15`} stroke={WOOD_D} strokeWidth={0.9} />
      {level >= 2 && (
        <g>
          <Win x={x0 + 3.5} y={-h + 5} w={6} h={6} />
          <Win x={x0 + w - 9.5} y={-h + 5} w={6} h={6} />
          <Barrel x={x0 - 4} y={0} />
          <Crate x={x0 + w + d * DX + 1} y={0} sz={8} />
        </g>
      )}
      {level === 3 && (
        <g>
          {/* the loft hatch and the gold coin sign */}
          <rect x={x0 + w / 2 - 4} y={-h - 9} width={8} height={7} fill={WOOD} stroke={OUT} strokeWidth={0.7} />
          <circle cx={x0 + w / 2} cy={-h + 6} r={5.6} fill={GOLD} stroke={GOLD_D} strokeWidth={1} />
          <text x={x0 + w / 2} y={-h + 8.6} textAnchor="middle" fontSize={7.5} fontWeight={800} fill={GOLD_D}>
            R
          </text>
          <Crate x={x0 + w + d * DX + 1} y={-8} sz={7} />
        </g>
      )}
    </g>
  )
}

// ───────────── «Рынок»: one stall, then two with a smoking stove, then a market hall with a flag ─────────────
function Stall({ x, w, p, goods }: { x: number; w: number; p: string; goods: string[] }) {
  const d = 10
  const ox = d * DX
  const oy = d * DY
  const n = Math.max(3, Math.round(w / 6))
  const sw = (w + 4) / n
  return (
    <g>
      {/* the back posts (they hold the awning's high back edge), then the front ones, and the rails between them */}
      {[x, x + w - 2].map((px) => (
        <rect key={`b${px}`} x={px + ox} y={-31 + oy} width={2} height={31} fill={WOOD_S} stroke={OUT} strokeWidth={0.4} />
      ))}
      {[x, x + w - 2].map((px) => (
        <rect key={px} x={px} y={-24} width={2} height={24} fill={WOOD_D} stroke={OUT} strokeWidth={0.4} />
      ))}
      <path d={`M ${x + w} -21 L ${x + w - 2 + ox + 2} ${-28 + oy}`} stroke={WOOD_D} strokeWidth={1.4} />
      {/* the counter, the goods on it */}
      <Block x={x - 1} y={0} w={w + 2} h={9} d={d} front={WOOD} side={WOOD_S} top={WOOD_T} />
      {goods.map((g, i) => (
        <circle key={i} cx={x + 4 + i * ((w - 4) / Math.max(1, goods.length - 1))} cy={-10.5 + oy * 0.4} r={2.4} fill={g} stroke={OUT} strokeWidth={0.5} />
      ))}
      {/* the striped awning, sloping back */}
      {Array.from({ length: n }).map((_, i) => (
        <polygon key={i} points={pts([x - 2 + i * sw, -22], [x - 2 + (i + 1) * sw, -22], [x - 2 + (i + 1) * sw + ox, -30 + oy], [x - 2 + i * sw + ox, -30 + oy])} fill={i % 2 ? '#FFFFFF' : p} stroke={OUT} strokeWidth={0.6} strokeLinejoin="round" />
      ))}
      {Array.from({ length: n }).map((_, i) => (
        <path key={`v${i}`} d={`M ${x - 2 + i * sw} -22 h ${sw} l 0 3 q ${-sw / 2} 3 ${-sw} 0 z`} fill={i % 2 ? '#FFFFFF' : p} stroke={OUT} strokeWidth={0.6} strokeLinejoin="round" />
      ))}
    </g>
  )
}

export function Market({ level, p, s }: Art) {
  const fruit = ['#E8553E', '#F0B53E', '#7DBB4A', '#E8553E', '#F0B53E']
  if (level === 3)
    return (
      <g>
        <Shadow x={-38} w={70} d={16} />
        {/* the market hall: a long building with an arcade, a gable over the middle, a flag */}
        <Block x={-38} y={0} w={66} h={26} d={16} front={PLASTER} side={PLASTER_S} />
        {[-32, -18, -4, 10].map((x) => (
          <path key={x} d={`M ${x} 0 v -11 a 5 5 0 0 1 10 0 v 11 z`} fill={WOOD_D} stroke={OUT} strokeWidth={0.7} />
        ))}
        <polygon points={pts([-41, -26], [31, -26], [31 + 16 * DX, -26 + 16 * DY], [-41 + 16 * DX, -26 + 16 * DY])} fill={p} stroke={OUT} strokeWidth={OW} strokeLinejoin="round" />
        <Gable x={-17} y={-26} w={24} d={16} rise={14} roof={p} wall={PLASTER} />
        <circle cx={-5} cy={-32} r={3.4} fill={GOLD} stroke={GOLD_D} strokeWidth={0.8} />
        <FlagOn at={[-36, -27.4]} s={s} />
        <Stall x={34} w={14} p={p} goods={fruit.slice(0, 3)} />
      </g>
    )
  const stalls = level === 1 ? [-11] : [-30, 3]
  return (
    <g>
      <Shadow x={stalls[0] - 2} w={level === 1 ? 26 : 60} d={10} />
      {stalls.map((x, i) => (
        <Stall key={x} x={x} w={22} p={p} goods={fruit.slice(i, i + 4)} />
      ))}
      {level === 2 && (
        <g>
          {/* a stove with smoke between the stalls */}
          <Block x={30} y={0} w={8} h={16} d={6} front={STONE} side={STONE_S} top={STONE_T} />
          <path className="c2-smoke" d="M 36 -22 q -5 -8 1 -14 q 6 -6 0 -13" fill="none" stroke="rgba(120,120,120,.5)" strokeWidth={3.2} strokeLinecap="round" />
          <Crate x={-42} y={0} sz={7} />
        </g>
      )}
    </g>
  )
}

export const ART: Record<ProjectId, (props: Art) => ReactNode> = { dock: Dock, beacon: Beacon, fort: Fort, board: Board, storage: Storage, market: Market }
