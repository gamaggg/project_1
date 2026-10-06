'use client'

import { useState } from 'react'
import { useAdminGrantSpins, useAdminSlotSpins } from '@/lib/supabase/queries'

// Super admin only, rendered by FishZoneApp next to GrantCoinsModal: gift
// slot spins to a player or to yourself. They don't burn at midnight and
// are spent after the day's own spins; the player sees them on the «Слоты»
// tab as a gift. A negative number takes gifted spins back (never below 0).
export function GrantSpinsModal({ userId, displayName, onClose }: { userId: string; displayName: string; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const { data: spins, isError: loadFailed } = useAdminSlotSpins(userId)
  const grantSpins = useAdminGrantSpins()
  const parsed = Number(amount)
  const valid = amount.trim() !== '' && Number.isInteger(parsed) && parsed !== 0 && Math.abs(parsed) <= 100

  async function handleConfirm() {
    if (!valid) return
    await grantSpins.mutateAsync({ userId, amount: parsed })
    onClose()
  }

  // Supabase errors are plain objects, not Error instances.
  const message = String((grantSpins.error as { message?: string } | null)?.message ?? '')

  return (
    <div className="modal-overlay" onClick={grantSpins.isPending ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Прокруты — {displayName}</div>
        <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
          {spins ? (
            <>
              Обычных на сегодня: <b style={{ color: 'var(--ink)' }}>{spins.dailyLeft} из {spins.dailyTotal}</b>
              <br />
              Подарочных: <b style={{ color: 'var(--ink)' }}>{spins.bonus}</b>
            </>
          ) : loadFailed ? (
            'Не получилось загрузить прокруты'
          ) : (
            'Загружаем…'
          )}
        </div>
        <div className="auth-field" style={{ marginTop: 12 }}>
          <label htmlFor="grant-spins-amount">Подарить прокрутов (минус — забрать подарочные)</label>
          <input
            id="grant-spins-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^-\d]/g, ''))}
            inputMode="numeric"
            placeholder="например 5 или -2, до 100"
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.4, color: 'var(--ink-faint)' }}>
          Подарочные не сгорают в конце дня и тратятся после обычных.
        </div>
        {grantSpins.isError && (
          <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
            {message.includes('SPINS:amount') ? 'От 1 до 100 за раз' : message || 'Не удалось сохранить'}
          </div>
        )}
        <button className="btn-primary" style={{ marginTop: 14 }} disabled={!valid || grantSpins.isPending} onClick={handleConfirm}>
          {grantSpins.isPending ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} disabled={grantSpins.isPending} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
