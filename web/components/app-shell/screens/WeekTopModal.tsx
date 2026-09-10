'use client'

import { cloneElement, useMemo, type ReactElement } from 'react'
import { HexBadge } from '@/components/app-shell/HexBadge'
import { ACH_ICONS } from '@/components/app-shell/icons'
import type { WeeklyLeaderboardEntry } from '@/lib/data/types'
import { pluralCatches, pluralSectors } from '@/lib/format'

const CONFETTI_COLORS = ['#FC5200', '#F0A93E', '#B8C0CC', '#B06B36', '#FFD60A']

// Same overlay-at-app-level + confetti-burst recipe as AchievementUnlockedModal
// (see DECISIONS.md on why modals live at the FishZoneApp level) — shown once
// per week to anyone who lands in last week's top 10 (see useWeekTopModal).
export function WeekTopModal({
  entry,
  onViewRecap,
  onClose,
}: {
  entry: WeeklyLeaderboardEntry
  onViewRecap: () => void
  onClose: () => void
}) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2
        const dist = 70 + Math.random() * 90
        return {
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist - 10 + Math.random() * 40,
          rot: Math.random() * 480 - 240,
          delay: Math.random() * 0.2,
        }
      }),
    [entry.userId]
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="unlock-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="unlock-modal-confetti">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="unlock-confetti-piece"
              style={
                {
                  '--c': c.color,
                  '--tx': `${c.tx}px`,
                  '--ty': `${c.ty}px`,
                  '--rot': `${c.rot}deg`,
                  animationDelay: `${c.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="unlock-modal-eyebrow">Топ недели</div>
        <div className="unlock-modal-badge-outer">
          <div className="unlock-modal-badge-glow" />
          <div className="unlock-modal-badge">
            <HexBadge unlocked strokeWidth={3} icon={cloneElement(ACH_ICONS.first as ReactElement<{ width: number; height: number }>, { width: 38, height: 38 })} />
          </div>
        </div>
        <div className="modal-title">Поздравляем!</div>
        <div className="modal-body" style={{ marginBottom: 22 }}>
          Прошлая неделя — {entry.rank} место
          <br />
          {entry.sectorsThisWeek} {pluralSectors(entry.sectorsThisWeek)} и {entry.catchesThisWeek} {pluralCatches(entry.catchesThisWeek)}
        </div>
        <button className="btn-primary" onClick={onViewRecap}>
          Смотреть итоги недели
        </button>
        <button className="unlock-modal-close tap-scale" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
