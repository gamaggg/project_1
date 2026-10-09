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
        <div className="reserve-modal-shields" aria-hidden>
          {Array.from({ length: SHIELD_RESERVE_MAX }, (_, i) => (
            <span key={i} className={`reserve-modal-shield${i < count ? ' full' : ''}`} style={{ animationDelay: `${0.08 + i * 0.1}s` }}>
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
                <path d={SHIELD_PATH} />
              </svg>
            </span>
          ))}
        </div>
        <div className="modal-title shield-modal-title">Щиты в запасе</div>
        <div className="shield-modal-timer reserve-modal-count">
          <b>
            {count}
            <small>из {SHIELD_RESERVE_MAX}</small>
          </b>
        </div>
        <div className="reserve-modal-text">Щит закрывает твой сектор на 24 часа: чужой улов там не засчитается, а соклановцы ловить могут.</div>
        <div className="reserve-modal-how">
          Поставить — на экране своего сектора, кнопка <b>«Поставить щит»</b>. На горячий сектор щит не ставится.
        </div>
        <div className="reserve-modal-note">Новые щиты выпадают в слотах — «3 соты». В запасе помещается {SHIELD_RESERVE_MAX}.</div>
        <button className="btn-primary" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>,
    document.body
  )
}
