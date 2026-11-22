'use client'

import { useState } from 'react'
import { useRequestCity } from '@/lib/supabase/queries/cityRequest'
import { tn } from '@/lib/i18n/runtime'

// «Нет твоего города?» (CityStep): the player types the city that is missing; it goes to the super admins
// (request_city → «Активность» and Telegram). After sending, a thank-you and a hint to pick the nearest city
// for now. `preview` (the /onboarding-preview page): nothing is sent, the thank-you shows straight away.
export function CityRequestModal({ onClose, preview }: { onClose: () => void; preview?: boolean }) {
  const [city, setCity] = useState('')
  const [done, setDone] = useState<null | 'sent' | 'limit'>(null)
  const request = useRequestCity()
  const text = city.replace(/\s+/g, ' ').trim()
  const send = () => {
    if (text.length < 2 || request.isPending) return
    if (preview) return setDone('sent')
    request.mutate(text, { onSuccess: setDone })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card city-req-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon city-req-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 21c-4-4.5-7-8-7-11a7 7 0 0 1 14 0c0 3-3 6.5-7 11z" fill="#fff" />
            <path d="M12 7.2v5.6M9.2 10h5.6" stroke="#FC5200" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        {done ? (
          <>
            <div className="modal-title">{done === 'sent' ? tn('onb.cityReqDoneTitle') : tn('onb.cityReqLimit')}</div>
            <div className="modal-body">{tn('onb.cityReqDoneSub')}</div>
            <button className="btn-primary" onClick={onClose}>
              {tn('onb.cityReqOk')}
            </button>
          </>
        ) : (
          <>
            <div className="modal-title">{tn('onb.cityReqTitle')}</div>
            <div className="modal-body">{tn('onb.cityReqSub')}</div>
            <input
              className="city-req-input"
              value={city}
              maxLength={80}
              autoFocus
              enterKeyHint="send"
              placeholder={tn('onb.cityReqPlaceholder')}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send()
              }}
            />
            {request.isError && <div className="city-req-error">{tn('onb.cityReqError')}</div>}
            <button className="btn-primary" disabled={text.length < 2 || request.isPending} onClick={send}>
              {tn('onb.cityReqSend')}
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
              {tn('onb.cityReqCancel')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
