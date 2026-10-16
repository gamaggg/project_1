'use client'

import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { tn } from '@/lib/i18n/runtime'

// The super-admin "undo a purchase" confirm step — owned/active items in the
// Shop's own cards and buff rows (ShopScreen.tsx), refunding right where the
// admin spotted them rather than through a separate profile-level list.
// Always portals to <body> as a defensive default: a plain inline
// .modal-overlay can get trapped off-viewport by any ancestor that turns
// out to establish a containing block for position:fixed (a CSS transform,
// e.g. — this bit a now-removed ProfileScreen call site earlier), and a
// portal sidesteps that regardless of which screen ends up using this.
export function RefundConfirmModal({
  label,
  price,
  busy,
  onConfirm,
  onClose,
}: {
  label: string
  price: number
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return createPortal(
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{tn('refund.title', { name: label.replace(/[«»]/g, '') })}</div>
        <div className="modal-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
          {tn('refund.before')} <CoinIcon size={16} /> {price}{tn('refund.after')}
        </div>
        <button className="btn-primary" disabled={busy} onClick={onConfirm}>
          {busy ? tn('refund.refunding') : tn('refund.refund')}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} disabled={busy} onClick={onClose}>
          {tn('common.cancel')}
        </button>
      </div>
    </div>,
    document.body
  )
}
