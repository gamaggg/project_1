import type { Territory } from '@/lib/data/types'

// How sector lists are ordered: freshest catch first (the map's first card
// and the default on «Территории»), or most caught first.
export type SectorSort = 'lastCatch' | 'popular'

export const SECTOR_SORT_LABEL: Record<SectorSort, string> = {
  lastCatch: 'По последнему улову',
  popular: 'По популярности',
}

// On the pill itself, which shares a row with the filter chips — short
// enough for that row to stay one line on a 360px phone.
export const SECTOR_SORT_SHORT: Record<SectorSort, string> = {
  lastCatch: 'Свежие',
  popular: 'Топ',
}

const byId = (a: Territory, b: Territory) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// Newer first; a never-fished sector goes after every one that has a catch.
function newerFirst(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return Date.parse(b) - Date.parse(a)
}

// Ties fall back to the catch count, then the sector number — so the
// never-fished sectors still come out in a stable, readable order.
export function compareSectors(sort: SectorSort): (a: Territory, b: Territory) => number {
  if (sort === 'popular') return (a, b) => b.catchCount - a.catchCount || byId(a, b)
  return (a, b) => newerFirst(a.lastCatchAt, b.lastCatchAt) || b.catchCount - a.catchCount || byId(a, b)
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
