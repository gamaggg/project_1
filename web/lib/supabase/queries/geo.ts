'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { GeoToday, GeoResult, GeoBoardEntry, GeoSectorStory, AdminGeoPanorama, GeoCity, AdminGeoPlanDay } from '@/lib/geo'

// «Где это?» (lib/geo.ts): today's panorama in the player's city and, once
// they've guessed, the answer. Picked on the server, the same for everyone.
export function useGeoToday() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['geo-today', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<GeoToday> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_geo_today')
      if (error) throw error
      return data as unknown as GeoToday
    },
  })
}

// Like the slots, this doesn't refresh the balance itself: GeoScreen does it
// once the answer has been shown.
export function useSubmitGeoGuess() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (territoryId: string): Promise<GeoResult & { balance: number }> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('submit_geo_guess', { p_territory_id: territoryId })
      if (error) throw error
      return data as unknown as GeoResult & { balance: number }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<GeoToday>(['geo-today', user?.id ?? null], (prev) => (prev ? { ...prev, result } : prev))
      queryClient.invalidateQueries({ queryKey: ['geo-board'] })
    },
  })
}

// Today's results in the city — the right sector first, then the closest —
// empty until the player's own guess.
export function useGeoBoard(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['geo-board', user?.id ?? null],
    enabled: !!user && enabled,
    queryFn: async (): Promise<GeoBoardEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_geo_board')
      if (error) throw error
      return (data ?? []).map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        equippedFrame: r.equipped_frame,
        territoryId: r.territory_id,
        correct: r.correct,
        distance: r.distance_m,
        coins: r.coins,
        isMe: r.is_me,
      }))
    },
  })
}

// The answer's sector as a story — owner, catches, species, record, the last
// three catches — for the result screen.
export function useGeoSector(territoryId: string | null) {
  return useQuery({
    queryKey: ['geo-sector', territoryId],
    enabled: !!territoryId,
    queryFn: async (): Promise<GeoSectorStory> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_geo_sector', { p_territory_id: territoryId! })
      if (error) throw error
      return data as unknown as GeoSectorStory
    },
  })
}

// Super admin: the imported panoramas to look through (scripts/geo-import.mjs).
export function useAdminGeoList(status: AdminGeoPanorama['status']) {
  return useQuery({
    queryKey: ['admin-geo', status],
    queryFn: async (): Promise<AdminGeoPanorama[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_geo_list', { p_status: status })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        city: r.city,
        lat: r.lat,
        lng: r.lng,
        territoryId: r.territory_id,
        image: r.image_path,
        heading: r.heading,
        north: r.north,
        source: r.source,
        sourceId: r.source_id,
        author: r.author,
        capturedAt: r.captured_at,
        status: r.status as AdminGeoPanorama['status'],
        shown: r.shown,
        lastShown: r.last_shown,
        quality: r.quality,
        waterM: r.water_m,
        nextDay: r.next_day,
      }))
    },
  })
}

// Taking a panorama out of the game also takes it off the days it was
// planned for — the plan is refetched with the lists.
export function useAdminGeoReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, heading }: { id: number; status: AdminGeoPanorama['status']; heading?: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_geo_review', { p_id: id, p_status: status, p_heading: heading })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-geo'] })
      queryClient.invalidateQueries({ queryKey: ['admin-geo-plan'] })
    },
  })
}

// Super admin's plan: the next 30 days of a city, which panorama each shows.
export function useAdminGeoPlan(city: GeoCity, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-geo-plan', city],
    enabled,
    queryFn: async (): Promise<AdminGeoPlanDay[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_geo_plan', { p_city: city, p_days: 30 })
      if (error) throw error
      return (data ?? []).map((r) => ({
        day: r.day,
        panoramaId: r.panorama_id,
        image: r.image_path,
        territoryId: r.territory_id,
        heading: r.heading,
        locked: r.locked,
      }))
    },
  })
}

function invalidateGeoPlan(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-geo-plan'] })
  // «В плане на …» on the approved ones.
  queryClient.invalidateQueries({ queryKey: ['admin-geo'] })
}

// A panorama on a day, or the day emptied (panoramaId null).
export function useAdminGeoSetDay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ city, day, panoramaId }: { city: GeoCity; day: string; panoramaId: number | null }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_geo_set_day', { p_city: city, p_day: day, p_panorama_id: panoramaId })
      if (error) throw error
    },
    onSuccess: () => invalidateGeoPlan(queryClient),
  })
}

// The empty days of the next 30 filled with approved panoramas not used yet,
// the best first; resolves to how many days got one.
export function useAdminGeoFill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (city: GeoCity): Promise<number> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_geo_fill', { p_city: city, p_days: 30 })
      if (error) throw error
      return data ?? 0
    },
    onSuccess: () => invalidateGeoPlan(queryClient),
  })
}
