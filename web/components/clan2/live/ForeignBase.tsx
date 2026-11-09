'use client'

import '@/app/clan2.css'
import { BaseView } from '@/components/clan2/BaseView'
import { hqBannerSvg } from '@/lib/clan2/live/hqMarker'
import { useOtherHqs } from '@/lib/clan2/live/otherHqs'
import { resolveCrest } from '@/lib/data/clanCrests'
import { tn } from '@/lib/i18n/runtime'

// The base of a clan the player does not belong to, on that clan's screen (decided with the owner 09.11.2026): the HQ on
// its sector, the six plots with the levels that are really built, and «under siege» when it is. Nothing about the
// money (the treasury, the rate, the buff plan, who gave what) is ever shown here: the server's get_clan_bases does not
// give it. Only the server's real buildings count: the preview's made-up ones (no `projects`) are never shown as real,
// and a clan of another city (whose HQ the map of this city does not have) shows no base at all.
export function ForeignBase({ clanId, level, members, capacity }: { clanId: number; level: number; members: number; capacity: number }) {
  const hq = useOtherHqs().find((x) => x.clanId === clanId)
  if (!hq || !hq.projects) return null
  const color = resolveCrest(hq.crest).primary
  return (
    <div className={`c2-hq-card other${hq.siege ? ' siege' : ''}`} style={{ ['--hq' as string]: color }}>
      <div className="c2-hq-card-top">
        <span className="c2-hq-card-banner" dangerouslySetInnerHTML={{ __html: hqBannerSvg(hq.crest, 34, 50) }} />
        <div className="c2-hq-card-text">
          <b>{tn('clan2.other.title', { name: hq.name })}</b>
          <span className="c2-hq-card-name">{tn('clan2.other.meta', { level, n: members, cap: capacity })}</span>
        </div>
        {hq.siege && <span className="c2-hq-card-state">{tn('clan2.hq.siege')}</span>}
      </div>
      <div className="c2-hq-card-base">
        <BaseView crest={hq.crest} projects={hq.projects} geo={hq} />
      </div>
    </div>
  )
}
