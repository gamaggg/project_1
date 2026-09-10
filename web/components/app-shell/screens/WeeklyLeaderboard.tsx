'use client'

import { useState } from 'react'
import { useWeeklyLeaderboard } from '@/lib/supabase/queries'
import type { WeeklyLeaderboardEntry } from '@/lib/data/types'
import { formatWeekOfMonth, pluralCatches, pluralSectors } from '@/lib/format'

type Scope = 'all' | 'friends'

const MEDAL_COLOR: Record<1 | 2 | 3, string> = {
  1: '#F0A93E',
  2: '#B8C0CC',
  3: '#B06B36',
}

function Crown() {
  return (
    <svg className="rating-podium-crown" viewBox="0 0 32 26" fill="none" aria-hidden="true">
      <path d="M4 11L9 15L16 4L23 15L28 11L26 21H6L4 11Z" fill="#F0A93E" stroke="#FFFCF5" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="9" cy="15" r="1.6" fill="#FFE7BE" />
      <circle cx="16" cy="4" r="1.8" fill="#FFE7BE" />
      <circle cx="23" cy="15" r="1.6" fill="#FFE7BE" />
    </svg>
  )
}

function PodiumAvatar({ entry, rank }: { entry: WeeklyLeaderboardEntry; rank: 1 | 2 | 3 }) {
  const size = rank === 1 ? 88 : 72
  const initials = entry.displayName.slice(0, 2).toUpperCase()
  return (
    <div className="rating-podium-stage">
      {/* Rank 1 gets a floating bob — the shadow lives outside the moving
          wrap so it stays "on the ground" while the avatar rises above it. */}
      {rank === 1 && <div className="rating-podium-shadow" />}
      <div className={`rating-podium-avatar-wrap${rank === 1 ? ' rating-podium-float' : ''}`} style={{ width: size, height: size }}>
        <div className="rating-podium-glow" style={{ background: MEDAL_COLOR[rank] }} />
        {rank === 1 && <Crown />}
        <div className="avatar" style={{ width: size, height: size, fontSize: rank === 1 ? 24 : 19, border: '3px solid var(--surface)', position: 'relative', zIndex: 2 }}>
          {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : initials}
        </div>
        <div className="rating-podium-medal" style={{ background: `linear-gradient(160deg, ${MEDAL_COLOR[rank]}, ${MEDAL_COLOR[rank]}CC)` }}>
          {rank}
        </div>
      </div>
    </div>
  )
}

// enterDelayMs: undefined renders at rest instantly (the live current-week
// podium). Passing a number adds the ceremony pop-in, delayed by that much —
// used by LastWeekScreen to reveal 3rd -> 2nd -> 1st in sequence.
export function PodiumItem({
  entry,
  rank,
  onOpenUser,
  enterDelayMs,
}: {
  entry: WeeklyLeaderboardEntry
  rank: 1 | 2 | 3
  onOpenUser: (id: string) => void
  enterDelayMs?: number
}) {
  return (
    <button
      className={`rating-podium-item${rank === 1 ? ' rank-1' : ''}${enterDelayMs !== undefined ? ' rating-podium-item-enter' : ''}`}
      style={enterDelayMs !== undefined ? { animationDelay: `${enterDelayMs}ms` } : undefined}
      onClick={() => onOpenUser(entry.userId)}
    >
      <PodiumAvatar entry={entry} rank={rank} />
      <div className="rating-podium-name">{entry.displayName}</div>
      <div className="rating-podium-stat-main">{entry.sectorsThisWeek} {pluralSectors(entry.sectorsThisWeek)}</div>
      <div className="rating-podium-stat-sub">{entry.catchesThisWeek} {pluralCatches(entry.catchesThisWeek)}</div>
    </button>
  )
}

export function WeeklyLeaderboard({ onOpenUser }: { onOpenUser: (id: string) => void }) {
  const [scope, setScope] = useState<Scope>('all')
  const { data: entries = [], isLoading } = useWeeklyLeaderboard(scope === 'friends')

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3, 10)
  // Reference screenshot puts #1 in the middle: reorder the podium row
  // without touching rank numbers, which stay tied to each entry.
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium

  return (
    <>
      <div className="filter-row">
        <div className={`filter-chip${scope === 'all' ? ' active' : ''}`} onClick={() => setScope('all')}>
          Все
        </div>
        <div className={`filter-chip${scope === 'friends' ? ' active' : ''}`} onClick={() => setScope('friends')}>
          Друзья
        </div>
        <span className="rating-week-badge rating-week-badge-inline">{formatWeekOfMonth(0)}</span>
      </div>

      {isLoading ? (
        <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>
          {scope === 'friends' ? 'Никто из тех, на кого ты подписан, ещё не рыбачил на этой неделе' : 'На этой неделе пока никто не захватил сектор — начни первым'}
        </div>
      ) : (
        <>
          <div className="rating-podium">
            {podiumOrder.map((entry) => (
              <PodiumItem key={entry.userId} entry={entry} rank={entry.rank as 1 | 2 | 3} onOpenUser={onOpenUser} />
            ))}
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
        </>
      )}
    </>
  )
}
