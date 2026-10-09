'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SlotSymbol } from '@/components/app-shell/SlotSymbol'
import { useSlotState } from '@/lib/supabase/queries'
import { useT } from '@/lib/i18n'
import { useUiState } from '@/lib/uiState'
import { useNow } from '@/lib/useNow'
import { hapticTap } from '@/lib/telegram/haptics'
import type { CityId } from '@/lib/data/city'

// A sticker on the map while a slot spin is waiting — the slots live in the
// Shop now and players forgot them. The × asks how long to keep it away:
// «в этот раз» hides it until a new spin turns up (a catch, or tomorrow's
// free one), «навсегда» for good. Both on the account (lib/uiState.ts).
type Hidden = { until: string; left: number }

export function SlotsSticker({ city, onOpen }: { city: CityId; onOpen: () => void }) {
  const t = useT()
  const { data: state } = useSlotState()
  const ui = useUiState()
  const now = useNow(60_000)
  const [asking, setAsking] = useState(false)
  if (!state || !ui.ready || state.left === 0) return null
  if (ui.state?.slots_sticker_off === true) return null
  const hidden = (ui.state?.slots_sticker_hidden as Hidden | undefined) ?? null
  if (hidden && now < new Date(hidden.until).getTime() && state.left <= hidden.left) return null

  return (
    <>
      <div className="slots-sticker-wrap">
        <button
          type="button"
          className="slots-sticker"
          onClick={() => {
            hapticTap()
            onOpen()
          }}
          aria-label={`${t('slots.title')}: ${t('slots.sticker.spins', { count: state.left })}`}
        >
          <span className="slots-sticker-reels" aria-hidden>
            {(['katran', 'hook', 'hex'] as const).map((s) => (
              <span key={s} className="slots-sticker-reel">
                <SlotSymbol symbol={s} city={city} size={14} />
              </span>
            ))}
          </span>
          <span className="slots-sticker-title">{t('slots.sticker.title')}</span>
          <span className="slots-sticker-count">{t('slots.sticker.spins', { count: state.left })}</span>
        </button>
        <button type="button" className="recap-sticker-close" aria-label={t('slots.sticker.hideTitle')} onClick={() => setAsking(true)}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {asking &&
        createPortal(
          <div className="modal-overlay" onClick={() => setAsking(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">{t('slots.sticker.hideTitle')}</div>
              <div className="modal-body" style={{ margin: '6px 0 16px' }}>
                {t('slots.sticker.hideText')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    ui.set('slots_sticker_hidden', { until: state.nextReset, left: state.left })
                    setAsking(false)
                  }}
                >
                  {t('slots.sticker.hideOnce')}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    ui.set('slots_sticker_off', true)
                    setAsking(false)
                  }}
                >
                  {t('slots.sticker.hideForever')}
                </button>
                <button className="shield-modal-close" style={{ marginTop: 0 }} onClick={() => setAsking(false)}>
                  {t('slots.sticker.cancel')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
