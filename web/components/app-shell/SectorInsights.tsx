'use client'

import { useSectorInsights, useSpecies, type SectorInsights as Insights } from '@/lib/supabase/queries'
import { KIND_LABEL } from '@/lib/data/species'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useT } from '@/lib/i18n'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Territory } from '@/lib/data/types'

// The sector legend's mark — a small laurel wreath, gold.
export function LaurelIcon({ size = 16, color = '#C9921F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8.5 20.5C4.6 18.7 3 15 3.4 10.5" />
      <path d="M15.5 20.5c3.9-1.8 5.5-5.5 5.1-10" />
      <path d="M4.2 14.6c-1.2-.6-1.9-1.7-2-3 1.3 0 2.4.6 3 1.7" fill={color} />
      <path d="M5.6 17.9c-1.3-.2-2.3-1-2.7-2.2 1.3-.2 2.5.2 3.3 1.2" fill={color} />
      <path d="M3.6 10.4c-.9-.9-1.2-2.2-.9-3.4 1.2.4 2.1 1.3 2.4 2.5" fill={color} />
      <path d="M19.8 14.6c1.2-.6 1.9-1.7 2-3-1.3 0-2.4.6-3 1.7" fill={color} />
      <path d="M18.4 17.9c1.3-.2 2.3-1 2.7-2.2-1.3-.2-2.5.2-3.3 1.2" fill={color} />
      <path d="M20.4 10.4c.9-.9 1.2-2.2.9-3.4-1.2.4-2.1 1.3-2.4 2.5" fill={color} />
      <path d="M9.5 21.5h5" />
    </svg>
  )
}

// The legend's avatar frame: two laurel branches rising from a tie at the
// bottom and curving up both sides, open at the top like a victor's wreath.
// Leaves are laid along the arc in pairs and shrink toward the tips.
const WREATH_C = 32
const WREATH_R = 25
function wreathBranch(side: 1 | -1) {
  const leaves: React.ReactNode[] = []
  const steps = 7
  const point = (deg: number) => {
    const th = (deg * Math.PI) / 180
    return [WREATH_C + WREATH_R * Math.cos(th), WREATH_C + WREATH_R * Math.sin(th)]
  }
  const startDeg = side === 1 ? 102 : 78
  const endDeg = side === 1 ? 222 : -42
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const deg = startDeg + (endDeg - startDeg) * t
    const [x, y] = point(deg)
    const grow = deg + 90 * side
    const len = 4.4 - t * 1.4
    for (const k of [-1, 1]) {
      const a = grow + k * 34
      const ar = (a * Math.PI) / 180
      const cx = x + Math.cos(ar) * len
      const cy = y + Math.sin(ar) * len
      leaves.push(<ellipse key={`${i}${k}`} cx={cx} cy={cy} rx={len} ry={len * 0.45} transform={`rotate(${a} ${cx} ${cy})`} />)
    }
  }
  const [sx, sy] = point(startDeg)
  const [ex, ey] = point(endDeg)
  const tipAr = ((endDeg + 90 * side) * Math.PI) / 180
  const tx = ex + Math.cos(tipAr) * 2.6
  const ty = ey + Math.sin(tipAr) * 2.6
  return (
    <g>
      <path d={`M${sx} ${sy} A${WREATH_R} ${WREATH_R} 0 0 ${side === 1 ? 1 : 0} ${ex} ${ey}`} fill="none" stroke="#B07F18" strokeWidth="1.3" strokeLinecap="round" />
      {leaves}
      <ellipse cx={tx} cy={ty} rx={2.8} ry={1.25} transform={`rotate(${endDeg + 90 * side} ${tx} ${ty})`} />
    </g>
  )
}

export function LegendWreath({ size = 58, children }: { size?: number; children: React.ReactNode }) {
  return (
    <span className="legend-wreath" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <g fill="#D4A22C">
          {wreathBranch(1)}
          {wreathBranch(-1)}
        </g>
        <path d="M27.5 59.5l4.5-3 4.5 3M32 56.5v-1.5" fill="none" stroke="#B07F18" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  )
}

// The busiest 3-hour stretch of the day, wrapping past midnight (a sector
// that bites 21:00–01:00 is one evening, not two halves). Null when there's
// too little to call it.
function bestWindow(hours: number[]): { from: number; to: number } | null {
  const total = hours.reduce((a, b) => a + b, 0)
  if (total < 3) return null
  let best = -1
  let start = 0
  for (let h = 0; h < 24; h++) {
    const sum = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24]
    if (sum > best) {
      best = sum
      start = h
    }
  }
  return { from: start, to: (start + 3) % 24 }
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

export function SectorInsightsCard({ territory }: { territory: Territory }) {
  const t = useT()
  const { data } = useSectorInsights(territory.id)
  const { data: species = [] } = useSpecies()
  if (!data) return null

  return (
    <div className="insights-card">
      <div className="insights-head">
        <span className="insights-title">{t('insights.title')}</span>
        <span className="insights-period">{t('insights.period')}</span>
      </div>
      {data.total === 0 ? (
        <div className="insights-empty">{t('insights.empty')}</div>
      ) : (
        <InsightsBody data={data} speciesName={(key) => species.find((s) => s.key === key)?.name ?? key} />
      )}
      {data.scope === 'kind' && data.total > 0 && <div className="insights-note">{t('insights.kindScope', { kind: KIND_LABEL[data.kind] })}</div>}
    </div>
  )
}

function InsightsBody({ data, speciesName }: { data: Insights; speciesName: (key: string) => string }) {
  const t = useT()
  const top = data.species[0]?.count ?? 1
  const window = bestWindow(data.hours)
  const peak = Math.max(1, ...data.hours)
  const inWindow = (h: number) => !!window && ((h - window.from + 24) % 24) < 3

  return (
    <>
      <div className="insights-species">
        {data.species.map((s) => (
          <div key={s.key} className="insights-species-row">
            <span className="insights-species-name">{speciesName(s.key)}</span>
            <span className="insights-species-bar">
              <i style={{ width: `${Math.max(4, (s.count / top) * 100)}%` }} />
            </span>
            <span className="insights-species-count">{s.count}</span>
          </div>
        ))}
      </div>

      {window && (
        <>
          <div className="insights-best">{t('insights.bestTime', { from: hh(window.from), to: hh(window.to) })}</div>
          <div className="insights-hours" aria-hidden>
            {data.hours.map((n, h) => (
              <i key={h} className={inWindow(h) ? 'on' : undefined} style={{ height: `${n ? Math.max(12, (n / peak) * 100) : 6}%` }} />
            ))}
          </div>
          <div className="insights-hours-axis" aria-hidden>
            <span>0</span>
            <span>6</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
        </>
      )}

      {(data.methods.length > 0 || data.baits.length > 0) && (
        <div className="insights-gear">
          {data.methods.length > 0 && (
            <div>
              <span className="insights-gear-label">{t('insights.method')}</span>
              {data.methods.map((m) => m.name).join(', ')}
            </div>
          )}
          {data.baits.length > 0 && (
            <div>
              <span className="insights-gear-label">{t('insights.bait')}</span>
              {data.baits.map((b) => b.name).join(', ')}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// «Легенда сектора» under «Захватил сектор»: who has fished here the most
// in 90 days, and how far the viewer is from taking that over.
export function SectorLegendRow({ territory, onOpenUser }: { territory: Territory; onOpenUser: (id: string) => void }) {
  const t = useT()
  const { user } = useAuth()
  const { data } = useSectorInsights(territory.id)
  if (!data) return null
  const legend = data.legend
  const mine = data.myCount
  const isMe = !!legend && legend.id === user?.id

  return (
    <div className="legend-row">
      <div className="legend-row-head">{t('legend.title')}</div>
      {legend ? (
        <button className="legend-row-person tap-scale" onClick={() => onOpenUser(legend.id)}>
          <LegendWreath>
            <span className="legend-row-avatar">
              {legend.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar thumbnail, same as the rest of the sector screen
                <img src={thumbUrl(legend.avatarUrl, 96)} alt="" />
              ) : (
                (legend.name ?? '?').slice(0, 2).toUpperCase()
              )}
            </span>
          </LegendWreath>
          <span className="legend-row-text">
            <b>{isMe ? t('legend.you') : legend.name}</b>
            <span>{t('legend.catchesPeriod', { count: legend.count })}</span>
          </span>
        </button>
      ) : (
        <div className="legend-row-none">{t('legend.none')}</div>
      )}
      {mine !== null && !isMe && (
        <div className="legend-row-progress">
          {legend
            ? `${t('legend.mineHere', { count: mine })} · ${t('legend.toLegend', { count: Math.max(1, legend.count - mine + 1) })}`
            : t('legend.noneProgress', { mine })}
        </div>
      )}
    </div>
  )
}
