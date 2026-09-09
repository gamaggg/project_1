'use client'

import { cloneElement, useMemo, type ReactElement } from 'react'
import type { Achievement } from '@/lib/data/achievements'
import { ACH_ICONS } from '@/components/app-shell/icons'
import { HexBadge } from '@/components/app-shell/HexBadge'

const CONFETTI_COLORS = ['#FF6B6B', '#FB6A16', '#B5E254', '#4CC9F0', '#E63946', '#7EF5A0', '#EEAAE3', '#A88EF5', '#FFD60A']

// Rendered by FishZoneApp (see useAchievementUnlock) as soon as a fresh catch/
// follower/territory change pushes an achievement past its unlock condition —
// same overlay-at-app-level pattern as DeleteCatchModal, for the same reason
// (a screen's own .screen-inner scrolls, see DECISIONS.md).
export function AchievementUnlockedModal({
  achievement,
  onClose,
  onShowToast,
}: {
  achievement: Achievement
  onClose: () => void
  onShowToast: (msg: string) => void
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
    [achievement.icon]
  )

  async function handleShare() {
    const text = `🏆 Я получил достижение «${achievement.title}» в RANGE!\n${achievement.desc}\n\nПрисоединяйся и сразимся за территории на побережье Батуми 🎣\n${window.location.origin}`
    try {
      await navigator.clipboard.writeText(text)
      onShowToast('Скопировано в буфер обмена')
    } catch {
      onShowToast('Не удалось скопировать')
    }
  }

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
        <div className="unlock-modal-eyebrow">Достижение открыто</div>
        <div className="unlock-modal-badge">
          <HexBadge
            unlocked
            strokeWidth={3}
            icon={cloneElement(ACH_ICONS[achievement.icon] as ReactElement<{ width: number; height: number }>, { width: 38, height: 38 })}
          />
        </div>
        <div className="modal-title">{achievement.title}</div>
        <div className="modal-body" style={{ marginBottom: 22 }}>
          {achievement.desc}
        </div>
        <button className="btn-primary" onClick={handleShare}>
          Поделиться
        </button>
        <button className="unlock-modal-close tap-scale" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
