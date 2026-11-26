'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { StarIcon } from '@/components/app-shell/StarsShop'
import { tn } from '@/lib/i18n/runtime'

// «Купить в Telegram» (26.11.2026): on the website and in the installed app a Stars purchase can't be paid, so the buy
// button opens this window. Its button opens RANGE in Telegram right at this product, signed in to this same account
// even if the person has never opened RANGE in Telegram (app/api/telegram/buy-link → the bot → app/api/auth/telegram/claim).
// The link is fetched when the window opens, so the button is a plain link the phone hands straight to Telegram.
export function BuyInTelegram({ productId, title, stars, onClose }: { productId: string; title?: string; stars?: number; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let gone = false
    fetch('/api/telegram/buy-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { url?: string }
        if (gone) return
        if (res.ok && body.url) setUrl(body.url)
        else setFailed(true)
      })
      .catch(() => !gone && setFailed(true))
    return () => {
      gone = true
    }
  }, [productId, attempt])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card buy-tg" onClick={(e) => e.stopPropagation()}>
        <div className="buy-tg-icon" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff">
            <path d="M21.4 4.3 18.3 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.5 13 2 11.6c-1-.3-1-1 .2-1.5L20 3.2c.8-.3 1.6.2 1.4 1.1z" />
          </svg>
        </div>
        <div className="modal-title">{tn('stars.tgTitle')}</div>
        {title && (
          <div className="buy-tg-item">
            {title}
            {stars ? (
              <span className="buy-tg-price">
                <StarIcon size={13} /> {stars}
              </span>
            ) : null}
          </div>
        )}
        <div className="modal-body">{tn('stars.tgText')}</div>
        {failed ? (
          <button
            className="btn-primary"
            onClick={() => {
              setFailed(false)
              setAttempt((n) => n + 1)
            }}
          >
            {tn('stars.tgRetry')}
          </button>
        ) : url ? (
          <a className="btn-primary buy-tg-open" href={url} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onClose, 300)}>
            {tn('stars.tgOpen')}
          </a>
        ) : (
          <button className="btn-primary" disabled>
            {tn('stars.tgPreparing')}
          </button>
        )}
        {failed && <div className="buy-tg-note buy-tg-err">{tn('stars.tgFailed')}</div>}
        <div className="buy-tg-note">{tn('stars.tgNote')}</div>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          {tn('common.close')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
