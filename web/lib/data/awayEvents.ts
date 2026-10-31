import { resolveTerritoryColor } from '@/lib/data/territoryColors'
import type { Territory } from '@/lib/data/types'
import type { AwayEvent } from '@/components/app-shell/AwayReplay'

// «Пока тебя не было»: which sector_lost / sector_attacked notifications become a
// replay (the fetch is in lib/supabase/queries/awayReplay.ts).

// More than three in a row stops being news and becomes a wait.
const MAX_EVENTS = 3

export type AwayRow = {
  id: number
  kind: 'sector_lost' | 'sector_attacked'
  created_at: string
  territory_id: string | null
  payload: { defense?: number } | null
  actor: { display_name: string | null; avatar_url: string | null; territory_color: string | null } | { display_name: string | null; avatar_url: string | null; territory_color: string | null }[] | null
}

export type AwayReplayData = { events: AwayEvent[]; newest: string }

// What to replay, given the map's sectors right now: only sectors on this city's
// map, one story per sector (a loss outweighs an attack before it), none for a
// sector the player has already won back, the newest three — told oldest first.
export function pickAwayEvents(rows: AwayRow[], territories: Territory[], myColor: string): AwayReplayData | null {
  if (!rows.length) return null
  const byId = new Map(territories.map((t) => [t.id, t]))
  const perSector = new Map<string, AwayEvent>()
  for (const row of rows) {
    const t = row.territory_id ? byId.get(row.territory_id) : undefined
    if (!t || perSector.has(t.id)) continue
    const lost = row.kind === 'sector_lost'
    if (lost && t.status === 'mine') continue
    if (!lost && t.status !== 'mine') continue
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor
    perSector.set(t.id, {
      key: String(row.id),
      kind: lost ? 'lost' : 'attacked',
      territoryId: t.id,
      at: row.created_at,
      byName: actor?.display_name ?? null,
      byAvatarUrl: actor?.avatar_url ?? null,
      byColor: resolveTerritoryColor('other', myColor, actor?.territory_color ?? null),
      defense: lost ? 1 : (row.payload?.defense ?? null),
    })
  }
  const events = [...perSector.values()].slice(0, MAX_EVENTS).reverse()
  return events.length ? { events, newest: rows[0].created_at } : null
}
