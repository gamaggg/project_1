'use client'

import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useMyCoinTransactions } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'

// The shop hero balance's "История" link — every coin-mutating RPC now logs
// a row to coin_transactions (see that migration), so this is a plain read
// of the caller's own history via RLS. Portalled to <body> like every other
// admin/shop modal in the app, for the same reason: a plain inline
// .modal-overlay can get trapped off-viewport by an ancestor that turns out
// to establish a containing block for position:fixed.
export function CoinHistoryModal({ onClose }: { onClose: () => void }) {
  const { data: transactions = [], isLoading } = useMyCoinTransactions()

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide coin-history-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">История списаний</div>
        <div className="coin-history-list">
          {isLoading && <div className="coin-history-empty">Загружаем…</div>}
          {!isLoading && transactions.length === 0 && <div className="coin-history-empty">Пока пусто — здесь появятся покупки и начисления.</div>}
          {transactions.map((t) => (
            <div className="coin-history-row" key={t.id}>
              <div className="coin-history-row-main">
                <div className="coin-history-label">{t.label}</div>
                <div className="coin-history-when">{formatWhen(t.createdAt)}</div>
              </div>
              <div className={`coin-history-amount${t.amount > 0 ? ' positive' : ''}`}>
                {t.amount > 0 ? '+' : ''}
                {t.amount}
                <CoinIcon size={16} />
              </div>
            </div>
          ))}
        </div>
        <button className="btn-secondary" style={{ marginTop: 14 }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>,
    document.body
  )
}
