'use client'

import { useState } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useAdminGrantCoins } from '@/lib/supabase/queries'

// Rendered by FishZoneApp itself, same reasoning as ChangeUserIdModal —
// super admin only. A plain number input rather than separate "grant"/
// "deduct" buttons: typing -50 deducts, admin_grant_coins clamps the
// result at 0 either way.
export function GrantCoinsModal({
  userId,
  displayName,
  currentCoins,
  onClose,
}: {
  userId: string
  displayName: string
  currentCoins: number
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const grantCoins = useAdminGrantCoins()
  const parsed = Number(amount)
  const valid = amount.trim() !== '' && Number.isInteger(parsed) && parsed !== 0

  async function handleConfirm() {
    if (!valid) return
    await grantCoins.mutateAsync({ userId, amount: parsed })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={grantCoins.isPending ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Монеты — {displayName}</div>
        <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Сейчас:
          <b style={{ color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CoinIcon size={16} /> {currentCoins}
          </b>
        </div>
        <div className="auth-field" style={{ marginTop: 12 }}>
          <label htmlFor="grant-coins-amount">Изменить на (можно отрицательное)</label>
          <input
            id="grant-coins-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^-\d]/g, ''))}
            inputMode="numeric"
            placeholder="например 100 или -50"
          />
        </div>
        {grantCoins.isError && (
          <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
            {grantCoins.error instanceof Error ? grantCoins.error.message : 'Не удалось сохранить'}
          </div>
        )}
        <button className="btn-primary" style={{ marginTop: 14 }} disabled={!valid || grantCoins.isPending} onClick={handleConfirm}>
          {grantCoins.isPending ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} disabled={grantCoins.isPending} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
