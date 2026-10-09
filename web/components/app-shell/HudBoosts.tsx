'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DoubleCoinsChip, useDoubleCoins } from '@/components/app-shell/DoubleCoinsChip'
import { SHIELD_PATH, SHIELD_RESERVE_MAX, ShieldsChip } from '@/components/app-shell/ShieldsChip'
import { useSlotState } from '@/lib/supabase/queries'
import { useNow } from '@/lib/useNow'
import { hapticTap } from '@/lib/telegram/haptics'

// «×2» and the shields in the reserve, in the map's top panel. A player with
// both gets one button of two equal halves — two pills pushed the «Игроки /
// Кланы» switch off the bar — and one sheet with both inside.
export function HudBoosts() {
  const buff = useDoubleCoins()
  const { data: slots } = useSlotState()
  const shields = slots?.freeShields ?? 0
  const [open, setOpen] = useState(false)
  if (!buff || shields === 0) {
    return (
      <>
        <DoubleCoinsChip />
        <ShieldsChip />
      </>
    )
  }
  return (
    <>
      <button
        type="button"
        className="hud-boosts tap-scale"
        aria-label={`Двойные монеты и щиты в запасе: ${shields}`}
        onClick={() => {
          hapticTap()
          setOpen(true)
        }}
      >
        <span className="hud-boosts-double">×2</span>
        <span className="hud-boosts-shields">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d={SHIELD_PATH} />
          </svg>
          {shields}
        </span>
      </button>
      {open && <BoostsModal until={buff.until} shields={shields} onClose={() => setOpen(false)} />}
    </>
  )
}

function BoostsModal({ until, shields, onClose }: { until: number; shields: number; onClose: () => void }) {
  const now = useNow(30_000)
  const minutes = Math.max(1, Math.ceil(Math.max(0, until - now) / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card boosts-modal" role="dialog" aria-label="Твои бонусы" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Твои бонусы</div>

        <div className="boosts-section gold">
          <div className="boosts-head">
            <span className="boosts-badge gold">×2</span>
            <div>
              <b>Двойные монеты</b>
              <span>
                ещё {h > 0 ? `${h} ч ` : ''}
                {m} мин
              </span>
            </div>
          </div>
          <div className="boosts-text">Вдвое больше монет за уловы, захваты, челленджи, достижения и награды клана. На горячем секторе улов — ×3.</div>
        </div>

        <div className="boosts-section teal">
          <div className="boosts-head">
            <span className="boosts-badge teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                <path d={SHIELD_PATH} />
              </svg>
            </span>
            <div>
              <b>
                Щиты в запасе: {shields} из {SHIELD_RESERVE_MAX}
              </b>
              <span>щит закрывает сектор на 24 часа</span>
            </div>
          </div>
          <div className="boosts-text">
            Поставить — на экране своего сектора, кнопка «Поставить щит». На горячий сектор щит не ставится.
          </div>
        </div>

        <button className="btn-primary" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>,
    document.body
  )
}
