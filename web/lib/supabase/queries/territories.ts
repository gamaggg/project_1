'use client'

import { useQuery, useQueryClient, keepPreviousData, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { TerritoryKind, Territory } from '@/lib/data/types'
import { type CityId, CITIES, cityForSectorId } from '@/lib/data/city'
import { fetchTerritoryRows } from '@/lib/data/territoryRows'
import { SECTOR_GEOMETRY_VERSION } from '@/lib/data/sectorGeometryVersion'
import {
  TERRITORY_COLUMNS,
  geometryCitiesNeeded,
  mergeTerritories,
  territoryFromRow,
  touchedRowsFilter,
  type SectorGeometryFile,
} from '@/lib/data/territoryMerge'
import { useIsSuperAdmin } from '@/lib/supabase/queries/profile'

// Geometry never changes at runtime (see tools/fishing-hex) — each city's file is fetched once
// (public/data/sectors-<prefix>.<version>.json, built by scripts/build-sector-geometry.mjs) and cached
// for the life of the tab, independent of ownership state. The version is in the name and in the query
// key: a rebuilt file is a new address, never a stale copy in the service worker or on the phone. See
// lib/data/territoryMerge.ts.
function sectorGeometryQuery(city: CityId) {
  const prefix = CITIES[city].idPrefix
  return {
    queryKey: ['sectors-geometry', city, SECTOR_GEOMETRY_VERSION],
    queryFn: async () => {
      const res = await fetch(`/data/sectors-${prefix}.${SECTOR_GEOMETRY_VERSION}.json`)
      if (!res.ok) throw new Error(`sectors-${prefix}.${SECTOR_GEOMETRY_VERSION}.json: HTTP ${res.status}`)
      return (await res.json()) as SectorGeometryFile
    },
    staleTime: Infinity,
    gcTime: Infinity,
  }
}

export function useSectorsGeometry(city: CityId | null) {
  return useQuery({ ...sectorGeometryQuery(city ?? 'batumi'), enabled: city !== null })
}

// A few sectors outside the loaded city (useTerritories loads the player's city and their own sectors
// elsewhere): the ones opened from an activity entry, a catch or a profile of another city. Fetched by id.
export function extraSectorsKey(userId: string | null | undefined, ids: string[]) {
  return ['territories-extra', userId ?? null, [...ids].sort().join(',')] as const
}
export async function fetchSectorsById(ids: string[], userId: string | undefined, queryClient: ReturnType<typeof useQueryClient>): Promise<Territory[]> {
  if (!ids.length) return []
  const supabase = createClient()
  const cities = [...new Set(ids.map(cityForSectorId))]
  const [files, res] = await Promise.all([
    Promise.all(cities.map((c) => queryClient.ensureQueryData(sectorGeometryQuery(c)))),
    supabase.from('territories_with_stats').select(TERRITORY_COLUMNS).in('id', ids),
  ])
  if (res.error) throw res.error
  const geomById = new Map(files.flatMap((f) => f.sectors).map((g) => [g.id, g]))
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

// One city's sectors (its id prefix), plus the sectors the signed-in player holds in other
// cities (the profile and «Мои» list them). The shape of every sector comes from the city's
// static file; the database is asked only for the rows that say something about a sector (an
// owner, catches, a shield, a hot day, a changed water type, a sector newer than the file: see
// touchedRowsFilter) and for which sectors are deleted. A city of 5k sectors used to be 5k rows,
// each with its corners, on every start and every refresh. `city` null: not known yet (the stored
// or profile city is read right after the first render), nothing is fetched.
export function useTerritories(city: CityId | null) {
  const { user, sessionReady } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['territories', user?.id ?? null, city],
    // Switching city keeps the old city's sectors on screen until the new ones arrive,
    // instead of dropping back to the loading screen.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Territory[]> => {
      if (!city) return []
      const prefix = CITIES[city].idPrefix
      const supabase = createClient()
      // The file says when it was built: rows created after that are not in it, so they are asked for.
      const cityFile = await queryClient.ensureQueryData(sectorGeometryQuery(city))
      const all = await fetchTerritoryRows(supabase, { prefix, userId: user?.id, touched: touchedRowsFilter(cityFile.builtAt) })

      // The files of the other cities a row of the player's belongs to.
      const files = await Promise.all(geometryCitiesNeeded(city, all).map((c) => (c === city ? cityFile : queryClient.ensureQueryData(sectorGeometryQuery(c)))))
      return mergeTerritories({ city, userId: user?.id, geometry: files.flatMap((f) => f.sectors), rows: all })
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
