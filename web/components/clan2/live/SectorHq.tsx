'use client'

import '@/app/clan2.css'
import { BaseView } from '@/components/clan2/BaseView'
import { fmtLeft, useDemoNow } from '@/components/clan2/C2Common'
import { useDemoState } from '@/lib/clan2/demoStore'
import { resolveCrest } from '@/lib/data/clanCrests'
import { JOIN_TYPE_LABEL } from '@/lib/data/clanLevels'
import { hqBannerSvg } from '@/lib/clan2/live/hqMarker'
import { previewProjects, useOtherHq, type OtherHq } from '@/lib/clan2/live/otherHqs'
import { useClan } from '@/lib/supabase/queries/clans'
import { setLiveUi, useLiveUi } from '@/lib/clan2/live/ui'
import { DEFENSE_MAX } from '@/lib/clan2/rules'
import { tn } from '@/lib/i18n/runtime'

// The real sector screen of the sector that holds the clan's headquarters: a ribbon over the map and a card in the
// clan's colour (defence or siege, the doubled rent, the way to the HQ). On another clan's HQ the card shows that
// clan's base and the way into the clan (lib/clan2/live/otherHqs.ts). Both render nothing for any other sector.
function useHq(id: string) {
  const s = useDemoState()
  const sector = s.sectors.find((x) => x.id === id)
  if (!s.live || s.hq.sectorId !== id || !sector) return null
  return { s, sector, color: resolveCrest(s.clan.crest).primary }
}

export function Clan2SectorHqRibbon({ id }: { id: string }) {
  const hq = useHq(id)
  const other = useOtherHq(id)
  const { mapClanLayer } = useLiveUi()
  if (!hq && !other) return null
  const color = hq ? hq.color : resolveCrest(other!.crest).primary
  const name = hq ? hq.s.clan.name : other!.name
  return (
    <div className={`c2-hq-ribbon${mapClanLayer ? ' clan' : ''}`} style={{ background: mapClanLayer ? color : '#17181B' }}>
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3 1.5v11" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M3.6 2.2h7.2l-1.7 2.9 1.7 2.9H3.6z" fill="#fff" />
      </svg>
      <b>{tn('clan2.map.hqRibbon', { name })}</b>
    </div>
  )
}

export function Clan2SectorHqCard({ id, onOpenClan }: { id: string; onOpenClan: (clanId: number) => void }) {
  const hq = useHq(id)
  const other = useOtherHq(id)
  const now = useDemoNow()
  const { mapClanLayer } = useLiveUi()
  // Opened from the «Игроки» layer the sector stays an ordinary one (with the tag over the map).
  if (!mapClanLayer) return null
  if (!hq) return other ? <OtherHqCard hq={other} onOpenClan={onOpenClan} /> : null
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
          setLiveUi({ clanTab: 'hq', focus: 'hq-card' })
          if (s.live) onOpenClan(s.live.clanId)
        }}
      >
        {tn('clan2.map.hqCardOpen')}
      </button>
    </div>
  )
}

// Another clan's HQ: its base to look at, how big the clan is, and the way in — «Вступить в клан» for a player without
// a clan (the clan's own screen then shows its conditions and the real button), «Открыть клан» for everybody else.
function OtherHqCard({ hq, onOpenClan }: { hq: OtherHq; onOpenClan: (clanId: number) => void }) {
  const s = useDemoState()
  const { data: clan } = useClan(hq.clanId)
  const color = resolveCrest(hq.crest).primary
  const level = clan?.level ?? 1
  const inClan = !!s.live
  const full = !!clan && clan.members.length >= clan.capacity
  return (
    <div className="c2-hq-card other" style={{ ['--hq' as string]: color }}>
      <div className="c2-hq-card-top">
        <span className="c2-hq-card-banner" dangerouslySetInnerHTML={{ __html: hqBannerSvg(hq.crest, 34, 50) }} />
        <div className="c2-hq-card-text">
          <b>{tn('clan2.other.title', { name: hq.name })}</b>
          <span className="c2-hq-card-name">{clan ? tn('clan2.other.meta', { level, n: clan.members.length, cap: clan.capacity }) : '\u00a0'}</span>
        </div>
      </div>
      <div className="c2-hq-card-base">
        <BaseView crest={hq.crest} projects={hq.projects ?? previewProjects(hq.clanId, level)} geo={hq} />
      </div>
      {!inClan && <p className="c2-hq-card-rent">{tn('clan2.other.why')}</p>}
      {!inClan && clan && <p className="c2-hq-card-join">{full ? tn('clan2.other.full') : JOIN_TYPE_LABEL[clan.joinType]}</p>}
      <button type="button" className="c2-hq-card-open" onClick={() => onOpenClan(hq.clanId)}>
        {inClan ? tn('clan2.other.open') : tn('clan2.other.join')}
      </button>
      {!hq.projects && <p className="c2-hq-card-note">{tn('clan2.other.preview')}</p>}
    </div>
  )
}
