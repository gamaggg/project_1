'use client'

import { fmtLeft, useDemoNow } from '@/components/clan2/C2Common'
import { useDemoState } from '@/lib/clan2/demoStore'
import { resolveCrest } from '@/lib/data/clanCrests'
import { hqBannerSvg } from '@/lib/clan2/live/hqMarker'
import { setLiveUi, useLiveUi } from '@/lib/clan2/live/ui'
import { DEFENSE_MAX } from '@/lib/clan2/rules'
import { tn } from '@/lib/i18n/runtime'

// The real sector screen of the sector that holds the clan's headquarters: a ribbon over the map and a card in the
// clan's colour (defence or siege, the doubled rent, the way to the HQ). Both render nothing for any other sector.
function useHq(id: string) {
  const s = useDemoState()
  const sector = s.sectors.find((x) => x.id === id)
  if (!s.live || s.hq.sectorId !== id || !sector) return null
  return { s, sector, color: resolveCrest(s.clan.crest).primary }
}

export function Clan2SectorHqRibbon({ id }: { id: string }) {
  const hq = useHq(id)
  const { mapClanLayer } = useLiveUi()
  if (!hq) return null
  return (
    <div className={`c2-hq-ribbon${mapClanLayer ? ' clan' : ''}`} style={{ background: mapClanLayer ? hq.color : '#17181B' }}>
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3 1.5v11" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M3.6 2.2h7.2l-1.7 2.9 1.7 2.9H3.6z" fill="#fff" />
      </svg>
      <b>{tn('clan2.map.hqRibbon', { name: hq.s.clan.name })}</b>
    </div>
  )
}

export function Clan2SectorHqCard({ id, onOpenClan }: { id: string; onOpenClan: (clanId: number) => void }) {
  const hq = useHq(id)
  const now = useDemoNow()
  const { mapClanLayer } = useLiveUi()
  // Opened from the «Игроки» layer the sector stays an ordinary one (with the tag over the map).
  if (!hq || !mapClanLayer) return null
  const { s, sector, color } = hq
  const siege = s.hq.siege
  return (
    <div className={`c2-hq-card${siege ? ' siege' : ''}`} style={{ ['--hq' as string]: color }}>
      <div className="c2-hq-card-top">
        <span className="c2-hq-card-banner" dangerouslySetInnerHTML={{ __html: hqBannerSvg(s.clan.crest, 34, 50) }} />
        <div className="c2-hq-card-text">
          <b>{tn('clan2.base.hq')}</b>
          <span className="c2-hq-card-name">{s.clan.name}</span>
        </div>
        <span className="c2-hq-card-state">{siege ? tn('clan2.hq.siegeLeft', { t: fmtLeft(siege.endsAt - now) }) : tn('clan2.hq.defense', { n: Math.min(DEFENSE_MAX, sector.defense) })}</span>
      </div>
      <p className="c2-hq-card-rent">{tn('clan2.map.hqCardRent', { n: s.settings.rentPerSectorDay * 2 })}</p>
      <button
        type="button"
        className="c2-hq-card-open"
        onClick={() => {
          setLiveUi({ clanTab: 'hq' })
          if (s.live) onOpenClan(s.live.clanId)
        }}
      >
        {tn('clan2.map.hqCardOpen')}
      </button>
    </div>
  )
}
