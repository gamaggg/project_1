'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { formatCoords, mapsLinks, openExternal } from '@/lib/openExternal'
import { useT } from '@/lib/i18n'

// «Маршрут до сектора»: pick a maps app and it opens with a route to the
// point. Shared by the sector screen, the map's nearest-free card and a partner's card (with its own title).
// 24.11.2026: each app is a row with its own icon (public/maps/<id>.png — the apps' App Store icons); the
// coordinates are a chip that copies them (the sector screen's coordinates block is gone, this is where they are
// copied now).

export function RouteModal({ lat, lng, onClose, title, overlayClass }: { lat: number; lng: number; onClose: () => void; title?: string; overlayClass?: string }) {
  const t = useT()
  const coords = formatCoords(lat, lng)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(coords)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    window.setTimeout(() => setCopied(null), 1800)
  }

  return createPortal(
    <div className={overlayClass ? `modal-overlay ${overlayClass}` : 'modal-overlay'} onClick={onClose}>
      <div className="modal-card route-card" role="dialog" aria-label={title ?? t('route.title')} onClick={(e) => e.stopPropagation()}>
        <div className="route-icon" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="19" r="2" />
            <circle cx="18" cy="5" r="2" />
            <path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H12" />
          </svg>
        </div>
        <div className="modal-title">{title ?? t('route.title')}</div>
        <button type="button" className={`route-coords tap-scale${copied === 'ok' ? ' done' : ''}`} onClick={() => void copy()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span className="route-coords-value">{coords}</span>
          <span className="route-coords-action">{copied === 'ok' ? t('route.copied') : copied === 'fail' ? t('common.copyFailed') : t('route.copy')}</span>
        </button>
        <div className="route-opts">
          {mapsLinks(lat, lng).map((m) => (
            <button
              key={m.id}
              type="button"
              className="route-opt tap-scale"
              onClick={() => {
                onClose()
                openExternal(m.url)
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a 96px app icon from public/ */}
              <img className="route-opt-icon" src={`/maps/${m.id}.png`} alt="" width={36} height={36} decoding="async" />
              <span className="route-opt-label">{m.label}</span>
              <svg className="route-opt-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </button>
          ))}
        </div>
        <button type="button" className="route-cancel" onClick={onClose}>
          {t('route.cancel')}
        </button>
      </div>
    </div>,
    document.body
  )
}
