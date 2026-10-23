import type { Territory } from '@/lib/data/types'
import { labels } from '@/lib/i18n/runtime'

// How sector lists are ordered: freshest catch first (the map's first card
// and the default on «Сектора»), or most caught first.
export type SectorSort = 'lastCatch' | 'popular'

// The same words on the pill and in its list — the pill shares a row with
// the filter chips, so they're kept to one word.
export const SECTOR_SORT_LABEL = labels('sectorSort', ['lastCatch', 'popular'] as const)

const byId = (a: Territory, b: Territory) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// Newer first; a never-fished sector goes after every one that has a catch.
function newerFirst(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return Date.parse(b) - Date.parse(a)
}

// Ties fall back to the catch count, then the sector number — so the
// never-fished sectors still come out in a stable, readable order. In a city nobody has
// fished in yet (a new one) `near` puts them nearest-first from that point instead, so the
// map's first card is the sector by the city's centre, not the number-one sector at its edge.
export function compareSectors(sort: SectorSort, near?: [number, number]): (a: Territory, b: Territory) => number {
  const cos = near ? Math.cos((near[0] * Math.PI) / 180) : 1
  const away = (t: Territory) => (near ? Math.hypot(t.lat - near[0], (t.lng - near[1]) * cos) : 0)
  const tie = (a: Territory, b: Territory) => away(a) - away(b) || byId(a, b)
  if (sort === 'popular') return (a, b) => b.catchCount - a.catchCount || tie(a, b)
  return (a, b) => newerFirst(a.lastCatchAt, b.lastCatchAt) || b.catchCount - a.catchCount || tie(a, b)
}

// The sector with the most catches («🔥 Самый популярный»), null while
// nobody has caught anything. Lists are ordered by the latest catch, so it
// can't just be the first one.
export function mostPopularSectorId(territories: Territory[]): string | null {
  let best: Territory | null = null
  for (const t of territories) {
    if (t.catchCount > 0 && (!best || t.catchCount > best.catchCount || (t.catchCount === best.catchCount && t.id < best.id))) best = t
  }
  return best?.id ?? null
}
