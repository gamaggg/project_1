'use client'

import type { CSSProperties } from 'react'
import type { Achievement } from '@/lib/data/achievements'
import { ACH_ICONS } from '@/components/app-shell/icons'

// How far along a locked achievement is, 0..1, from its «3/5» progress string.
export function achievementFraction(a: Pick<Achievement, 'unlocked' | 'progress'>): number {
  if (a.unlocked) return 1
  const m = a.progress?.match(/(\d+)\s*\/\s*(\d+)/)
  if (!m || +m[2] === 0) return 0
  return Math.max(0, Math.min(1, +m[1] / +m[2]))
}

// One tile of the achievements grid — the profile preview, someone else's
// profile and the full list all draw it the same way: a hexagon that glows when
// the achievement is open, a sheen that sweeps over it once, and for a closed
// one a small progress bar instead of a bare «2/5».
export function AchievementCard({ a, index = 0, onOpen }: { a: Achievement; index?: number; onOpen: () => void }) {
  const f = achievementFraction(a)
  return (
    <div
      className={`ach-card${a.unlocked ? '' : ' locked'}`}
      onClick={onOpen}
      style={{ animationDelay: `${index * 50}ms`, '--i': index } as CSSProperties}
    >
      <div className="ach-icon-wrap">
        <div className={`ach-icon hex-aspect hex-shape ${a.unlocked ? 'on' : 'off'}`}>{ACH_ICONS[a.icon]}</div>
        {a.unlocked && <span className="ach-icon-sheen hex-shape hex-aspect" aria-hidden />}
      </div>
      <div className="ach-text">
        <div className="ach-title">{a.title}</div>
        <div className="ach-desc">{a.desc}</div>
        {!a.unlocked && a.progress && (
          <div className="ach-progress-row">
            <div className="ach-bar" aria-hidden>
              <i style={{ transform: `scaleX(${f})` }} />
            </div>
            <span className="ach-progress">{a.progress}</span>
          </div>
        )}
      </div>
    </div>
  )
}
