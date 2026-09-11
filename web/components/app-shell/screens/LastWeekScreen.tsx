'use client'

import { useMemo } from 'react'
import { useWeeklyLeaderboard } from '@/lib/supabase/queries'
import { PodiumItem } from '@/components/app-shell/screens/WeeklyLeaderboard'
import { CITIES, type CityId } from '@/lib/data/city'
import { formatWeekOfMonth, pluralCatches, pluralSectors } from '@/lib/format'

const CONFETTI_COLORS = ['#FC5200', '#F0A93E', '#B8C0CC', '#B06B36']
// Reveal 3rd -> 2nd -> 1st, slowest for 1st so the ceremony builds toward it.
const STAGGER_DELAY_MS: Record<1 | 2 | 3, number> = { 3: 0, 2: 260, 1: 540 }

export function LastWeekScreen({
  city,
  onBack,
  onOpenUser,
  onOpenCurrentRating,
}: {
  city: CityId
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenCurrentRating: () => void
}) {
  const cityInfo = CITIES[city]
  const { data: entries = [], isLoading } = useWeeklyLeaderboard(false, -1, cityInfo.idPrefix, cityInfo.timezone)
  const podium = entries.slice(0, 3)
  const rest = entries.slice(3, 10)
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium
  const weekLabel = useMemo(() => formatWeekOfMonth(-1, cityInfo.timezone), [cityInfo.timezone])

  const confetti = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        left: 6 + Math.random() * 88,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: 0.5 + Math.random() * 0.4,
      })),
    []
  )

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Итоги недели</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="recap-hero">
          {podium.length === 3 && (
            <div className="recap-confetti">
              {confetti.map((c, i) => (
                <i key={i} style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s` }} />
              ))}
            </div>
          )}

          <div className="rating-week-note">
            <span className="rating-week-badge">{weekLabel}</span>
          </div>

          {isLoading ? (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>На прошлой неделе никто не захватил сектор</div>
          ) : (
            <div className="rating-podium">
              {podiumOrder.map((entry) => (
                <PodiumItem key={entry.userId} entry={entry} rank={entry.rank as 1 | 2 | 3} onOpenUser={onOpenUser} enterDelayMs={STAGGER_DELAY_MS[entry.rank as 1 | 2 | 3]} />
              ))}
            </div>
          )}
        </div>

        {rest.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {rest.map((entry, i) => {
              const initials = entry.displayName.slice(0, 2).toUpperCase()
              return (
                <button
                  key={entry.userId}
                  className="terr-list-item"
                  style={{ borderBottom: i < rest.length - 1 ? '1px solid var(--line)' : 'none' }}
                  onClick={() => onOpenUser(entry.userId)}
                >
                  <div className="rating-list-rank">{entry.rank}</div>
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 12.5 }}>
                    {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{entry.displayName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--accent)' }}>{entry.sectorsThisWeek} {pluralSectors(entry.sectorsThisWeek)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{entry.catchesThisWeek} {pluralCatches(entry.catchesThisWeek)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <button className="btn-primary" style={{ marginTop: 18 }} onClick={onOpenCurrentRating}>
          Перейти к текущему рейтингу
        </button>
      </div>
    </>
  )
}
