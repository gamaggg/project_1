'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useGeoToday } from '@/lib/supabase/queries'
import { useUiState } from '@/lib/uiState'
import { hapticTap } from '@/lib/telegram/haptics'
import { GEO_COINS } from '@/lib/geo'
import { tn } from '@/lib/i18n/runtime'

// A sticker on the map while today's «Где это?» try is still there — like
// the slots' one (SlotsSticker), and gone once the player has answered. The ×
// asks how long to keep it away: «на сегодня» (until the next panorama) or
// «больше не показывать». Both on the account (lib/uiState.ts).
export function GeoSticker({ onOpen }: { onOpen: () => void }) {
  const { data: today } = useGeoToday()
  const ui = useUiState()
  const [asking, setAsking] = useState(false)
  if (!today?.panorama || today.result || !ui.ready) return null
  if (ui.state?.geo_sticker_off === true) return null
  if (ui.state?.geo_sticker_hidden === today.day) return null

  return (
    <>
      <div className="geo-sticker-wrap">
        <button
          type="button"
          className="geo-sticker"
          onClick={() => {
            hapticTap()
            onOpen()
          }}
          aria-label={tn('geoGame.stickerAria', { coins: GEO_COINS })}
        >
          <span className="geo-sticker-hex" aria-hidden>
            ?
          </span>
          <span className="geo-sticker-title">{tn('geoGame.whereIs')}</span>
          <span className="geo-sticker-prize">
            +{GEO_COINS}
            <CoinIcon size={16} />
          </span>
        </button>
        <button type="button" className="recap-sticker-close" aria-label={tn('geoGame.stickerHideAria')} onClick={() => setAsking(true)}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {asking &&
        createPortal(
          <div className="modal-overlay" onClick={() => setAsking(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">{tn('geoGame.hideTitle')}</div>
              <div className="modal-body" style={{ margin: '6px 0 16px' }}>
                {tn('geoGame.hideText')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    ui.set('geo_sticker_hidden', today.day)
                    setAsking(false)
                  }}
                >
                  {tn('geoGame.forToday')}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    ui.set('geo_sticker_off', true)
                    setAsking(false)
                  }}
                >
                  {tn('geoGame.neverShow')}
                </button>
                <button className="shield-modal-close" style={{ marginTop: 0 }} onClick={() => setAsking(false)}>
                  {tn('common.cancel')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
