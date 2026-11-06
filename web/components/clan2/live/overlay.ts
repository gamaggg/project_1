'use client'

import { useMemo } from 'react'
import { useDemoNow } from '@/components/clan2/C2Common'
import { useClan2Enabled } from '@/lib/clan2/live/flag'
import { RUINS_SIZE, hqBox, hqMarkerHtml, ruinsMarkerHtml, type MarkerTier } from '@/lib/clan2/live/hqMarker'
import { setLiveUi, useLiveUi } from '@/lib/clan2/live/ui'
import { useDemoState } from '@/lib/clan2/demoStore'
import type { Territory } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'

// What the real map needs from the clan update: the animated skin of the clan on its sectors (clan layer),
// the headquarters (or its ruins) standing on a sector, and the «place the HQ» mode.

// The marker is drawn for a zoom tier (far / middle / near): html and the box are asked for it by the map.
export type Clan2Marker = { id: string; lat: number; lng: number; kind: 'hq' | 'ruins'; html: (tier: MarkerTier, bannerH?: number) => string; box: (tier: MarkerTier, bannerH?: number) => [number, number] }
export type Clan2MapProps = {
  clanId: number
  skinByClan: Record<number, string>
  markers: Clan2Marker[]
  placing: boolean
  placeable: string[]
  onPick: (id: string) => void
  onMarker: (id: string) => void
  // Changes whenever the map has to be drawn again.
  signature: string
}

export function useClan2Map(territories: Territory[]): Clan2MapProps | null {
  const enabled = useClan2Enabled()
  const s = useDemoState()
  const ui = useLiveUi()
  const live = enabled && s.live ? s.live : null
  const hqId = s.hq.sectorId
  const ruinsId = s.hq.ruins?.sectorId ?? null
  const siege = !!s.hq.siege
  const skin = s.equippedSkin
  const mineIds = s.sectors.filter((x) => x.owner === 'mine').map((x) => x.id)
  const mineKey = mineIds.join(',')
  const crestKey = JSON.stringify(s.clan.crest)
  const now = useDemoNow()
  const ruinsActive = !!s.hq.ruins && s.hq.ruins.until > now

  return useMemo(() => {
    if (!live) return null
    const byId = new Map(territories.map((t) => [t.id, t]))
    const markers: Clan2Marker[] = []
    const hqT = hqId ? byId.get(hqId) : undefined
    if (hqT)
      markers.push({
        id: hqT.id,
        lat: hqT.lat,
        lng: hqT.lng,
        kind: 'hq',
        html: (tier, bannerH) => hqMarkerHtml(s.clan.crest, { siege, label: tn('clan2.map.hqHere'), tag: tn('clan2.base.hq'), tier, bannerH }),
        box: (tier, bannerH) => hqBox(tier, bannerH),
      })
    const ruinT = ruinsActive && ruinsId ? byId.get(ruinsId) : undefined
    if (ruinT) markers.push({ id: ruinT.id, lat: ruinT.lat, lng: ruinT.lng, kind: 'ruins', html: (tier) => ruinsMarkerHtml(tn('clan2.base.ruins'), tier), box: (tier) => RUINS_SIZE[tier] })
    const placeable = ui.placing ? mineIds.filter((id) => id !== hqId) : []
    return {
      clanId: live.clanId,
      skinByClan: skin ? { [live.clanId]: skin } : {},
      markers,
      placing: ui.placing,
      placeable,
      onPick: (id: string) => setLiveUi({ confirmPlace: id }),
      onMarker: () => setLiveUi({ hqSheet: true }),
      signature: [live.clanId, skin ?? '', hqId ?? '', ruinsActive ? ruinsId : '', siege ? 's' : '', ui.placing ? 'p' + mineKey : '', crestKey].join('|'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.clanId, skin, hqId, ruinsId, ruinsActive, siege, ui.placing, mineKey, crestKey, territories])
}
