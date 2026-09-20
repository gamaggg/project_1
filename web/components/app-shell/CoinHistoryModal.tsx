'use client'

import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useMyCoinTransactions, useAdminUserCoinTransactions } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'

// The shop hero balance's "История" link — every coin-mutating RPC now logs
// a row to coin_transactions (see that migration), so this is a plain read
// of the caller's own history via RLS. Portalled to <body> like every other
// admin/shop modal in the app, for the same reason: a plain inline
// .modal-overlay can get trapped off-viewport by an ancestor that turns out
// to establish a containing block for position:fixed.
//
// userId/displayName (GrantCoinsModal's "История" button) switch this to a
// super admin looking at someone ELSE's ledger — coin_transactions' RLS only
// exposes the caller's own rows, so that path goes through
// admin_get_user_coin_transactions instead of the plain own-history query.
export function CoinHistoryModal({ userId, displayName, onClose }: { userId?: string; displayName?: string; onClose: () => void }) {
  const own = useMyCoinTransactions()
  const admin = useAdminUserCoinTransactions(userId ?? null)
  const { data: transactions = [], isLoading } = userId ? admin : own

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide coin-history-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{userId ? `История — ${displayName}` : 'История списаний'}</div>
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
