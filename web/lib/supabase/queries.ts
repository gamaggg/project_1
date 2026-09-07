'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Territory, Catch, ActivityEntry, TerritoryKind, Species } from '@/lib/data/types'

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

// Reference data (36 species, sea/river/stream/lake) — read-only, cached like
// the sector geometry. See DECISIONS.md for why this is a DB table, not a
// hardcoded list like METHODS/BAITS.
export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: async (): Promise<Species[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('species').select('key, name, category').order('name')
      if (error) throw error
      return data as Species[]
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

const CATCH_SELECT = '*, species_info:species(name, category)'

type CatchRow = {
  id: number
  territory_id: string
  user_id: string
  species: string
  species_info: { name: string; category: string } | { name: string; category: string }[] | null
  length_cm: number | null
  weight_kg: number | null
  method: string | null
  bait: string | null
  photo_url: string
  caught_at: string
}

function rowToCatch(c: CatchRow, currentUserId?: string): Catch {
  const info = Array.isArray(c.species_info) ? c.species_info[0] : c.species_info
  return {
    id: c.id,
    territoryId: c.territory_id,
    userId: c.user_id,
    species: c.species,
    speciesName: info?.name ?? c.species,
    speciesCategory: (info?.category as 'marine' | 'freshwater') ?? 'marine',
    lengthCm: c.length_cm,
    weightKg: c.weight_kg,
    method: c.method,
    bait: c.bait,
    photoUrl: c.photo_url,
    caughtAt: c.caught_at,
    mine: c.user_id === currentUserId,
  }
}

export function useCatchesByTerritory(territoryId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'territory', territoryId],
    queryFn: async (): Promise<Catch[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select(CATCH_SELECT)
        .eq('territory_id', territoryId!)
        .order('caught_at', { ascending: false })
      if (error) throw error
      return (data as CatchRow[]).map((c) => rowToCatch(c, user?.id))
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
        .select(CATCH_SELECT)
        .eq('user_id', user.id)
        .order('caught_at', { ascending: false })
      if (error) throw error
      return (data as CatchRow[]).map((c) => rowToCatch(c, user.id))
    },
    enabled: !!user,
  })
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
          'id, kind, created_at, user_id, territory_id, territories(kind), catches(length_cm, weight_kg, photo_url, species_info:species(name, category)), profiles(display_name)'
        )
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error

      return data!.map((row): ActivityEntry => {
        const territory = Array.isArray(row.territories) ? row.territories[0] : row.territories
        const c = Array.isArray(row.catches) ? row.catches[0] : row.catches
        const speciesInfo = c ? (Array.isArray(c.species_info) ? c.species_info[0] : c.species_info) : null
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id: row.id,
          who: row.user_id === user?.id ? 'Ты' : (profile?.display_name ?? 'Рыбак'),
          mine: row.user_id === user?.id,
          kind: row.kind as 'catch' | 'claim',
          territoryId: row.territory_id,
          territoryKind: territory?.kind ?? 'sea',
          speciesName: speciesInfo?.name ?? null,
          speciesCategory: (speciesInfo?.category as 'marine' | 'freshwater' | undefined) ?? null,
          lengthCm: c?.length_cm ?? null,
          weightKg: c?.weight_kg ?? null,
          photoUrl: c?.photo_url ?? null,
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
      species: string
      photoUrl: string
      lengthCm: number | null
      weightKg: number | null
      method: string | null
      bait: string | null
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('confirm_catch', {
        p_territory_id: args.territoryId,
        p_species: args.species,
        p_photo_url: args.photoUrl,
        p_length_cm: args.lengthCm ?? undefined,
        p_weight_kg: args.weightKg ?? undefined,
        p_method: args.method ?? undefined,
        p_bait: args.bait ?? undefined,
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
