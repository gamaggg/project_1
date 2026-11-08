'use client'

import { useState } from 'react'
import { useMaintenance, useSetMaintenance } from '@/lib/supabase/queries/maintenance'

// «Технические работы» in the super admin's «Управление»: turns the maintenance screen on and off for every player
// (the super admin keeps using the app). An optional line for the players shows under the usual text. Admin tools are
// in Russian only, like the rest of the panel.
export function MaintenanceModal({ onClose }: { onClose: () => void }) {
  const { data } = useMaintenance()
  const set = useSetMaintenance()
  const on = !!data?.enabled
  const [message, setMessage] = useState(data?.message ?? '')
  const [error, setError] = useState<string | null>(null)
  const apply = (enabled: boolean) => {
    setError(null)
    set.mutate(
      { enabled, message: message.trim() || null },
      {
        onSuccess: onClose,
        onError: () => setError('Не получилось: проверь сеть или права и попробуй ещё раз.'),
      }
    )
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon" style={{ background: on ? 'linear-gradient(160deg,#FF6B6B,#D33 65%)' : 'linear-gradient(160deg,#FF8A3D,#FC5200 65%)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
          </svg>
        </div>
        <div className="modal-title">{on ? 'Заглушка включена' : 'Технические работы'}</div>
        <div className="modal-body">
          {on
            ? 'Игроки сейчас видят экран «Идут технические работы». Ты видишь приложение как обычно. Выключи, когда всё проверишь.'
            : 'Все игроки, кроме тебя, увидят экран «Идут технические работы» (в течение 30 секунд). Игра на сервере не останавливается: это только экран.'}
        </div>
        <label className="maintenance-modal-label">
          Строка для игроков (не обязательно)
          <textarea className="maintenance-modal-input" rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Например: вернёмся к 15:00 по Батуми" />
        </label>
        {error && <div className="maintenance-modal-error">{error}</div>}
        {on ? (
          <>
            <button className="btn-primary" disabled={set.isPending} onClick={() => apply(false)}>
              Выключить заглушку
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} disabled={set.isPending} onClick={() => apply(true)}>
              Сохранить строку
            </button>
          </>
        ) : (
          <button className="btn-danger" disabled={set.isPending} onClick={() => apply(true)}>
            Включить заглушку
          </button>
        )}
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
