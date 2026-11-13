'use client'

import '@/app/partner-points.css'
import { useState } from 'react'
import { PartnerPointSheet } from '@/components/app-shell/PartnerPointSheet'
import { RouteModal } from '@/components/app-shell/RouteModal'
import { usePartnerPoints, usePartnerPrize } from '@/lib/supabase/queries'
import { cityMonday } from '@/lib/data/partnerPoints'
import type { CityId } from '@/lib/data/city'
import { tn } from '@/lib/i18n/runtime'

function Gift() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FC5200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5V20h14v-7.5M12 8.5V20" />
      <path d="M12 8.5C10.5 5 7 4.5 7 6.6 7 8 9.3 8.5 12 8.5zM12 8.5c1.5-3.5 5-4 5-1.9 0 1.4-2.3 1.9-5 1.9z" />
    </svg>
  )
}

// The weekly prize from a partner (the «Партнёр» plan, lib/data/partnerPoints.ts) over the weekly rating.
// `week` 0: this week, the prize is still being played — a tap opens the partner's card.
// `week` -1: last week's results — who gets it (the leader), and for the winner themself «show this screen».
export function PartnerPrizeCard({ city, week, winner }: { city: CityId; week: 0 | -1; winner?: { name: string; isMe: boolean } | null }) {
  const { data: prize } = usePartnerPrize(city, cityMonday(city, week))
  const { data: points } = usePartnerPoints()
  const [open, setOpen] = useState(false)
  const [route, setRoute] = useState(false)
  if (!prize) return null
  const point = points?.find((p) => p.id === prize.pointId) ?? null

  const sub =
    week === 0 ? tn('partner.ratingRule') : winner ? tn('partner.lastWinner', { name: winner.name }) : tn('partner.lastNobody')

  return (
    <>
      <button
        type="button"
        className="pp-rating-prize"
        disabled={!point && !(week === -1 && winner?.isMe)}
        onClick={() => (point ? setOpen(true) : setRoute(true))}
      >
        <span className="pp-rating-gift">
          <Gift />
        </span>
        <span className="pp-rating-text">
          <span className="pp-rating-kicker">{week === 0 ? tn('partner.ratingTitle', { name: prize.prizeFrom }) : tn('partner.lastTitle', { name: prize.prizeFrom })}</span>
          <span className="pp-rating-title">{prize.prizeTitle}</span>
          <span className="pp-rating-sub">{sub}</span>
          {week === -1 && winner?.isMe && <span className="pp-rating-me">{tn('partner.lastMe', { name: prize.name })}</span>}
        </span>
        {(point || (week === -1 && winner?.isMe)) && <span className="pp-rating-more">{tn('partner.ratingMore')}</span>}
      </button>
      {open && point && <PartnerPointSheet point={point} onClose={() => setOpen(false)} />}
      {route && <RouteModal lat={prize.lat} lng={prize.lng} title={tn('partner.routeTitle')} onClose={() => setRoute(false)} />}
    </>
  )
}
