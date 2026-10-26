'use client'

import { createPortal } from 'react-dom'
import { tn } from '@/lib/i18n/runtime'

// Portalled to <body> like every other modal in the app (see CoinHistoryModal
// for why: a plain inline .modal-overlay can get trapped off-viewport by an
// ancestor that turns out to establish a containing block for
// position:fixed) — opened from NameStep's "условия использования" link
// during onboarding, but self-contained enough to reuse anywhere else later.
// [section number, paragraph count] — the texts are in the dictionary (terms.s{n}t, terms.s{n}p{i}).
const SECTIONS: [number, number][] = [
  [1, 1],
  [2, 1],
  [3, 2],
  [4, 3],
  [5, 3],
  [6, 3],
  [7, 1],
  [8, 2],
  [9, 1],
  [10, 1],
  [11, 1],
]

export function TermsOfUseModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide terms-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{tn('terms.title')}</div>
        <div className="terms-modal-updated">{tn('terms.updated')}</div>
        <div className="terms-modal-body">
          {SECTIONS.map(([n, count]) => (
            <div className="terms-section" key={n}>
              <div className="terms-section-title">{tn(`terms.s${n}t` as 'terms.s1t')}</div>
              {Array.from({ length: count }, (_, i) => (
                <p key={i}>{tn(`terms.s${n}p${i + 1}` as 'terms.s1p1')}</p>
              ))}
            </div>
          ))}
        </div>
        <button className="btn-secondary" style={{ marginTop: 14 }} onClick={onClose}>
          {tn('common.close')}
        </button>
      </div>
    </div>,
    document.body
  )
}
