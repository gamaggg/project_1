'use client'

import { createPortal } from 'react-dom'
import { formatCoords, mapsLinks, openExternal } from '@/lib/openExternal'
import { useT } from '@/lib/i18n'

// «Маршрут до сектора»: pick a maps app and it opens with a route to the
// point. Shared by the sector screen and the map's nearest-free card.
export function RouteModal({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const t = useT()
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card sector-maps-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('route.title')}</div>
        <div className="modal-body" style={{ margin: '6px 0 14px' }}>
          {formatCoords(lat, lng)}
        </div>
        {mapsLinks(lat, lng).map((m) => (
          <button
            key={m.id}
            className="sector-maps-option tap-scale"
            onClick={() => {
              onClose()
              openExternal(m.url)
            }}
          >
            {m.label}
          </button>
        ))}
        <button className="comments-dialog-cancel" onClick={onClose}>
          {t('route.cancel')}
        </button>
      </div>
    </div>,
    document.body
  )
}
