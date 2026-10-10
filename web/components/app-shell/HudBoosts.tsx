'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DoubleCoinsChip, DoubleCoinsContent, useDoubleCoins } from '@/components/app-shell/DoubleCoinsChip'
import { SHIELD_PATH, ShieldReserveContent, ShieldsChip } from '@/components/app-shell/ShieldsChip'
import { useSlotState } from '@/lib/supabase/queries'
import { hapticTap } from '@/lib/telegram/haptics'

// «×2» and the shields in the reserve, in the map's top panel. A player with
// both gets one button of two equal halves — two pills pushed the «Игроки /
// Кланы» switch off the bar — and one sheet with both, as two tabs.
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
        data-tour="boosts"
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
      {open && <BoostsModal from={buff.from} until={buff.until} shields={shields} onClose={() => setOpen(false)} />}
    </>
  )
}

// Both sheets in one, as tabs: «×2» first, «Щиты» beside it — each tab is the
// same sheet its own chip opens, card colours and all.
function BoostsModal({ from, until, shields, onClose }: { from: number; until: number; shields: number; onClose: () => void }) {
  const [tab, setTab] = useState<'double' | 'shields'>('double')
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-card boosts-modal ${tab === 'double' ? 'double-modal' : 'shield-modal reserve-modal'}`}
        role="dialog"
        aria-label="Твои бонусы"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="boosts-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'double'} className={`boosts-tab gold${tab === 'double' ? ' on' : ''}`} onClick={() => setTab('double')}>
            ×2 монеты
          </button>
          <button type="button" role="tab" aria-selected={tab === 'shields'} className={`boosts-tab teal${tab === 'shields' ? ' on' : ''}`} onClick={() => setTab('shields')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d={SHIELD_PATH} />
            </svg>
            Щиты · {shields}
          </button>
        </div>
        {/* Both tabs in one cell: the open one shown, the other laid out
            invisibly under it — the sheet is as tall as the taller of the
            two, so it doesn't jump when the tab changes. */}
        <div className="boosts-tab-stack">
          <div key={tab} className="boosts-tab-body">
            {tab === 'double' ? <DoubleCoinsContent from={from} until={until} /> : <ShieldReserveContent count={shields} />}
          </div>
          <div className="boosts-tab-sizer" aria-hidden>
            {tab === 'double' ? <ShieldReserveContent count={shields} /> : <DoubleCoinsContent from={from} until={until} />}
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
