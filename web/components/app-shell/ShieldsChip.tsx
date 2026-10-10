'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSlotState } from '@/lib/supabase/queries'
import { hapticTap } from '@/lib/telegram/haptics'

// Same as the server's reserve cap (spin_slots: a 4th shield turns into coins).
export const SHIELD_RESERVE_MAX = 3

export const SHIELD_PATH = 'M12 2.5 19.5 5.3V11c0 4.6-3.2 8.2-7.5 10.5C7.7 19.2 4.5 15.6 4.5 11V5.3z'

// Shields waiting in the reserve, in the map's top panel next to «×2» — they
// used to be a line on the slots screen, far from the sectors they're for.
// A tap says how many, what a shield does and where to put it.
export function ShieldsChip() {
  const { data: state } = useSlotState()
  const [open, setOpen] = useState(false)
  const count = state?.freeShields ?? 0
  if (count === 0) return null
  return (
    <>
      <button
        type="button"
        data-tour="shields"
        className="shields-chip tap-scale"
        aria-label={`Щитов в запасе: ${count} из ${SHIELD_RESERVE_MAX}`}
        onClick={() => {
          hapticTap()
          setOpen(true)
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d={SHIELD_PATH} />
        </svg>
        <b>{count}</b>
      </button>
      {open && <ShieldReserveModal count={count} onClose={() => setOpen(false)} />}
    </>
  )
}

function ShieldReserveModal({ count, onClose }: { count: number; onClose: () => void }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card shield-modal reserve-modal" role="dialog" aria-label="Щиты в запасе" onClick={(e) => e.stopPropagation()}>
        <ShieldReserveContent count={count} />
        <button className="btn-primary" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>,
    document.body
  )
}

// The sheet's body — also the «Щиты» tab of the combined «×2 · щиты» sheet
// (HudBoosts).
// Built like the «×2» tab (DoubleCoinsContent), in the shield's teal: the
// reserve as a ring of three around a shield, the count big, what a shield
// does as chips, then how to put one up.
const RING_R = 58
const RING_C = 2 * Math.PI * RING_R
const SEG_GAP = 14

export function ShieldReserveContent({ count }: { count: number }) {
  const seg = RING_C / SHIELD_RESERVE_MAX - SEG_GAP
  return (
    <>
      <div className="double-modal-hero" aria-hidden>
        <svg className="double-modal-ring" width="140" height="140" viewBox="0 0 140 140">
          <defs>
            <linearGradient id="reserve-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5FD3C0" />
              <stop offset="1" stopColor="#0E8074" />
            </linearGradient>
          </defs>
          {Array.from({ length: SHIELD_RESERVE_MAX }, (_, i) => (
            <circle
              key={i}
              className={`reserve-ring-seg${i < count ? ' full' : ''}`}
              cx="70"
              cy="70"
              r={RING_R}
              fill="none"
              stroke={i < count ? 'url(#reserve-ring-grad)' : 'rgba(14,128,116,.14)'}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${seg} ${RING_C - seg}`}
              transform={`rotate(${-90 + (360 / SHIELD_RESERVE_MAX) * i + ((SEG_GAP / RING_C) * 360) / 2} 70 70)`}
              style={{ animationDelay: `${0.12 + i * 0.12}s` }}
            />
          ))}
        </svg>
        <div className="double-modal-coin reserve-modal-coin">
          <svg width="46" height="46" viewBox="0 0 24 24" aria-hidden>
            <path d={SHIELD_PATH} />
          </svg>
        </div>
        <div className="double-modal-badge reserve-modal-badge">24 ч</div>
      </div>

      <div className="modal-title double-modal-title">Щиты в запасе</div>

      <div className="double-modal-timer reserve-modal-timer">
        <b>
          {count}
          <small>из {SHIELD_RESERVE_MAX}</small>
        </b>
        <span>{count > 0 ? 'можно поставить на свой сектор' : 'щиты выпадают в слотах'}</span>
      </div>

      <div className="double-modal-what reserve-modal-what">
        <div className="double-modal-kicker">Щит на твоём секторе</div>
        <div className="double-modal-chips">
          <span>24 часа</span>
          <span>Соклановцы ловят</span>
          <span>Чужой улов не в счёт</span>
        </div>
      </div>
      <div className="double-modal-note reserve-modal-note">
        <b>Поставить — «Поставить щит» на экране своего сектора</b>
        На горячий сектор щит не ставится. Новые щиты выпадают в слотах — «3 соты».
      </div>
    </>
  )
}
