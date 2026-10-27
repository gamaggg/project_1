// The map's sectors the way the app put them together before 27.10.2026: every territories_with_stats
// row of the city (and the player's own elsewhere) plus the one static file for all cities
// (public/data/sectors.json). Kept as the reference the new load (lib/data/territoryMerge.ts: a file
// per city plus only the rows that matter) is compared against, in tests/territory-merge.test.mjs and
// scripts/verify-sector-load.mjs. A verbatim copy of the old useTerritories queryFn after its fetch.
import { CITIES, cityForSectorId } from '@/lib/data/city.ts'
import { compareSectors } from '@/lib/data/sectorOrder.ts'
import { territoryFromRow } from '@/lib/data/territoryMerge.ts'

function hotRank(t) {
  return t.hotUntil && new Date(t.hotUntil).getTime() > Date.now() ? 1 : 0
}

export function oldMerge({ city, userId, geometry, rows }) {
  const prefix = city ? CITIES[city].idPrefix : ''
  const byId = new Map(rows.map((row) => [row.id, row]))
  const staticIds = new Set(geometry.map((g) => g.id))
  const toTerritory = (id, kind, lat, lng, corners) => territoryFromRow(byId.get(id), id, kind, lat, lng, corners, userId)
  const fromStatic = geometry
    .filter((g) => g.id.startsWith(prefix) || byId.has(g.id))
    .filter((g) => !byId.get(g.id)?.is_deleted)
    .map((g) => toTerritory(g.id, byId.get(g.id)?.kind ?? g.kind, g.lat, g.lng, g.corners))
  const fromDb = rows
    .filter((row) => !staticIds.has(row.id) && !row.is_deleted && !!row.corners)
    .map((row) => toTerritory(row.id, row.kind, row.lat, row.lng, row.corners))
  const all = [...fromStatic, ...fromDb]
  const near = city && all.every((t) => t.catchCount === 0 || cityForSectorId(t.id) !== city) ? CITIES[city].center : undefined
  return all.sort((a, b) => hotRank(b) - hotRank(a) || compareSectors('lastCatch', near)(a, b))
}
