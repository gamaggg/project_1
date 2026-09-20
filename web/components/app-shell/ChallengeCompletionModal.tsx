'use client'

import { cloneElement, useEffect, useMemo, type ReactElement } from 'react'
import { CoinCountUp } from '@/components/app-shell/CoinCountUp'
import { ACH_ICONS } from '@/components/app-shell/icons'
import { hapticSuccess } from '@/lib/telegram/haptics'

const CONFETTI_COLORS = ['#FF6B6B', '#FB6A16', '#B5E254', '#4CC9F0', '#E63946', '#7EF5A0', '#EEAAE3', '#A88EF5', '#FFD60A']

// Fires from ChallengesScreen the moment a screen-becomes-active refetch
// shows newly-completed challenges (see the id->completedAt diff there —
// sync_my_challenges only ever settles progress when this screen re-syncs).
// One component covers both the mid-week "2/3 done" nudge and the
// end-of-week "all done" celebration — same moment technically (a fresh
// completion just landed), but the two read very differently: the nudge
// stays a quick, low-key confirmation, while allDone is the one moment a
// whole week of effort actually pays off, so it gets the gold medal, the
// bigger confetti burst and a line that actually says "well done" instead
// of just restating the number.
export function ChallengeCompletionModal({
  doneCount,
  total,
  coinsEarned,
  coinsBefore,
  allDone,
  onClose,
}: {
  doneCount: number
  total: number
  coinsEarned: number
  coinsBefore: number
  allDone: boolean
  onClose: () => void
}) {
  const confetti = useMemo(
    () =>
      Array.from({ length: allDone ? 24 : 14 }, (_, i) => {
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
    [allDone]
  )

  useEffect(() => {
    hapticSuccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`unlock-modal-card${allDone ? ' challenge-complete-card-all' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="unlock-modal-confetti">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="unlock-confetti-piece"
              style={{ '--c': c.color, '--tx': `${c.tx}px`, '--ty': `${c.ty}px`, '--rot': `${c.rot}deg`, animationDelay: `${c.delay}s` } as React.CSSProperties}
            />
          ))}
        </div>
        {allDone ? (
          <>
            <div className="challenge-medal-outer">
              <div className="challenge-medal-glow" />
              <div className="challenge-medal">{cloneElement(ACH_ICONS.first as ReactElement<{ width: number; height: number }>, { width: 34, height: 34 })}</div>
            </div>
            <div className="unlock-modal-eyebrow">Неделя закрыта</div>
            <div className="modal-title challenge-complete-title-all">Все челленджи недели выполнены!</div>
            <div className="challenge-complete-sub">Три задания, ноль пропусков — вот это дисциплина 👏</div>
          </>
        ) : (
          <>
            <div className="unlock-modal-eyebrow">Задание выполнено</div>
            <div className="modal-title">{`${doneCount}/${total} заданий выполнено`}</div>
          </>
        )}
        <div className="challenge-complete-reward">
          <CoinCountUp from={coinsBefore} to={coinsBefore + coinsEarned} size={allDone ? 56 : 28} animated={false} />
        </div>
        <button className="btn-primary" style={{ marginTop: allDone ? 22 : 16 }} onClick={onClose}>
          Отлично
        </button>
      </div>
    </div>
  )
}
