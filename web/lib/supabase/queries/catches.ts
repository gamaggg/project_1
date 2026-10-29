'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Species, Catch } from '@/lib/data/types'
import type { SpeciesCategory } from '@/lib/data/species'
import type { Database } from '@/lib/types'
import { localSpeciesName } from '@/lib/data/species'

// Reference data (36 species, sea/river/stream/lake) — read-only, cached like
// the sector geometry. See DECISIONS.md for why this is a DB table, not a
// hardcoded list like METHODS/BAITS.
export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: async (): Promise<Species[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('species').select('key, name, category').order('sort_order').order('name')
      if (error) throw error
      return (data as Species[]).map((s) => ({ ...s, name: localSpeciesName(s.name, s.key) }))
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
  species_changed?: boolean | null
  measures_changed?: boolean | null
}

function rowToCatch(c: CatchRow, currentUserId?: string): Catch {
  const info = Array.isArray(c.species_info) ? c.species_info[0] : c.species_info
  return {
    id: c.id,
    territoryId: c.territory_id,
    userId: c.user_id,
    species: c.species,
    speciesName: info?.name ? localSpeciesName(info.name, c.species) : c.species,
    speciesCategory: (info?.category as SpeciesCategory) ?? 'marine',
    lengthCm: c.length_cm,
    weightKg: c.weight_kg,
    method: c.method,
    bait: c.bait,
    photoUrl: c.photo_url,
    caughtAt: c.caught_at,
    mine: c.user_id === currentUserId,
    speciesChanged: !!c.species_changed,
    measuresChanged: !!c.measures_changed,
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

// Parameterized so a user's public profile page can show their catches too —
// `mine` on each Catch still reflects the *viewer's* own id, not userId.
export function useCatchesByUser(userId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'by-user', userId],
    queryFn: async (): Promise<Catch[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select(CATCH_SELECT)
        .eq('user_id', userId!)
        .order('caught_at', { ascending: false })
      if (error) throw error
      return (data as CatchRow[]).map((c) => rowToCatch(c, user?.id))
    },
    enabled: !!userId,
  })
}

// Fetches one catch directly by id — for CatchPhotoScreen, which needs to be
// self-contained (same reasoning as MyCatchesScreen/AchievementDetailScreen)
// and openable from a ?catch=<id> deep link a viewer's own list caches may
// not already contain.
export function useCatchById(id: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'by-id', id],
    queryFn: async (): Promise<Catch> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('catches').select(CATCH_SELECT).eq('id', id!).single()
      if (error) throw error
      return rowToCatch(data as CatchRow, user?.id)
    },
    enabled: !!id,
  })
}

export function useMyCatches() {
  const { user } = useAuth()
  return useCatchesByUser(user?.id ?? null)
}

export type LastCatchChoices = {
  methods: string[]
  baits: string[]
  // The newest catch's species and when it was caught — the form reuses it
  // within the same outing (see ConfirmScreen), when it's often the same fish
  // again and again.
  lastSpecies: { key: string; caughtAt: string } | null
  // Species keys by how often this person caught them, most first.
  frequentSpecies: string[]
  // Baits and methods the same way — the sheets' «Часто…».
  frequentBaits: string[]
  frequentMethods: string[]
}

// The caller's recently used methods, baits and species, newest first, so
// the catch form can open on what they picked last. Read back from their own
// catches rather than a separate "preference" stored per device: it follows
// the account across Telegram and the browser, and needs nothing new saved.
// Lists (not just the latest value) because baits are per city — the form
// takes the newest one that exists in the current sector's city list, so a
// Batumi-only bait doesn't get prefilled on a Moscow catch. Under the
// 'catches' key prefix, so the existing invalidations after a confirmed
// catch refresh it too.
export function useLastCatchChoices() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'last-choices', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<LastCatchChoices> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select('species, method, bait, caught_at')
        .eq('user_id', user!.id)
        .order('caught_at', { ascending: false })
        .limit(60)
      if (error) throw error
      const methods: string[] = []
      const baits: string[] = []
      const counts = new Map<string, number>()
      const baitCounts = new Map<string, number>()
      const methodCounts = new Map<string, number>()
      for (const row of data) {
        if (row.method && !methods.includes(row.method)) methods.push(row.method)
        if (row.bait && !baits.includes(row.bait)) baits.push(row.bait)
        if (row.species) counts.set(row.species, (counts.get(row.species) ?? 0) + 1)
        if (row.bait) baitCounts.set(row.bait, (baitCounts.get(row.bait) ?? 0) + 1)
        if (row.method) methodCounts.set(row.method, (methodCounts.get(row.method) ?? 0) + 1)
      }
      const last = data[0]
      return {
        methods,
        baits,
        lastSpecies: last?.species ? { key: last.species, caughtAt: last.caught_at } : null,
        frequentSpecies: [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([key]) => key),
        frequentBaits: [...baitCounts.entries()].sort((x, y) => y[1] - x[1]).map(([bait]) => bait),
        frequentMethods: [...methodCounts.entries()].sort((x, y) => y[1] - x[1]).map(([method]) => method),
      }
    },
  })
}

export function useAdminDeleteCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (catchId: number) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_delete_catch', { p_catch_id: catchId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

// Super admin fixes a catch that GPS put in the wrong sector — ownership of
// both sectors is recomputed server-side (see admin_move_catch).
export function useAdminMoveCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, territoryId }: { catchId: number; territoryId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_move_catch', { p_catch_id: catchId, p_territory_id: territoryId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

// Super admin: correct a catch's species, length and weight (see
// admin_edit_catch). A new species re-prices the coins paid for the catch
// and sends the angler a notice; their achievements are re-synced
// server-side. Resolves with what
// changed, in the words the admin journal uses.
export function useAdminEditCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, species, lengthCm, weightKg }: { catchId: number; species: string; lengthCm: number | null; weightKg: number | null }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_edit_catch', {
        p_catch_id: catchId,
        p_species: species,
        p_length_cm: lengthCm,
        p_weight_kg: weightKg,
      })
      if (error) throw error
      return (data as { changes?: string[] } | null)?.changes ?? []
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] })
      queryClient.invalidateQueries({ queryKey: ['challenge-week-state'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export function useEditMyCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, lengthCm, weightKg, bait, method, species }: { catchId: number; lengthCm: number | null; weightKg: number | null; bait: string | null; method: string | null; species?: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('edit_my_catch', {
        p_catch_id: catchId,
        p_length_cm: lengthCm,
        p_weight_kg: weightKg,
        p_bait: bait,
        p_method: method,
        // Left out when the species stays (a server from before the release has no such argument).
        ...(species ? { p_species: species } : {}),
      })
      if (error) throw error
      return (data as { changes?: string[] } | null)?.changes ?? []
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] })
      queryClient.invalidateQueries({ queryKey: ['challenge-week-state'] })
      // A new species changes the diary, the species list and the awards.
      queryClient.invalidateQueries({ queryKey: ['diary'] })
      queryClient.invalidateQueries({ queryKey: ['user-awards'] })
    },
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
      const { data, error } = await supabase
        .rpc('confirm_catch', {
          p_territory_id: args.territoryId,
          p_species: args.species,
          p_photo_url: args.photoUrl,
          p_length_cm: args.lengthCm ?? undefined,
          p_weight_kg: args.weightKg ?? undefined,
          p_method: args.method ?? undefined,
          p_bait: args.bait ?? undefined,
        })
        .single()
      if (error) throw error
      return {
        speciesCoins: data.species_coins,
        captureCoins: data.capture_coins,
        clanSupport: !!data.clan_support,
        // «Защита сектора»: an outsider's catch on a defended sector wears
        // the defense down instead of taking it. Both are absent from a
        // server that predates the release migration — then it's a capture,
        // as before.
        attacked: !!data.attacked,
        defense: typeof data.defense === 'number' ? data.defense : null,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      // Every catch adds a free spin in the Shop's slots.
      queryClient.invalidateQueries({ queryKey: ['slot-state'] })
      queryClient.invalidateQueries({ queryKey: ['sector-insights'] })
    },
  })
}

// The caller's most recent catch — right after confirm_catch, that's the
// one just saved (confirm_catch doesn't hand back its id).
export async function latestOwnCatchId(userId: string): Promise<number | null> {
  const supabase = createClient()
  const { data } = await supabase.from('catches').select('id').eq('user_id', userId).order('caught_at', { ascending: false }).limit(1).maybeSingle()
  return data?.id ?? null
}

export type CatchConditions = {
  airTemp: number | null
  waterTemp: number | null
  wind: number | null
  windDir: number | null
  gusts: number | null
  pressure: number | null
  pressureTrend: number | null
  wave: number | null
  weatherCode: number | null
}

// «Погода во время улова»: the stored row if someone has opened this catch
// before, else the server fetches it from Open-Meteo's archive once and
// stores it (/api/catch-conditions). Weather in the past never changes.
// Null when it can't be had — the catch screen just shows nothing then.
export function useCatchConditions(catchId: number | null) {
  return useQuery({
    queryKey: ['catch-conditions', catchId],
    enabled: !!catchId,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<CatchConditions | null> => {
      const supabase = createClient()
      const { data } = await supabase.from('catch_conditions').select('*').eq('catch_id', catchId!).maybeSingle()
      let row: Database['public']['Tables']['catch_conditions']['Row'] | null = data
      if (!row) {
        const res = await fetch('/api/catch-conditions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catchId }) })
        if (!res.ok) return null
        row = await res.json()
      }
      if (!row) return null
      return {
        airTemp: row.air_temp,
        waterTemp: row.water_temp,
        wind: row.wind,
        windDir: row.wind_dir,
        gusts: row.gusts,
        pressure: row.pressure,
        pressureTrend: row.pressure_trend,
        wave: row.wave,
        weatherCode: row.weather_code,
      }
    },
  })
}
