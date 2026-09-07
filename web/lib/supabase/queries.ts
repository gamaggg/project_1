'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Territory, Catch, ActivityEntry, TerritoryKind } from '@/lib/data/types'
import type { SpeciesKey } from '@/lib/data/species'

type SectorGeometry = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
}

// Geometry never changes at runtime (see tools/fishing-hex) — fetched once from the
// static asset and cached for the life of the tab, independent of ownership state.
function useSectorsGeometry() {
  return useQuery({
    queryKey: ['sectors-geometry'],
    queryFn: async () => {
      const res = await fetch('/data/sectors.json')
      return (await res.json()) as SectorGeometry[]
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Merges static geometry with live Supabase ownership (territories_with_stats) —
// see DECISIONS.md for why geometry stays a static asset instead of DB rows.
export function useTerritories() {
  const { user } = useAuth()
  const geometry = useSectorsGeometry()

  return useQuery({
    queryKey: ['territories', user?.id ?? null],
    queryFn: async (): Promise<Territory[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('territories_with_stats')
        .select('id, kind, lat, lng, owner_id, catch_count, last_catch_at')
      if (error) throw error

      const byId = new Map(data!.map((row) => [row.id, row]))
      return geometry.data!.map((g) => {
        const row = byId.get(g.id)
        const ownerId = row?.owner_id ?? null
        return {
          id: g.id,
          kind: g.kind,
          lat: g.lat,
          lng: g.lng,
          corners: g.corners,
          ownerId,
          status: ownerId === null ? 'free' : ownerId === user?.id ? 'mine' : 'other',
          catchCount: row?.catch_count ?? 0,
          lastCatchAt: row?.last_catch_at ?? null,
        }
      })
    },
    enabled: geometry.isSuccess,
  })
}

export function useCatchesByTerritory(territoryId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'territory', territoryId],
    queryFn: async (): Promise<Catch[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select('*')
        .eq('territory_id', territoryId!)
        .order('caught_at', { ascending: false })
      if (error) throw error
      return data!.map((c) => rowToCatch(c, user?.id))
    },
    enabled: !!territoryId,
  })
}

export function useMyCatches() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'mine', user?.id ?? null],
    queryFn: async (): Promise<Catch[]> => {
      if (!user) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select('*')
        .eq('user_id', user.id)
        .order('caught_at', { ascending: false })
      if (error) throw error
      return data!.map((c) => rowToCatch(c, user.id))
    },
    enabled: !!user,
  })
}

function rowToCatch(
  c: { id: number; territory_id: string; user_id: string; species: SpeciesKey; length_cm: number; weight_kg: number; method: string; bait: string; caught_at: string },
  currentUserId?: string
): Catch {
  return {
    id: c.id,
    territoryId: c.territory_id,
    userId: c.user_id,
    species: c.species,
    lengthCm: c.length_cm,
    weightKg: c.weight_kg,
    method: c.method,
    bait: c.bait,
    caughtAt: c.caught_at,
    mine: c.user_id === currentUserId,
  }
}

export function useActivity() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['activity', user?.id ?? null],
    queryFn: async (): Promise<ActivityEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('activity_log')
        .select(
          'id, kind, created_at, user_id, territory_id, territories(kind), catches(species, length_cm, weight_kg), profiles(display_name)'
        )
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error

      return data!.map((row): ActivityEntry => {
        const territory = Array.isArray(row.territories) ? row.territories[0] : row.territories
        const c = Array.isArray(row.catches) ? row.catches[0] : row.catches
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id: row.id,
          who: row.user_id === user?.id ? 'Ты' : profile?.display_name ?? 'Рыбак',
          mine: row.user_id === user?.id,
          kind: row.kind as 'catch' | 'claim',
          territoryId: row.territory_id,
          territoryKind: territory?.kind ?? 'sea',
          species: c?.species ?? null,
          lengthCm: c?.length_cm ?? null,
          weightKg: c?.weight_kg ?? null,
          createdAt: row.created_at,
        }
      })
    },
  })
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export function useConfirmCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      territoryId: string
      species: SpeciesKey
      lengthCm: number
      weightKg: number
      method: string
      bait: string
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('confirm_catch', {
        p_territory_id: args.territoryId,
        p_species: args.species,
        p_length_cm: args.lengthCm,
        p_weight_kg: args.weightKg,
        p_method: args.method,
        p_bait: args.bait,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}
