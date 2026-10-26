'use client'

import { useQuery, useQueryClient, keepPreviousData, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { TerritoryKind, Territory, TerritoryCoHolder, TerritoryStatus } from '@/lib/data/types'
import { type CityId, CITIES, cityForSectorId } from '@/lib/data/city'
import { compareSectors } from '@/lib/data/sectorOrder'
import type { Database } from '@/lib/types'
import { useIsSuperAdmin } from '@/lib/supabase/queries/profile'

type SectorGeometry = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
}

// Geometry never changes at runtime (see tools/fishing-hex) — fetched once from the
// static asset and cached for the life of the tab, independent of ownership state.
const sectorsGeometryQuery = {
  queryKey: ['sectors-geometry'],
  queryFn: async () => {
    const res = await fetch('/data/sectors.json')
    return (await res.json()) as SectorGeometry[]
  },
  staleTime: Infinity,
  gcTime: Infinity,
}

export function useSectorsGeometry() {
  return useQuery(sectorsGeometryQuery)
}

// territories_with_stats had ~1.9k rows in Sept 2026 — two pages. Those are
// requested together instead of one after the other; a table that outgrows
// them still loads in full, the extra pages just follow sequentially.
// 1 while a sector is one of the week's hot ones, else 0.
function hotRank(t: Territory): number {
  return t.hotUntil && new Date(t.hotUntil).getTime() > Date.now() ? 1 : 0
}

const TERRITORY_PAGE_SIZE = 1000
// A city's rows (deleted ones included) come in 1000-row pages; the first pages are asked for
// together when the city is known to fill more than one (Moscow ~5.1k since the sectors up to the
// Central Ring Road, Saint Petersburg ~1.5k), so the next pages cost no extra round trip. The other
// cities fit one page.
const TERRITORY_PARALLEL_PAGES: Partial<Record<CityId, number>> = { moscow: 6, spb: 2 }

// territories_with_stats.co_holders is a jsonb array of {id, avatar_url,
// display_name, equipped_skin}, oldest share first — null when nobody shares
// the sector.
function toCoHolders(raw: unknown, myId: string | undefined): TerritoryCoHolder[] {
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

// Merges static geometry with live Supabase ownership (territories_with_stats) —
// see DECISIONS.md for why geometry stays a static asset instead of DB rows.
// One city's sectors (its id prefix), plus the sectors the signed-in player holds in other
// cities (the profile and «Мои» list them). With five cities the whole table is ~4.5k rows
// and each row carries its corners, so everyone loading every city would make the start
// heavier by more than twice for nothing. `city` null: not known yet (the stored or profile
// city is read right after the first render), nothing is fetched.
const TERRITORY_COLUMNS =
  'id, kind, lat, lng, corners, owner_id, owner_avatar_url, owner_display_name, catch_count, last_catch_at, is_deleted, shield_until, owner_equipped_skin, owner_territory_color, owner_clan_id, owner_clan_name, owner_clan_crest, co_holders, capturer_id, hot_until, legend_id, defense'

type TerritoryViewRow = Pick<
  Database['public']['Views']['territories_with_stats']['Row'],
  'id' | 'kind' | 'lat' | 'lng' | 'corners' | 'owner_id' | 'owner_avatar_url' | 'owner_display_name' | 'catch_count' | 'last_catch_at' | 'is_deleted' | 'shield_until' | 'owner_equipped_skin' | 'owner_territory_color' | 'owner_clan_id' | 'owner_clan_name' | 'owner_clan_crest' | 'co_holders' | 'capturer_id' | 'hot_until' | 'legend_id' | 'defense'
>

// One territories_with_stats row (undefined: a sector nobody has touched yet) and its geometry → Territory.
function territoryFromRow(
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

// A few sectors outside the loaded city (useTerritories loads the player's city and their own sectors
// elsewhere): the ones opened from an activity entry, a catch or a profile of another city. Fetched by id.
export function extraSectorsKey(userId: string | null | undefined, ids: string[]) {
  return ['territories-extra', userId ?? null, [...ids].sort().join(',')] as const
}
export async function fetchSectorsById(ids: string[], userId: string | undefined, queryClient: ReturnType<typeof useQueryClient>): Promise<Territory[]> {
  if (!ids.length) return []
  const supabase = createClient()
  const [geometry, res] = await Promise.all([
    queryClient.ensureQueryData(sectorsGeometryQuery),
    supabase.from('territories_with_stats').select(TERRITORY_COLUMNS).in('id', ids),
  ])
  if (res.error) throw res.error
  const geomById = new Map(geometry.map((g) => [g.id, g]))
  const out: Territory[] = []
  for (const row of res.data) {
    if (!row.id || row.is_deleted) continue
    const g = geomById.get(row.id)
    if (g) out.push(territoryFromRow(row, row.id, (row.kind as TerritoryKind | null) ?? g.kind, g.lat, g.lng, g.corners, userId))
    else if (row.corners && row.kind && row.lat != null && row.lng != null)
      out.push(territoryFromRow(row, row.id, row.kind as TerritoryKind, row.lat, row.lng, row.corners as unknown as [number, number][], userId))
  }
  return out
}
export function useExtraSectors(ids: string[]) {
  const { user, sessionReady } = useAuth()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: extraSectorsKey(user?.id, ids),
    enabled: sessionReady && ids.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: () => fetchSectorsById(ids, user?.id, queryClient),
  })
}

export function useTerritories(city: CityId | null) {
  const { user, sessionReady } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['territories', user?.id ?? null, city],
    // Switching city keeps the old city's sectors on screen until the new ones arrive,
    // instead of dropping back to the loading screen.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Territory[]> => {
      const prefix = city ? CITIES[city].idPrefix : ''
      const parallelPages = (city && TERRITORY_PARALLEL_PAGES[city]) || 1
      const supabase = createClient()
      const columns = TERRITORY_COLUMNS
      // PostgREST caps a single response at 1000 rows by default and stays
      // silent about it (no error, just a truncated array) — the table
      // crossed that count once admin-added sectors piled up, which is how
      // a whole batch of newly created territories could exist in the
      // database yet never reach the map. Page through with .range() so the
      // table can keep growing past 1000 without this recurring.
      const pageSize = TERRITORY_PAGE_SIZE
      // Pages need a fixed order: without one, two separate requests may
      // come back in different orders and overlap — some sectors twice,
      // others (up to hundreds) missing from the map.
      const fetchPage = (from: number) => {
        const query = supabase.from('territories_with_stats').select(columns).order('id').range(from, from + pageSize - 1)
        // In a PostgREST or() the LIKE wildcard is *, not %.
        return user ? query.or(`id.like.${prefix}*,owner_id.eq.${user.id}`) : query.like('id', `${prefix}%`)
      }
      // The static geometry and the first pages are fetched side by side —
      // the rows don't need the geometry until the merge below, so waiting
      // for sectors.json before asking the database only delayed the map.
      const [geometry, pages] = await Promise.all([
        queryClient.ensureQueryData(sectorsGeometryQuery),
        Promise.all(Array.from({ length: parallelPages }, (_, i) => fetchPage(i * pageSize))),
      ])
      const data: NonNullable<(typeof pages)[number]['data']> = []
      for (const page of pages) {
        if (page.error) throw page.error
        data.push(...page.data)
      }
      let lastPageLength = pages[pages.length - 1].data?.length ?? 0
      for (let from = parallelPages * pageSize; lastPageLength === pageSize; from += pageSize) {
        const page = await fetchPage(from)
        if (page.error) throw page.error
        data.push(...page.data)
        lastPageLength = page.data.length
      }

      const byId = new Map(data.map((row) => [row.id, row]))
      const staticIds = new Set(geometry.map((g) => g.id))

      const toTerritory = (id: string, kind: TerritoryKind, lat: number, lng: number, corners: [number, number][]): Territory =>
        territoryFromRow(byId.get(id), id, kind, lat, lng, corners, user?.id)

      // The static file holds Batumi and Moscow both: only this city's sectors, and the
      // ones the player holds elsewhere (they came with their rows), are shown.
      const fromStatic = geometry
        .filter((g) => g.id.startsWith(prefix) || byId.has(g.id))
        // Geometry is a static asset (see useSectorsGeometry) — a sector a
        // super admin deleted (admin_delete_territory) stays in that file,
        // so it's dropped here based on the DB row's is_deleted flag instead.
        .filter((g) => !byId.get(g.id)?.is_deleted)
        // The water type in the DB wins over the static file's: a super
        // admin can change it (admin_set_territory_kind), and streams were
        // merged into rivers there. The file only fills in for sectors that
        // never got a DB row, or whose row has no kind.
        .map((g) => toTerritory(g.id, byId.get(g.id)?.kind ?? g.kind, g.lat, g.lng, g.corners))

      // Sectors a super admin placed on the map (admin_add_territory) live
      // only in the DB — the static file is generated once offline (see
      // tools/fishing-hex) and isn't writable at runtime, so their geometry
      // is stored on the row itself instead (see lib/data/hexGrid.ts for how
      // it's computed to still land on the exact same grid).
      const fromDb = data
        // territories_with_stats' columns are typed nullable because it's a
        // view (PostgREST can't see the base table's NOT NULL constraints
        // through the join) — id/kind/lat/lng are never actually null here,
        // same reasoning as useAllUsers' row.id! below.
        .filter((row): row is typeof row & { corners: NonNullable<typeof row.corners> } => !staticIds.has(row.id!) && !row.is_deleted && !!row.corners)
        .map((row) => toTerritory(row.id!, row.kind!, row.lat!, row.lng!, row.corners as unknown as [number, number][]))

      const all = [...fromStatic, ...fromDb]
      // Nobody has caught anything in this city yet: never-fished sectors go nearest the
      // city's centre first (see compareSectors).
      const near = city && all.every((t) => t.catchCount === 0 || cityForSectorId(t.id) !== city) ? CITIES[city].center : undefined
      return all
        // Freshest catch first everywhere that lists territories (the map's
        // first card, the territories tab) — a single sort here instead of
        // one per screen, since every consumer shares this same array; the
        // tab re-sorts only when another order is picked there. Never-fished
        // sectors follow in number order (see compareSectors). The week's
        // hot sectors go before all of them — the map's first cards.
        .sort((a, b) => hotRank(b) - hotRank(a) || compareSectors('lastCatch', near)(a, b))
    },
    // Until the stored session is read the key would say "no user" and the
    // whole table would be fetched once for nobody, then again for the real
    // user.
    enabled: sessionReady && city !== null,
  })
}

// Every id that has ever existed, deleted or not — useTerritories() filters
// out is_deleted rows, but admin_add_territory rejects any id that's already
// a row in the table regardless of is_deleted, so picking a "next available"
// id (see lib/data/hexGrid.ts's nextSectorId) needs the unfiltered set or it
// can re-offer an id that's just soft-deleted, not actually free. Admin-only:
// nothing outside the bulk-add flow needs this.
export function useAllTerritoryIds() {
  const isSuperAdmin = useIsSuperAdmin()
  return useQuery({
    queryKey: ['all-territory-ids'],
    enabled: isSuperAdmin,
    queryFn: async (): Promise<string[]> => {
      const supabase = createClient()
      // Same PostgREST 1000-row cap as useTerritories() above — this list
      // decides the next free sector id (see hexGrid.ts's nextSectorId), so
      // a silent truncation here doesn't just hide rows, it makes the admin
      // bulk-add flow think already-used ids are free and collide with them.
      const pageSize = 1000
      const ids: string[] = []
      let lastPageLength = 0
      for (let from = 0; from === 0 || lastPageLength === pageSize; from += pageSize) {
        const { data, error } = await supabase.from('territories').select('id').order('id').range(from, from + pageSize - 1)
        if (error) throw error
        ids.push(...data.map((row) => row.id))
        lastPageLength = data.length
      }
      return ids
    },
  })
}

export function useAdminSetTerritoryKind() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ territory, kind }: { territory: Territory; kind: TerritoryKind }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_territory_kind', {
        p_territory_id: territory.id,
        p_kind: kind,
        p_lat: territory.lat,
        p_lng: territory.lng,
      })
      if (error) throw error
    },
    // Returned so the mutation stays pending until the map has the new
    // kind — otherwise the picker flashes back to the old one in between.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      return queryClient.invalidateQueries({ queryKey: ['territories'] })
    },
  })
}

export function useAdminDeleteTerritory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (territoryId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_delete_territory', { p_territory_id: territoryId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
    },
  })
}

export function useAdminAddTerritory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (draft: { id: string; kind: TerritoryKind; lat: number; lng: number; corners: [number, number][] }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_add_territory', {
        p_id: draft.id,
        p_kind: draft.kind,
        p_lat: draft.lat,
        p_lng: draft.lng,
        p_corners: draft.corners,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      queryClient.invalidateQueries({ queryKey: ['all-territory-ids'] })
    },
  })
}

export function useUseFreeShield() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (territoryId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('use_free_shield', { p_territory_id: territoryId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['slot-state', user?.id ?? null] })
    },
  })
}
