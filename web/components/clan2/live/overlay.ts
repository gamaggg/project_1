'use client'

import { useMemo } from 'react'
import { useDemoNow } from '@/components/clan2/C2Common'
import { useClan2Enabled } from '@/lib/clan2/live/flag'
import { hqMarkerHtml, ruinsMarkerHtml } from '@/lib/clan2/live/hqMarker'
import { setLiveUi, useLiveUi } from '@/lib/clan2/live/ui'
import { useDemoState } from '@/lib/clan2/demoStore'
import type { Territory } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'

// What the real map needs from the clan update: the animated skin of the clan on its sectors (clan layer),
// the headquarters (or its ruins) standing on a sector, and the «place the HQ» mode.

export type Clan2Marker = { id: string; lat: number; lng: number; html: string; size: [number, number]; anchor: [number, number]; kind: 'hq' | 'ruins' }
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
    if (hqT) markers.push({ id: hqT.id, lat: hqT.lat, lng: hqT.lng, kind: 'hq', html: hqMarkerHtml(s.clan.crest, { siege, label: tn('clan2.map.hqHere') }), size: [64, 84], anchor: [32, 76] })
    const ruinT = ruinsActive && ruinsId ? byId.get(ruinsId) : undefined
    if (ruinT) markers.push({ id: ruinT.id, lat: ruinT.lat, lng: ruinT.lng, kind: 'ruins', html: ruinsMarkerHtml(tn('clan2.base.ruins')), size: [46, 40], anchor: [23, 30] })
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
