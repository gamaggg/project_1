'use client'

import type { CSSProperties } from 'react'

// Flat-top hex grid — same geometry as the real map (see .hex-shape /
// resolveTerritoryColor), just laid out as a fixed decorative cluster here
// instead of driven by sector data.
const HEX_W = 78
const HEX_H = HEX_W / 1.1547
const COL_STEP = HEX_W * 0.75
const ROW_OFF = HEX_H / 2

type HexRole = 'mine' | 'other' | 'free'
type Cell = { c: number; r: number; role: HexRole }

const CELLS: Cell[] = [
  { c: 1, r: 0, role: 'mine' },
  { c: 2, r: 0, role: 'mine' },
  { c: 3, r: 0, role: 'free' },
  { c: 4, r: 0, role: 'other' },
  { c: 0, r: 1, role: 'other' },
  { c: 1, r: 1, role: 'mine' },
  { c: 2, r: 1, role: 'mine' },
  { c: 3, r: 1, role: 'mine' },
  { c: 4, r: 1, role: 'mine' },
  { c: 1, r: 2, role: 'free' },
  { c: 2, r: 2, role: 'mine' },
  { c: 3, r: 2, role: 'mine' },
]

// Spreading-claim order for the "mine" cells (not array order) — makes the
// wave read as one sector claiming its neighbor rather than a scan.
const MINE_ORDER: [number, number][] = [
  [1, 0], [2, 0], [2, 1], [1, 1], [2, 2], [3, 1], [3, 2], [4, 1],
]

const CLUSTER_W = 4 * COL_STEP + HEX_W
const CLUSTER_H = 3 * HEX_H + ROW_OFF

export function TerritoryIntroStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  return (
    <div className="intro-screen intro-screen--territory">
      <button className="intro-back" onClick={onBack} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="intro-illustration">
        <div className="intro-hexfield">
          <div className="intro-hexcluster" style={{ width: CLUSTER_W, height: CLUSTER_H }}>
            {CELLS.map((cell) => {
              const x = cell.c * COL_STEP
              const y = cell.r * HEX_H + (cell.c % 2 === 1 ? ROW_OFF : 0)
              const order = cell.role === 'mine' ? MINE_ORDER.findIndex(([c, r]) => c === cell.c && r === cell.r) : -1
              return (
                <div
                  key={`${cell.c}-${cell.r}`}
                  className={`intro-hex intro-hex--${cell.role}`}
                  style={{ width: HEX_W, left: x, top: y, '--i': order } as CSSProperties}
                >
                  {cell.role === 'mine' && <div className="intro-hex-pin" style={{ '--i': order } as CSSProperties} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">RANGE начинается здесь</div>
        <div className="intro-sub">Побережье разбито на сотни секторов. Лови рыбу — и участок закрепляется за тобой.</div>
        <button className="intro-cta" onClick={onDone}>
          Продолжить
        </button>
      </div>
    </div>
  )
}
