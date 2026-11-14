'use client'

import '@/app/partner-points.css'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAdminPartnerAccessOf, useAdminPartnerPoints, useSetPartnerViewer } from '@/lib/supabase/queries'
import { CITIES } from '@/lib/data/city'

// The super admin, on a player's profile: «Статистика точки партнёра» — which partner points this player (the partner
// with their own RANGE account) may see the statistics of. A switch per point; the player then finds «Статистика
// точки» in their own profile. Every switch is written to «Последние действия».
export function PartnerAccessSheet({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { data: points = [], isLoading } = useAdminPartnerPoints(true)
  const { data: access = [], isLoading: accessLoading } = useAdminPartnerAccessOf(userId)
  const set = useSetPartnerViewer()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet ppx-sheet" role="dialog" aria-label="Статистика точки партнёра" onClick={(e) => e.stopPropagation()}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">Статистика точки партнёра</div>
            <div className="move-title">Что может видеть {name}</div>
          </div>
        </div>
        <div className="move-body">
          <div className="stats-note" style={{ marginTop: 0 }}>
            Включите точку — у игрока в профиле появится кнопка «Статистика точки»: нажатия на метку, открытия карточки, промокод, маршрут,
            звонки, сайт. Выключить можно в любой момент.
          </div>
          {(isLoading || accessLoading) && <div className="stats-note">Загружаем…</div>}
          {!isLoading && points.length === 0 && <div className="stats-note">Точек партнёров пока нет.</div>}
          {points.map((p) => {
            const on = access.includes(p.id)
            return (
              <label key={p.id} className="ppx-row">
                <span className="ppx-main">
                  <b>{p.name}</b>
                  <span>
                    {CITIES[p.city].name} · {p.plan === 'partner' ? 'Партнёр' : 'Старт'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="ppx-switch"
                  checked={on}
                  disabled={busy === p.id}
                  onChange={async () => {
                    setBusy(p.id)
                    setError(null)
                    try {
                      await set.mutateAsync({ pointId: p.id, userId, on: !on })
                    } catch {
                      setError('Не получилось, попробуй ещё раз')
                    } finally {
                      setBusy(null)
                    }
                  }}
                />
              </label>
            )
          })}
          {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}
          <button type="button" className="btn-secondary" style={{ margin: '16px 0 18px' }} onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
