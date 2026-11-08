'use client'

import { fmtLeft, useDemoNow } from '@/components/clan2/C2Common'
import { useDemoState } from '@/lib/clan2/demoStore'
import { hqBannerSvg } from '@/lib/clan2/live/hqMarker'
import { setLiveUi } from '@/lib/clan2/live/ui'
import { resolveCrest } from '@/lib/data/clanCrests'
import { DEFENSE_MAX } from '@/lib/clan2/rules'
import { tn } from '@/lib/i18n/runtime'

// A line on the real sector card of the map, shown only to the clan's own players: this sector is the clan's
// headquarters (with its defence and siege), and a tap opens the HQ tab of the clan screen. Placing or moving the
// headquarters is done only from the clan screen, so other clan sectors get no line.
export function Clan2SectorRow({ id, onOpenClan }: { id: string; onOpenClan?: (clanId: number) => void }) {
  const s = useDemoState()
  const now = useDemoNow()
  const sector = s.sectors.find((x) => x.id === id)
  if (!sector || !s.live || s.hq.sectorId !== id) return null
  const clanId = s.live.clanId
  return (
    <div className={`c2-sector-row hq${s.hq.siege ? ' siege' : ''}`} style={{ ['--hq' as string]: resolveCrest(s.clan.crest).primary }}>
      <button
        type="button"
        onClick={() => {
          setLiveUi({ clanTab: 'hq', focus: 'hq-card' })
          onOpenClan?.(clanId)
        }}
      >
        <span className="c2-sector-row-flag" aria-hidden="true" dangerouslySetInnerHTML={{ __html: hqBannerSvg(s.clan.crest, 20, 30) }} />
        <span className="c2-sector-row-text">
          <b>{tn('clan2.map.hqCardOpen')}</b>
          <span>{s.hq.siege ? tn('clan2.hq.siegeLeft', { t: fmtLeft(s.hq.siege.endsAt - now) }) : tn('clan2.hq.defense', { n: Math.min(DEFENSE_MAX, sector.defense) })}</span>
        </span>
        <svg className="c2-sector-row-go" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}
