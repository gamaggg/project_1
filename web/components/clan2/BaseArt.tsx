import type { ReactNode } from 'react'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'

// The pictures of the clan base: six buildings, each drawn in three stages. Every drawing stands on the ground line
// y = 0 and is about 100 wide and 90 high, centred on x = 0. Roofs and flags take the clan's colours (p, s). The pieces
// that move (flags, beam, smoke, glow) are classes animated in app/clan2.css.

type Art = { level: ProjectLevel; p: string; s: string }

const WOOD = '#A06E3B'
const WOOD_D = '#6F4A24'
const WOOD_L = '#C99A5F'
const STONE = '#D2D6DF'
const STONE_D = '#9BA3B3'
const STONE_L = '#EEF0F5'
const WHITE = '#FFFFFF'
const GOLD = '#F0B53E'
const GOLD_D = '#B57A10'

function Flag({ x, y, s, w = 16 }: { x: number; y: number; s: string; w?: number }) {
  return (
    <g>
      <rect x={x - 1} y={y} width={2} height={22} rx={1} fill={WOOD_D} />
      <path className="c2-flag" d={`M ${x + 1} ${y + 1} h ${w} l -4 5 l 4 5 h -${w} z`} fill={s} stroke={WHITE} strokeWidth={0.8} />
    </g>
  )
}

// A soft contact shadow under a building.
function Ground({ w }: { w: number }) {
  return <ellipse cx={0} cy={3} rx={w} ry={w * 0.16} fill="rgba(40,30,10,.22)" />
}

export function Dock({ level }: Art) {
  const len = [0, 52, 70, 86][level]
  const x0 = -len / 2
  return (
    <g>
      <Ground w={len / 2 + 8} />
      {[x0 + 4, x0 + len / 2, x0 + len - 4].map((x) => (
        <rect key={x} x={x - 2.4} y={-3} width={4.8} height={14} rx={1.5} fill={WOOD_D} />
      ))}
      <rect x={x0} y={-10} width={len} height={8} rx={2} fill={WOOD} stroke={WOOD_D} strokeWidth={1} />
      {Array.from({ length: Math.floor(len / 8) }).map((_, i) => (
        <rect key={i} x={x0 + 4 + i * 8} y={-10} width={1.2} height={8} fill={WOOD_D} opacity={0.5} />
      ))}
      <rect x={x0} y={-10} width={len} height={2.4} rx={1.2} fill={WOOD_L} opacity={0.7} />
      {level >= 2 && (
        <g>
          <rect x={x0 + 2} y={-30} width={2.4} height={22} fill={WOOD_D} />
          <circle className="c2-glow" cx={x0 + 3.2} cy={-32} r={4} fill="#FFE08A" />
        </g>
      )}
      {level === 3 && (
        <g>
          <rect x={x0 + len / 2 - 1} y={-24} width={2.4} height={14} fill={WOOD_D} />
          <circle className="c2-glow" cx={x0 + len / 2 + 0.2} cy={-26} r={3.6} fill="#FFE08A" />
        </g>
      )}
    </g>
  )
}

export function Beacon({ level, p, s }: Art) {
  const h = [0, 46, 62, 78][level]
  const w0 = 11 + level * 1.5
  const top = -h
  return (
    <g>
      <Ground w={26} />
      {level === 3 && <rect x={-24} y={-8} width={48} height={8} rx={3} fill={STONE} stroke={STONE_D} strokeWidth={1} />}
      <path d={`M ${-w0} 0 L ${-w0 + 3.5} ${top} L ${w0 - 3.5} ${top} L ${w0} 0 z`} fill={WHITE} stroke={STONE_D} strokeWidth={1.2} />
      <path d={`M ${w0 - 3.5} ${top} L ${w0} 0 L ${w0 - 6} 0 L ${w0 - 8} ${top} z`} fill="rgba(60,70,90,.14)" />
      {[0.28, 0.58, 0.86].slice(0, Math.min(3, level + 1)).map((k) => {
        const y = -h * k
        const half = w0 - (3.5 * k) - 0.4
        return <path key={k} d={`M ${-half} ${y} L ${-half + 0.6} ${y - h * 0.11} L ${half - 0.6} ${y - h * 0.11} L ${half} ${y} z`} fill={p} />
      })}
      <rect x={-9} y={top - 3} width={18} height={4} rx={1.4} fill="#39404D" />
      <rect x={-6.5} y={top - 14} width={13} height={11} rx={2} fill="#2B303A" />
      <rect x={-4.6} y={top - 12.5} width={9.2} height={8} rx={1.6} fill="#FFE08A" className="c2-glow" />
      <path d={`M -10 ${top - 14} L 0 ${top - 24} L 10 ${top - 14} z`} fill={level === 3 ? GOLD : s} stroke={WHITE} strokeWidth={1} />
      {level >= 2 && (
        <g className="c2-beam" style={{ transformOrigin: `0px ${top - 8}px` }}>
          <path d={`M 0 ${top - 8} L 58 ${top - 22} L 58 ${top + 6} z`} fill="#FFE9A6" opacity={0.4} />
        </g>
      )}
      <rect x={-3} y={-12} width={6} height={12} rx={3} fill={WOOD_D} />
    </g>
  )
}

export function Fort({ level, p, s }: Art) {
  const w = [0, 56, 72, 90][level]
  const tower = (x: number, h: number, key: string) => (
    <g key={key}>
      <rect x={x - 10} y={-h} width={20} height={h} fill={STONE} stroke={STONE_D} strokeWidth={1.2} />
      <rect x={x + 3} y={-h} width={7} height={h} fill="rgba(60,70,90,.14)" />
      {[-10, -3.4, 3.2].map((dx) => (
        <rect key={dx} x={x + dx} y={-h - 6} width={6.8} height={6.4} fill={STONE} stroke={STONE_D} strokeWidth={1} />
      ))}
      <path d={`M ${x - 2.4} ${-h * 0.55} v -9 a 2.4 2.4 0 0 1 4.8 0 v 9 z`} fill="#2B303A" />
      <rect x={x - 12} y={-h * 0.2} width={24} height={2.4} fill={STONE_D} opacity={0.5} />
    </g>
  )
  return (
    <g>
      <Ground w={w / 2 + 6} />
      <rect x={-w / 2} y={-20} width={w} height={20} fill={STONE} stroke={STONE_D} strokeWidth={1.2} />
      <rect x={-w / 2} y={-20} width={w} height={4} fill={STONE_L} opacity={0.7} />
      {Array.from({ length: Math.floor(w / 10) }).map((_, i) => (
        <rect key={i} x={-w / 2 + 1.5 + i * 10} y={-26} width={6.6} height={6.4} fill={STONE} stroke={STONE_D} strokeWidth={1} />
      ))}
      {level >= 2 && tower(-w / 2 + 6, 44, 'l')}
      {level >= 3 && tower(w / 2 - 6, 44, 'r')}
      {level === 3 && (
        <g>
          <rect x={-14} y={-46} width={28} height={30} fill={STONE} stroke={STONE_D} strokeWidth={1.2} />
          <path d="M -17 -46 L 0 -62 L 17 -46 z" fill={p} stroke={WHITE} strokeWidth={1.2} />
        </g>
      )}
      <path d="M -8 0 v -13 a 8 8 0 0 1 16 0 v 13 z" fill={p} stroke={WHITE} strokeWidth={1.2} />
      <path d="M -8 -8 h 16" stroke={WHITE} strokeWidth={0.8} opacity={0.6} />
      {level >= 2 && <Flag x={level === 3 ? 0 : -w / 2 + 6} y={level === 3 ? -86 : -66} s={s} />}
      {level === 3 && (
        <g>
          <circle className="c2-glow" cx={-w / 2 + 6} cy={-30} r={3} fill="#FFB35C" />
          <circle className="c2-glow" cx={w / 2 - 6} cy={-30} r={3} fill="#FFB35C" />
        </g>
      )}
    </g>
  )
}

export function Board({ level, p, s }: Art) {
  const w = [0, 40, 54, 68][level]
  const notes = [0, 1, 3, 5][level]
  return (
    <g>
      <Ground w={w / 2 + 6} />
      <rect x={-w / 2 + 3} y={-30} width={4} height={30} fill={WOOD_D} />
      <rect x={w / 2 - 7} y={-30} width={4} height={30} fill={WOOD_D} />
      {level >= 2 && <path d={`M ${-w / 2 - 4} -40 L 0 -54 L ${w / 2 + 4} -40 z`} fill={p} stroke={WHITE} strokeWidth={1.2} />}
      <rect x={-w / 2} y={-44} width={w} height={32} rx={3} fill={WOOD} stroke={WOOD_D} strokeWidth={1.6} />
      <rect x={-w / 2 + 3} y={-41} width={w - 6} height={26} rx={2} fill={WOOD_L} opacity={0.55} />
      {Array.from({ length: notes }).map((_, i) => {
        const cols = notes > 3 ? 3 : notes
        const x = -w / 2 + 6 + (i % cols) * ((w - 12) / cols)
        const y = -40 + Math.floor(i / cols) * 13 + (i % 2) * 2
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${i % 2 ? 4 : -5})`}>
            <rect width={11} height={12} rx={1.2} fill={i % 3 === 1 ? '#FFF1B8' : WHITE} stroke="#D9CFAE" strokeWidth={0.7} />
            <path d="M2 4h7M2 7h7M2 10h4" stroke={i % 3 === 2 ? p : '#8A8F9A'} strokeWidth={0.9} strokeLinecap="round" />
          </g>
        )
      })}
      {level === 3 && (
        <g>
          <Flag x={w / 2 + 2} y={-62} s={s} />
          <circle className="c2-glow" cx={-w / 2 - 2} cy={-26} r={3.4} fill="#FFE08A" />
          <rect x={-w / 2 - 3} y={-24} width={2} height={24} fill={WOOD_D} />
        </g>
      )}
    </g>
  )
}

export function Storage({ level, p, s }: Art) {
  const w = [0, 46, 62, 78][level]
  const h = [0, 26, 32, 42][level]
  return (
    <g>
      <Ground w={w / 2 + 8} />
      <rect x={-w / 2} y={-h} width={w} height={h} fill="#EBD6A8" stroke={WOOD_D} strokeWidth={1.3} />
      {Array.from({ length: Math.floor(w / 7) }).map((_, i) => (
        <rect key={i} x={-w / 2 + 3 + i * 7} y={-h} width={0.9} height={h} fill={WOOD_D} opacity={0.25} />
      ))}
      <path d={`M ${-w / 2 - 5} ${-h} L 0 ${-h - 16 - level * 3} L ${w / 2 + 5} ${-h} z`} fill={p} stroke={WHITE} strokeWidth={1.3} />
      <rect x={-8} y={-17} width={16} height={17} rx={1.5} fill={WOOD_D} />
      <path d="M0 -17 v17 M-8 -8 h16" stroke="#3E2A12" strokeWidth={0.9} />
      {level >= 2 && (
        <g>
          <rect x={w / 2 - 17} y={-h + 7} width={10} height={9} rx={1} fill="#F6E7BF" stroke={WOOD_D} strokeWidth={1} />
          <rect x={-w / 2 + 7} y={-h + 7} width={10} height={9} rx={1} fill="#F6E7BF" stroke={WOOD_D} strokeWidth={1} />
        </g>
      )}
      {level === 3 && (
        <g>
          <circle cx={0} cy={-h - 8} r={7} fill={GOLD} stroke={WHITE} strokeWidth={1.4} />
          <text x={0} y={-h - 5} textAnchor="middle" fontSize={9} fontWeight={800} fill={GOLD_D}>
            R
          </text>
        </g>
      )}
      <rect x={w / 2 + 2} y={-12} width={11} height={12} rx={1.5} fill={WOOD_L} stroke={WOOD_D} strokeWidth={1} />
      <rect x={w / 2 + 6} y={-19} width={9} height={7} rx={1.2} fill={s} stroke={WHITE} strokeWidth={0.8} />
      {level >= 2 && (
        <g>
          <ellipse cx={-w / 2 - 8} cy={-7} rx={6} ry={7} fill={WOOD} stroke={WOOD_D} strokeWidth={1} />
          <path d={`M ${-w / 2 - 13} -7 h 10`} stroke={WOOD_D} strokeWidth={1} />
        </g>
      )}
    </g>
  )
}

export function Market({ level, p, s }: Art) {
  const stalls = level === 1 ? 1 : 2
  const w = level === 3 ? 84 : level === 2 ? 66 : 36
  return (
    <g>
      <Ground w={w / 2 + 8} />
      {level === 3 ? (
        <g>
          <rect x={-w / 2} y={-30} width={w} height={30} fill="#F4E2B6" stroke={WOOD_D} strokeWidth={1.3} />
          <rect x={-w / 2 + 6} y={-22} width={16} height={22} fill={WOOD_D} />
          <rect x={w / 2 - 22} y={-22} width={16} height={22} fill={WOOD_D} />
        </g>
      ) : (
        Array.from({ length: stalls }).map((_, i) => {
          const cx = stalls === 1 ? 0 : (i === 0 ? -17 : 17)
          return (
            <g key={i}>
              <rect x={cx - 12} y={-22} width={2.6} height={22} fill={WOOD_D} />
              <rect x={cx + 9.4} y={-22} width={2.6} height={22} fill={WOOD_D} />
              <rect x={cx - 12} y={-8} width={24} height={8} rx={1.5} fill={WOOD} stroke={WOOD_D} strokeWidth={1} />
              <ellipse cx={cx - 4} cy={-10} rx={4.6} ry={2.4} fill="#8FB8D8" />
              <ellipse cx={cx + 4} cy={-10} rx={4.6} ry={2.4} fill="#A9CBE3" />
            </g>
          )
        })
      )}
      {/* The striped awning in the clan's colours. */}
      {Array.from({ length: level === 3 ? 7 : stalls * 3 + (stalls === 1 ? 1 : 0) }).map((_, i, all) => {
        const aw = level === 3 ? w + 8 : w + 8
        const sw = aw / all.length
        return <path key={i} d={`M ${-aw / 2 + i * sw} ${level === 3 ? -34 : -26} h ${sw} l 2 9 h -${sw + 2} z`} fill={i % 2 ? WHITE : p} stroke="rgba(0,0,0,.08)" strokeWidth={0.6} />
      })}
      {level >= 2 && (
        <g>
          <rect x={w / 2 - 14} y={-46} width={7} height={16} fill={STONE} stroke={STONE_D} strokeWidth={1} />
          <path className="c2-smoke" d={`M ${w / 2 - 10.5} -48 q -5 -8 1 -14 q 6 -6 0 -13`} fill="none" stroke="rgba(120,120,120,.5)" strokeWidth={3.4} strokeLinecap="round" />
        </g>
      )}
      {level === 3 && <Flag x={-w / 2 + 4} y={-58} s={s} />}
      {level >= 2 && (
        <g>
          <path d={`M ${-w / 2 + 4} -23 q 8 6 16 0`} fill="none" stroke={WHITE} strokeWidth={1.1} />
          <path d="M-16 -22 l2 6 M-10 -22 l2 7" stroke="#8FB8D8" strokeWidth={2} strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

export const ART: Record<ProjectId, (props: Art) => ReactNode> = { dock: Dock, beacon: Beacon, fort: Fort, board: Board, storage: Storage, market: Market }
