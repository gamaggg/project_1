'use client'

import { cloneElement, useMemo, type ReactElement } from 'react'
import { HexBadge } from '@/components/app-shell/HexBadge'
import { ACH_ICONS } from '@/components/app-shell/icons'
import type { WeeklyLeaderboardEntry } from '@/lib/data/types'
import { CITIES, type CityId } from '@/lib/data/city'
import { pluralCatches, pluralSectors } from '@/lib/format'
import { seededRandom, seedFrom } from '@/lib/seededRandom'
import { tn } from '@/lib/i18n/runtime'

const CONFETTI_COLORS = ['#FC5200', '#F0A93E', '#B8C0CC', '#B06B36', '#FFD60A']

// Same overlay-at-app-level + confetti-burst recipe as AchievementUnlockedModal
// (see DECISIONS.md on why modals live at the FishZoneApp level) — shown once
// per week (see useWeekTopModal): the congratulations for a player of last week's top 10 of the city on
// screen, and for anyone else (`entry` null) a note on who led that city.
export function WeekTopModal({
  entry,
  leader,
  city,
  onViewRecap,
  onClose,
}: {
  entry: WeeklyLeaderboardEntry | null
  leader: WeeklyLeaderboardEntry
  city: CityId
  onViewRecap: () => void
  onClose: () => void
}) {
  const confetti = useMemo(() => {
    const rand = seededRandom(seedFrom((entry ?? leader).userId))
    return Array.from({ length: 16 }, (_, i) => {
      const angle = rand() * Math.PI * 2
      const dist = 70 + rand() * 90
      return {
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 10 + rand() * 40,
        rot: rand() * 480 - 240,
        delay: rand() * 0.2,
      }
    })
  }, [entry, leader])
  const shown = entry ?? leader
  const stats = tn('weekly.stats', { sectors: `${shown.sectorsThisWeek} ${pluralSectors(shown.sectorsThisWeek)}`, catches: `${shown.catchesThisWeek} ${pluralCatches(shown.catchesThisWeek)}` })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="unlock-modal-card" onClick={(e) => e.stopPropagation()}>
        {entry && <div className="unlock-modal-confetti">
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
        </div>}
        <div className="unlock-modal-eyebrow">{entry ? tn('weekly.topEyebrow') : tn('weekly.cityEyebrow')}</div>
        <div className="unlock-modal-badge-outer">
          <div className="unlock-modal-badge-glow" />
          <div className="unlock-modal-badge">
            <HexBadge unlocked strokeWidth={3} icon={cloneElement(ACH_ICONS.first as ReactElement<{ width: number; height: number }>, { width: 38, height: 38 })} />
          </div>
        </div>
        <div className="modal-title">{entry ? tn('weekly.congrats') : tn('weekly.cityTitle', { city: CITIES[city].name })}</div>
        <div className="modal-body" style={{ marginBottom: 22 }}>
          {entry ? (
            <>
              {tn('weekly.lastWeekRank', { rank: entry.rank })}
              <br />
              {stats}
            </>
          ) : (
            tn('weekly.cityLeader', { name: leader.displayName, stats })
          )}
        </div>
        <button className="btn-primary" onClick={onViewRecap}>
          {tn('weekly.viewRecap')}
        </button>
        <button className="unlock-modal-close tap-scale" onClick={onClose}>
          {tn('common.close')}
        </button>
      </div>
    </div>
  )
}
