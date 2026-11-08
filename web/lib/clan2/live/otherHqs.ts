'use client'

import { useSyncExternalStore } from 'react'
import { BUILD_CLAN_LEVEL, PROJECT_IDS } from '@/lib/clan2/rules'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'
import type { Territory } from '@/lib/data/types'

// The headquarters of the OTHER clans of the city, for the map and the sector screen: a player looks at another clan's
// base from its HQ and can join it from there (the way into a clan for a player without one).
//
// PREVIEW ONLY. The other clans' HQs and buildings live on the server (clan_hq, clan_treasury.projects), which the live
// mode does not have yet: here each clan's HQ stands on its busiest sector (the one with most catches) and its
// buildings are made up from the clan's id and level — the same for every viewer, never above what the clan's level
// allows. The server version reads them with get_clan_bases (supabase-drafts/clan-update-06-11/07_clan_base_view.sql).

// projects / siege: from the server (get_clan_bases); without them the card shows the preview's made-up buildings.
export type OtherHq = { clanId: number; name: string; crest: unknown; sectorId: string; lat: number; lng: number; widthDeg: number; projects?: Record<ProjectId, ProjectLevel>; siege?: boolean }
// A fallen HQ of another clan (server only).
export type OtherRuins = { clanId: number; sectorId: string; lat: number; lng: number }
export type ServerBase = { clan_id: number; territory_id: string | null; under_siege: boolean; ruins_territory_id: string | null; projects: Record<string, number> | null }

// The other clans' real HQs (get_clan_bases), placed on their sectors; a clan whose HQ sector is not on this map is left out.
export function serverOtherHqs(rows: ServerBase[], territories: Territory[], ownClanId: number | null): { hqs: OtherHq[]; ruins: OtherRuins[] } {
  const byId = new Map(territories.map((t) => [t.id, t]))
  const names = new Map<number, { name: string; crest: unknown }>()
  for (const t of territories) if (t.ownerClanId != null && !names.has(t.ownerClanId)) names.set(t.ownerClanId, { name: t.ownerClanName ?? '', crest: t.ownerClanCrest })
  const hqs: OtherHq[] = []
  const ruins: OtherRuins[] = []
  for (const r of rows) {
    const clanId = Number(r.clan_id)
    if (clanId === ownClanId) continue
    if (r.territory_id) {
      const t = byId.get(r.territory_id)
      if (t) {
        const c = t.corners
        const who = names.get(clanId) ?? { name: t.ownerClanName ?? '', crest: t.ownerClanCrest }
        const projects = Object.fromEntries(PROJECT_IDS.map((id) => [id, Math.min(3, Math.max(0, Number(r.projects?.[id] ?? 0))) as ProjectLevel])) as Record<ProjectId, ProjectLevel>
        hqs.push({ clanId, name: who.name, crest: who.crest, sectorId: t.id, lat: t.lat, lng: t.lng, widthDeg: c && c.length >= 4 ? Math.abs(c[0][1] - c[3][1]) : 0.008, projects, siege: !!r.under_siege })
      }
    }
    if (r.ruins_territory_id) {
      const t = byId.get(r.ruins_territory_id)
      if (t) ruins.push({ clanId, sectorId: t.id, lat: t.lat, lng: t.lng })
    }
  }
  return { hqs: hqs.sort((a, b) => a.sectorId.localeCompare(b.sectorId)), ruins }
}

export function computeOtherHqs(territories: Territory[], ownClanId: number | null): OtherHq[] {
  const best = new Map<number, Territory>()
  for (const t of territories) {
    const c = t.ownerClanId
    if (c == null || c === ownClanId) continue
    const cur = best.get(c)
    if (!cur || t.catchCount > cur.catchCount || (t.catchCount === cur.catchCount && t.id < cur.id)) best.set(c, t)
  }
  const out: OtherHq[] = []
  for (const [clanId, t] of best) {
    const c = t.corners
    out.push({
      clanId,
      name: t.ownerClanName ?? '',
      crest: t.ownerClanCrest,
      sectorId: t.id,
      lat: t.lat,
      lng: t.lng,
      widthDeg: c && c.length >= 4 ? Math.abs(c[0][1] - c[3][1]) : 0.008,
    })
  }
  return out.sort((a, b) => a.sectorId.localeCompare(b.sectorId))
}

// The made-up buildings of another clan (preview): steady for a clan, bounded by its level (a level opens a building's
// next level at clan level 2 / 4 / 6).
export function previewProjects(clanId: number, clanLevel: number): Record<ProjectId, ProjectLevel> {
  const allowed = BUILD_CLAN_LEVEL.filter((n) => clanLevel >= n).length
  const out = {} as Record<ProjectId, ProjectLevel>
  PROJECT_IDS.forEach((id, i) => {
    let h = (clanId * 2654435761 + (i + 1) * 40503) >>> 0
    h = (h ^ (h >>> 13)) >>> 0
    out[id] = Math.min(allowed, h % 4) as ProjectLevel
  })
  return out
}

// The list the map worked out last, for the sector screen (it has no list of all sectors of its own).
let list: OtherHq[] = []
const listeners = new Set<() => void>()
export function setOtherHqs(next: OtherHq[]) {
  const same = next.length === list.length && next.every((x, i) => x.clanId === list[i].clanId && x.sectorId === list[i].sectorId)
  if (same) return
  list = next
  listeners.forEach((l) => l())
}
export function useOtherHqs(): OtherHq[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => list,
    () => list
  )
}
export function useOtherHq(sectorId: string): OtherHq | null {
  return useOtherHqs().find((x) => x.sectorId === sectorId) ?? null
}
