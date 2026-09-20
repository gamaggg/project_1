'use client'

import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'

// The missing step between tapping a price tag and actually spending coins
// (previously every buy button mutated instantly, see ShopScreen/Challenges/
// TerritoryScreen). `InsufficientCoinsModal` still handles the "can't
// afford it" branch — this only ever renders once affordability is already
// confirmed, so the only two outcomes here are "buy" or "cancel". Always
// portals to <body> as a defensive default — see RefundConfirmModal.tsx's
// note: a plain inline .modal-overlay can get trapped off-viewport by any
// ancestor that turns out to establish a containing block for
// position:fixed (a CSS transform, e.g.), and a portal sidesteps that
// regardless of which screen ends up using this.
export function PurchaseConfirmModal({
  name,
  price,
  coins,
  busy,
  onConfirm,
  onClose,
}: {
  name: string
  price: number
  coins: number
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return createPortal(
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Купить «{name.replace(/[«»]/g, '')}»?</div>
        <div className="purchase-confirm-price">
          <CoinIcon size={28} />
          <b>{price}</b>
        </div>
        <div className="modal-body" style={{ margin: '10px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          Останется <CoinIcon size={16} /> {Math.max(0, coins - price)}
        </div>
        <button className="btn-primary" disabled={busy} onClick={onConfirm}>
          {busy ? 'Покупаем…' : 'Купить'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} disabled={busy} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>,
    document.body
  )
}
