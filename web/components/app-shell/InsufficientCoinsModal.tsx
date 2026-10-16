'use client'

import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { tn } from '@/lib/i18n/runtime'

// Shared across every buy flow (Shop items/buffs, sector shield, challenge
// swap/extra-slot) — a disabled button alone never explained WHY a purchase
// didn't go through, so this is deliberately a blocking modal, not a toast.
// Always portals to <body> as a defensive default — see RefundConfirmModal.tsx's
// note: a plain inline .modal-overlay can get trapped off-viewport by any
// ancestor that turns out to establish a containing block for
// position:fixed (a CSS transform, e.g.), and a portal sidesteps that
// regardless of which screen ends up using this.
export function InsufficientCoinsModal({ price, coins, onClose }: { price: number; coins: number; onClose: () => void }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{tn('needCoins.title')}</div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {tn('needCoins.need')} <CoinIcon size={16} /> {price}{tn('needCoins.have')} <CoinIcon size={16} /> {coins}.
        </div>
        <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
          {tn('needCoins.earn')}
        </div>
        <button className="btn-primary" style={{ marginTop: 14 }} onClick={onClose}>
          {tn('common.gotIt')}
        </button>
      </div>
    </div>,
    document.body
  )
}
