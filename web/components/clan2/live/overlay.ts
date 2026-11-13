'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { cityForSectorId } from '@/lib/data/city'
import { useDemoNow } from '@/components/clan2/C2Common'
import { useClan2Enabled } from '@/lib/clan2/live/flag'
import { RUINS_SIZE, hqBox, hqOutlineColor, hqMarkerHtml, ruinsMarkerHtml, type MarkerTier } from '@/lib/clan2/live/hqMarker'
import { computeOtherHqs, serverOtherHqs, setOtherHqs, type ServerBase } from '@/lib/clan2/live/otherHqs'
import { setLiveUi, useLiveUi } from '@/lib/clan2/live/ui'
import { useDemoState } from '@/lib/clan2/demoStore'
import type { Territory } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'

// What the real map needs from the clan update: the animated skin of the clan on its sectors (clan layer),
// the headquarters (or its ruins) standing on a sector, and the «place the HQ» mode. The other clans' HQs stand on
// the map too (lib/clan2/live/otherHqs.ts), for every player with the update switched on, in a clan or not: a tap
// opens the sector, whose card shows that clan's base and the way to join it.

// The marker is drawn for a zoom tier (far / middle / near): html and the box are asked for it by the map.
export type Clan2Marker = { id: string; lat: number; lng: number; kind: 'hq' | 'ruins'; color?: string; html: (tier: MarkerTier, bannerH?: number) => string; box: (tier: MarkerTier, bannerH?: number) => [number, number] }
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

  // The player's own clan: the bound one, or (before it is bound) the clan of a sector the player holds.
  const ownClanId = live?.clanId ?? territories.find((t) => t.status === 'mine' && t.ownerClanId != null)?.ownerClanId ?? null
  // The server's bases and the skins the clans wear (once the clan update is on the server); without them, in
  // development only, the preview's stand-ins.
  const city = territories[0] ? cityForSectorId(territories[0].id) : null
  const { data: server } = useQuery({
    queryKey: ['clan2-bases', city],
    enabled: enabled && !!city,
    // Every 5 minutes (was every minute from every player of the city, 174 ms each on the database); the clan's
    // own HQ comes with its own clan read.
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<{ bases: ServerBase[]; skins: Record<number, string> } | null> => {
      const supabase = createClient() as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: ServerBase[] | null; error: unknown }>
        from: (t: string) => { select: (c: string) => Promise<{ data: { clan_id: number; skin: string | null }[] | null; error: unknown }> }
      }
      const [b, e] = await Promise.all([supabase.rpc('get_clan_bases', { p_city: city }), supabase.from('clan_equipped').select('clan_id,skin')])
      if (b.error) return null
      const skins: Record<number, string> = {}
      for (const r of e.data ?? []) if (r.skin) skins[Number(r.clan_id)] = r.skin
      return { bases: b.data ?? [], skins }
    },
  })
  const fromServer = useMemo(() => (server ? serverOtherHqs(server.bases, territories, ownClanId) : null), [server, territories, ownClanId])
  const others = useMemo(() => (!enabled ? [] : fromServer ? fromServer.hqs : computeOtherHqs(territories, ownClanId)), [enabled, fromServer, territories, ownClanId])
  const otherRuins = fromServer?.ruins ?? []
  useEffect(() => setOtherHqs(others), [others])
  const othersKey = others.map((o) => `${o.clanId}:${o.sectorId}:${o.siege ? 's' : ''}`).join(',') + '|' + otherRuins.map((r) => r.sectorId).join(',') + '|' + JSON.stringify(server?.skins ?? {})
  const otherSkins = server?.skins ?? {}

  return useMemo(() => {
    if (!enabled) return null
    const byId = new Map(territories.map((t) => [t.id, t]))
    const markers: Clan2Marker[] = []
    for (const o of others)
      markers.push({
        id: o.sectorId,
        lat: o.lat,
        lng: o.lng,
        kind: 'hq',
        color: hqOutlineColor(o.crest),
        html: (tier, bannerH) => hqMarkerHtml(o.crest, { siege: !!o.siege, label: tn('clan2.map.hqOf', { name: o.name }), tag: tn('clan2.base.hq'), tier, bannerH }),
        box: (tier, bannerH) => hqBox(tier, bannerH),
      })
    for (const r of otherRuins)
      markers.push({ id: r.sectorId, lat: r.lat, lng: r.lng, kind: 'ruins', html: (tier) => ruinsMarkerHtml(tn('clan2.base.ruins'), tier), box: (tier) => RUINS_SIZE[tier] })
    if (!live)
      return { clanId: -1, skinByClan: { ...otherSkins }, markers, placing: false, placeable: [], onPick: () => {}, onMarker: () => {}, signature: ['solo', othersKey].join('|') }
    const hqT = hqId ? byId.get(hqId) : undefined
    if (hqT)
      markers.push({
        id: hqT.id,
        lat: hqT.lat,
        lng: hqT.lng,
        kind: 'hq',
        color: hqOutlineColor(s.clan.crest),
        html: (tier, bannerH) => hqMarkerHtml(s.clan.crest, { siege, label: tn('clan2.map.hqHere'), tag: tn('clan2.base.hq'), tier, bannerH }),
        box: (tier, bannerH) => hqBox(tier, bannerH),
      })
    const ruinT = ruinsActive && ruinsId ? byId.get(ruinsId) : undefined
    if (ruinT) markers.push({ id: ruinT.id, lat: ruinT.lat, lng: ruinT.lng, kind: 'ruins', html: (tier) => ruinsMarkerHtml(tn('clan2.base.ruins'), tier), box: (tier) => RUINS_SIZE[tier] })
    const placeable = ui.placing ? mineIds.filter((id) => id !== hqId) : []
    return {
      clanId: live.clanId,
      skinByClan: { ...otherSkins, ...(skin ? { [live.clanId]: skin } : {}) },
      markers,
      placing: ui.placing,
      placeable,
      onPick: (id: string) => setLiveUi({ confirmPlace: id }),
      onMarker: () => setLiveUi({ hqSheet: true }),
      signature: [live.clanId, skin ?? '', hqId ?? '', ruinsActive ? ruinsId : '', siege ? 's' : '', ui.placing ? 'p' + mineKey : '', crestKey, othersKey].join('|'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, live?.clanId, skin, hqId, ruinsId, ruinsActive, siege, ui.placing, mineKey, crestKey, territories, othersKey])
}
