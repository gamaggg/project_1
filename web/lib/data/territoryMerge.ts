import type { Territory, TerritoryCoHolder, TerritoryKind, TerritoryStatus } from '@/lib/data/types'
import { CITIES, cityForSectorId, type CityId } from '@/lib/data/city'
import { compareSectors } from '@/lib/data/sectorOrder'
import type { Database } from '@/lib/types'

// How the map's sectors are put together from two sources: the static geometry of one city
// (public/data/sectors-<prefix>.json, built by scripts/build-sector-geometry.mjs: shape,
// centre and water type of every sector, the same for everybody) and the few
// territories_with_stats rows that say something about a sector — an owner, catches, a shield,
// a hot day, a changed water type, a sector added after the file was built. A sector with no
// such row is a free sector the way the file describes it. Pure functions, no network, so the
// result can be compared with what the old «every row of the city» load produced
// (tests/territory-merge.test.mjs).

export type SectorGeometry = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
}

// One city's file: when it was built (rows created after that may not be in it) and its sectors.
export type SectorGeometryFile = {
  builtAt: string
  sectors: SectorGeometry[]
}

export const TERRITORY_COLUMNS =
  'id, kind, lat, lng, corners, owner_id, owner_avatar_url, owner_display_name, catch_count, last_catch_at, is_deleted, shield_until, owner_equipped_skin, owner_territory_color, owner_clan_id, owner_clan_name, owner_clan_crest, co_holders, capturer_id, hot_until, legend_id, defense'

export type TerritoryViewRow = Pick<
  Database['public']['Views']['territories_with_stats']['Row'],
  'id' | 'kind' | 'lat' | 'lng' | 'corners' | 'owner_id' | 'owner_avatar_url' | 'owner_display_name' | 'catch_count' | 'last_catch_at' | 'is_deleted' | 'shield_until' | 'owner_equipped_skin' | 'owner_territory_color' | 'owner_clan_id' | 'owner_clan_name' | 'owner_clan_crest' | 'co_holders' | 'capturer_id' | 'hot_until' | 'legend_id' | 'defense'
>

// The rows worth loading: everything that differs from «a free sector as the file has it».
// Over-asking is harmless (the result is the same), under-asking would hide something, so this
// lists every field territoryFromRow reads, plus the two ways a sector can differ from the
// file: its water type was changed (kind_changed_at, set by admin_set_territory_kind) or it is
// newer than the file (created_at). A PostgREST or() list: the timestamp carries no comma or plus.
export function touchedRowsFilter(builtAt: string): string {
  return [
    'owner_id.not.is.null',
    'catch_count.gt.0',
    'last_catch_at.not.is.null',
    'shield_until.not.is.null',
    'hot_until.not.is.null',
    'legend_id.not.is.null',
    'capturer_id.not.is.null',
    'co_holders.not.is.null',
    'defense.gt.0',
    'kind_changed_at.not.is.null',
    `created_at.gt.${builtAt}`,
  ].join(',')
}

// 1 while a sector is one of the week's hot ones, else 0.
function hotRank(t: Territory): number {
  return t.hotUntil && new Date(t.hotUntil).getTime() > Date.now() ? 1 : 0
}

// territories_with_stats.co_holders is a jsonb array of {id, avatar_url,
// display_name, equipped_skin}, oldest share first — null when nobody shares
// the sector.
export function toCoHolders(raw: unknown, myId: string | undefined): TerritoryCoHolder[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (h): h is { id: string; avatar_url?: string | null; display_name?: string | null; equipped_skin?: string | null; territory_color?: string | null } =>
        typeof h?.id === 'string'
    )
    .map((h) => ({
      id: h.id,
      avatarUrl: h.avatar_url ?? null,
      displayName: h.display_name ?? null,
      isMe: h.id === myId,
      equippedSkin: h.equipped_skin ?? null,
      color: h.territory_color ?? null,
    }))
}

// One territories_with_stats row (undefined: a sector nobody has touched yet) and its geometry → Territory.
export function territoryFromRow(
  row: TerritoryViewRow | undefined,
  id: string,
  kind: TerritoryKind,
  lat: number,
  lng: number,
  corners: [number, number][],
  userId: string | undefined
): Territory {
  const ownerId = row?.owner_id ?? null
  const status: TerritoryStatus = ownerId === null ? 'free' : ownerId === userId ? 'mine' : 'other'
  return {
    id,
    kind,
    lat,
    lng,
    corners,
    ownerId,
    ownerAvatarUrl: row?.owner_avatar_url ?? null,
    ownerDisplayName: row?.owner_display_name ?? null,
    status,
    catchCount: row?.catch_count ?? 0,
    lastCatchAt: row?.last_catch_at ?? null,
    shieldUntil: row?.shield_until ?? null,
    ownerEquippedSkin: row?.owner_equipped_skin ?? null,
    ownerColor: row?.owner_territory_color ?? null,
    ownerClanId: row?.owner_clan_id ?? null,
    ownerClanName: row?.owner_clan_name ?? null,
    ownerClanCrest: row?.owner_clan_crest ?? null,
    coHolders: toCoHolders(row?.co_holders, userId),
    capturerId: row?.capturer_id ?? null,
    hotUntil: row?.hot_until ?? null,
    legendId: row?.legend_id ?? null,
    defense: row?.defense ?? 0,
  }
}

// The cities whose files are needed to draw `rows` for `city`: the city's own, plus the city of
// every other row (the sectors the player holds elsewhere): a sector the file knows is drawn from
// the file, the way it always was.
export function geometryCitiesNeeded(city: CityId, rows: { id: string | null }[]): CityId[] {
  const need = new Set<CityId>([city])
  for (const row of rows) if (row.id) need.add(cityForSectorId(row.id))
  return [...need]
}

// `geometry`: the files of every city in geometryCitiesNeeded, concatenated. `rows`: the touched
// rows plus the deleted ones ({id, is_deleted: true} is enough for those: a sector the file still
// has but an admin deleted since is dropped by its flag). Returns the city's sectors, and the
// ones the player holds elsewhere, freshest catch first.
export function mergeTerritories(args: { city: CityId | null; userId: string | undefined; geometry: SectorGeometry[]; rows: TerritoryViewRow[] }): Territory[] {
  const { city, userId, geometry, rows } = args
  const prefix = city ? CITIES[city].idPrefix : ''
  const byId = new Map(rows.map((row) => [row.id, row]))
  const staticIds = new Set(geometry.map((g) => g.id))

  const toTerritory = (id: string, kind: TerritoryKind, lat: number, lng: number, corners: [number, number][]): Territory =>
    territoryFromRow(byId.get(id), id, kind, lat, lng, corners, userId)

  // The city's sectors, and the ones the player holds elsewhere (they came with their rows).
  const fromStatic = geometry
    .filter((g) => g.id.startsWith(prefix) || byId.has(g.id))
    // Geometry is a static asset — a sector a super admin deleted (admin_delete_territory)
    // after the file was built stays in it, so it's dropped here based on the DB row's
    // is_deleted flag.
    .filter((g) => !byId.get(g.id)?.is_deleted)
    // The water type in the DB wins over the file's: a super admin can change it
    // (admin_set_territory_kind). The file only fills in for sectors that never got a DB row,
    // or whose row has no kind.
    .map((g) => toTerritory(g.id, byId.get(g.id)?.kind ?? g.kind, g.lat, g.lng, g.corners))

  // Sectors a super admin placed on the map (admin_add_territory) after the file was built live
  // only in the DB: their geometry is stored on the row itself (see lib/data/hexGrid.ts).
  const fromDb = rows
    // territories_with_stats' columns are typed nullable because it's a view (PostgREST can't
    // see the base table's NOT NULL constraints through the join) — id/kind/lat/lng are never
    // actually null here.
    .filter((row): row is typeof row & { corners: NonNullable<typeof row.corners> } => !staticIds.has(row.id!) && !row.is_deleted && !!row.corners)
    .map((row) => toTerritory(row.id!, row.kind!, row.lat!, row.lng!, row.corners as unknown as [number, number][]))

  const all = [...fromStatic, ...fromDb]
  // Nobody has caught anything in this city yet: never-fished sectors go nearest the
  // city's centre first (see compareSectors).
  const near = city && all.every((t) => t.catchCount === 0 || cityForSectorId(t.id) !== city) ? CITIES[city].center : undefined
  return all
    // Freshest catch first everywhere that lists territories (the map's first card, the
    // territories tab) — a single sort here instead of one per screen. Never-fished sectors
    // follow in number order (see compareSectors). The week's hot sectors go before all of them.
    .sort((a, b) => hotRank(b) - hotRank(a) || compareSectors('lastCatch', near)(a, b))
}
