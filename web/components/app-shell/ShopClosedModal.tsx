'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMaintenance, useSetShopClosed } from '@/lib/supabase/queries/maintenance'

// «Заглушка магазина» in the super admin's «Управление» (25.11.2026): closes the Shop for every player — they see
// «Магазин обновляется» — while the super admin keeps the real Shop, to check a release live before players get it.
// Only a screen, like «Технические работы»: the Shop's functions keep working on the server. Admin tools are Russian only.
export function ShopClosedModal({ onClose }: { onClose: () => void }) {
  const { data } = useMaintenance()
  const set = useSetShopClosed()
  const on = !!data?.shopClosed
  const [error, setError] = useState<string | null>(null)
  const apply = (closed: boolean) => {
    setError(null)
    set.mutate(closed, {
      onSuccess: onClose,
      onError: () => setError('Не получилось: проверь сеть или права и попробуй ещё раз.'),
    })
  }
  // Into <body>: drawn inside the profile screen, whose wrapper is moved by the screen animation, the fixed overlay
  // blurred the page but the card itself ended up off the screen (25.11.2026).
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon" style={{ background: on ? 'linear-gradient(160deg,#FF6B6B,#D33 65%)' : 'linear-gradient(160deg,#FFC93C,#F59B0B 65%)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h16l-1.2 10.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
            <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
          </svg>
        </div>
        <div className="modal-title">{on ? 'Магазин закрыт заглушкой' : 'Заглушка магазина'}</div>
        <div className="modal-body">
          {on
            ? 'Игроки сейчас видят «Магазин обновляется». Ты видишь магазин как обычно. Открой, когда всё проверишь.'
            : 'Все игроки, кроме тебя, вместо магазина увидят «Магазин обновляется» (в течение 5 минут, а кто вернётся в приложение — сразу). Слоты и бокс открываются из магазина, они тоже закроются. Это только экран: на сервере ничего не останавливается.'}
        </div>
        {error && <div className="maintenance-modal-error">{error}</div>}
        {on ? (
          <button className="btn-primary" disabled={set.isPending} onClick={() => apply(false)}>
            Открыть магазин
          </button>
        ) : (
          <button className="btn-danger" disabled={set.isPending} onClick={() => apply(true)}>
            Закрыть магазин заглушкой
          </button>
        )}
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>,
    document.body
  )
}
