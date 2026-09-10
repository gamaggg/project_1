'use client'

import { useMemo } from 'react'
import type { UserAward } from '@/lib/data/types'
import { AWARD_ICONS, AWARD_COLOR } from '@/components/app-shell/awardIcons'

const CONFETTI_EXTRA = '#FC5200'

// Shown when tapping any medal in an AwardsRing — same overlay-at-app-level
// idea as AchievementUnlockedModal, but this one's purely a viewer (any
// visitor can open it, not just the owner, and it doesn't track "seen").
export function AwardDetailModal({ award, onClose }: { award: UserAward; onClose: () => void }) {
  const { color, colorHi } = AWARD_COLOR[award.kind]

  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2
        const dist = 60 + Math.random() * 70
        return {
          color: i % 3 === 0 ? color : i % 3 === 1 ? colorHi : CONFETTI_EXTRA,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist - 10,
          rot: Math.random() * 400 - 200,
          delay: Math.random() * 0.15,
        }
      }),
    [award.id, color, colorHi]
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="award-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="award-detail-confetti">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="award-detail-confetti-piece"
              style={{ '--c': c.color, '--tx': `${c.tx}px`, '--ty': `${c.ty}px`, '--rot': `${c.rot}deg`, animationDelay: `${c.delay}s` } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="award-detail-icon-wrap">
          <div className="award-detail-icon-glow" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
          <div className="award-detail-icon" style={{ background: `linear-gradient(160deg, ${colorHi}, ${color})` }}>
            {AWARD_ICONS[award.kind]}
          </div>
        </div>
        <div className="award-detail-title">{award.title}</div>
        <div className="award-detail-subtitle">{award.subtitle}</div>
        <div className="award-detail-desc">{award.description}</div>
        <button className="unlock-modal-close tap-scale" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
