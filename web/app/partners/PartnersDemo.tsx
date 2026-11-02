'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import type { PartnerCity, PartnersDoc } from '@/lib/data/partners.shared'
import { SHOP_POS } from '@/lib/data/partnersMapData'
import { PartnersMap } from './PartnersMap'
import { ShopSheet } from './ShopSheet'

// A computer screen: the card stands beside the map instead of rising as a phone sheet.
const WIDE = '(min-width: 900px)'
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const isWide = () => window.matchMedia(WIDE).matches
const notWide = () => false

// The two plans over the game's own map: Старт (the pin and the promo code) is always on,
// Партнёр (the week with the business's prize) can be turned on to see what players get.
export function PartnersDemo({ doc, city }: { doc: PartnersDoc; city: PartnerCity }) {
  const d = doc.demo
  const wide = useSyncExternalStore(subscribeWide, isWide, notWide)
  const [week, setWeek] = useState(false)
  const [open, setOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const [pulse, setPulse] = useState(0)

  const openSheet = useCallback(() => {
    setOpen(true)
    setTouched(true)
    setPulse((n) => n + 1)
  }, [])
  const closeSheet = useCallback(() => setOpen(false), [])

  return (
    <div className={wide ? 'pt-demo pt-demo-wide' : 'pt-demo'}>
      <div className="pt-switches" role="group">
        <span className="pt-sw pt-sw-on pt-sw-fixed">
          <i aria-hidden="true">✓</i>
          {d.tabs.start.name}
          <small>{d.tabs.start.sub}</small>
        </span>
        <button className={week ? 'pt-sw pt-sw-on' : 'pt-sw'} aria-pressed={week} onClick={() => setWeek((v) => !v)}>
          <i aria-hidden="true">{week ? '✓' : '+'}</i>
          {d.tabs.partner.name}
          <small>{d.tabs.partner.sub}</small>
        </button>
      </div>

      <div className="pt-map">
        <span className="pt-badge">{d.badge}</span>
        {week && (
          <span className="pt-week-banner" key="wb">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z" fill="#fff" />
            </svg>
            {d.week.prizeLabel}: {d.week.prize}
          </span>
        )}
        <PartnersMap city={city} shopName={d.shop.name} discount={d.promo.discount} promo week={week} opened={touched} onOpen={openSheet} />
        {!touched && !wide && <span className="pt-hint">{d.hint}</span>}
      </div>

      {wide ? (
        <ShopSheet doc={doc} city={city} open={false} promo week={week} coords={SHOP_POS[city]} onClose={closeSheet} inline pulse={pulse} />
      ) : (
        <ShopSheet doc={doc} city={city} open={open} promo week={week} coords={SHOP_POS[city]} onClose={closeSheet} />
      )}
    </div>
  )
}
