'use client'

import { fmtLeft, useDemoNow } from '@/components/clan2/C2Common'
import { canManage, useDemoState } from '@/lib/clan2/demoStore'
import { setLiveUi } from '@/lib/clan2/live/ui'
import { DEFENSE_MAX } from '@/lib/clan2/rules'
import { tn } from '@/lib/i18n/runtime'

// A line on the real sector card of the map: this sector is the clan's headquarters (with its defence and
// siege), or — for a leader — a clan sector the headquarters can be put on.
export function Clan2SectorRow({ id }: { id: string }) {
  const s = useDemoState()
  const now = useDemoNow()
  const sector = s.sectors.find((x) => x.id === id)
  if (!sector) return null
  const isHq = s.hq.sectorId === id
  if (isHq) {
    return (
      <div className={`c2-sector-row hq${s.hq.siege ? ' siege' : ''}`}>
        <button type="button" onClick={() => setLiveUi({ hqSheet: true })}>
          <b>{tn('clan2.map.hqHere')}</b>
          <span>{s.hq.siege ? tn('clan2.hq.siegeLeft', { t: fmtLeft(s.hq.siege.endsAt - now) }) : tn('clan2.hq.defense', { n: Math.min(DEFENSE_MAX, sector.defense) })}</span>
        </button>
      </div>
    )
  }
  const ruins = s.hq.ruins && now < s.hq.ruins.until
  if (!canManage(s) || ruins) return null
  const moving = !!s.hq.sectorId
  return (
    <div className="c2-sector-row">
      <button type="button" className="place" onClick={() => setLiveUi({ confirmPlace: id })}>
        {moving ? tn('clan2.map.moveHere', { n: s.settings.hqMoveCost }) : tn('clan2.map.placeHere', { n: s.settings.hqPlaceCost })}
      </button>
    </div>
  )
}
