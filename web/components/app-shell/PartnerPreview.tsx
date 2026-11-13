'use client'

import '@/app/partner-points.css'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapView } from '@/components/app-shell/MapView'
import { PartnerPointSheet } from '@/components/app-shell/PartnerPointSheet'
import { CITIES } from '@/lib/data/city'
import type { PartnerPoint } from '@/lib/data/partnerPoints'

// «Предпросмотр» in the super admin's form: the point as a player meets it, before anything is saved — the game's map
// at the point, the pin on it (with its icon, discount and crown) and, on a tap, the card. Nothing is written anywhere.
export function PartnerPreview({ point, onClose }: { point: PartnerPoint; onClose: () => void }) {
  const [card, setCard] = useState(false)
  const city = CITIES[point.city]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !card && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, onClose])

  return createPortal(
    <div className="ppv" role="dialog" aria-modal="true" aria-label="Предпросмотр точки">
      <div className="ppv-map map-wrap">
        <MapView
          territories={[]}
          myTerritoryColor="#FC5200"
          onSelect={() => {}}
          fallbackCenter={[point.lat, point.lng]}
          fallbackZoom={city.zoom + 1.5}
          zoomShift={city.zoomShift}
          partners={[point]}
          onPartner={() => setCard(true)}
        />
      </div>
      <div className="ppv-bar">
        <div className="ppv-text">
          <b>Предпросмотр</b>
          <span>Так метку увидят игроки. Нажми на неё — откроется карточка. Пока не сохранишь, никто её не видит.</span>
        </div>
        <button type="button" className="ppv-close" onClick={onClose}>
          Закрыть
        </button>
      </div>
      {!card && (
        <button type="button" className="ppv-open" onClick={() => setCard(true)}>
          Открыть карточку
        </button>
      )}
      {card && <PartnerPointSheet point={point} preview onClose={() => setCard(false)} />}
    </div>,
    document.body
  )
}
