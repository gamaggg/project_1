'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Database } from '@/lib/types'

export type DiaryDay = { day: string; note: string | null; territoryId: string | null }
export type DiaryCatch = {
  id: number
  day: string
  caughtAt: string
  species: string
  lengthCm: number | null
  weightKg: number | null
  photoUrl: string
  territoryId: string | null
}

// Дневник рыбака: the owner's notes / fishing days without a catch, and
// gallery catches that live only here. Owner-only by RLS.
export function useDiary(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['diary', user?.id ?? null],
    enabled: enabled && !!user,
    queryFn: async (): Promise<{ days: DiaryDay[]; catches: DiaryCatch[] }> => {
      const supabase = createClient()
      const [days, catches] = await Promise.all([
        supabase.from('diary_days').select('day, note, territory_id').order('day', { ascending: false }),
        supabase.from('diary_catches').select('id, day, caught_at, species, length_cm, weight_kg, photo_url, territory_id').order('caught_at', { ascending: false }),
      ])
      if (days.error) throw days.error
      if (catches.error) throw catches.error
      return {
        days: days.data.map((d) => ({ day: d.day, note: d.note, territoryId: d.territory_id })),
        catches: catches.data.map((c) => ({
          id: c.id,
          day: c.day,
          caughtAt: c.caught_at,
          species: c.species,
          lengthCm: c.length_cm,
          weightKg: c.weight_kg,
          photoUrl: c.photo_url,
          territoryId: c.territory_id,
        })),
      }
    },
  })
}

export function useSaveDiaryDay() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ day, note, territoryId }: { day: string; note: string | null; territoryId?: string | null }) => {
      const supabase = createClient()
      const row: Database['public']['Tables']['diary_days']['Insert'] = { user_id: user!.id, day, note, updated_at: new Date().toISOString() }
      if (territoryId !== undefined) row.territory_id = territoryId
      const { error } = await supabase.from('diary_days').upsert(row, { onConflict: 'user_id,day' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

// A whole day's entry: the note / fishing-day mark and the gallery photos of
// that day. Catches counted in the game aren't the diary's to delete.
export function useDeleteDiaryDay() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (day: string) => {
      const supabase = createClient()
      const [days, catches] = await Promise.all([
        supabase.from('diary_days').delete().eq('user_id', user!.id).eq('day', day),
        supabase.from('diary_catches').delete().eq('user_id', user!.id).eq('day', day),
      ])
      if (days.error) throw days.error
      if (catches.error) throw catches.error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

export function useAddDiaryCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (c: Omit<DiaryCatch, 'id'> & { lat: number | null; lng: number | null }) => {
      const supabase = createClient()
      const { error } = await supabase.from('diary_catches').insert({
        day: c.day,
        caught_at: c.caughtAt,
        species: c.species,
        length_cm: c.lengthCm,
        weight_kg: c.weightKg,
        photo_url: c.photoUrl,
        lat: c.lat,
        lng: c.lng,
        territory_id: c.territoryId,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

export function useDeleteDiaryCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const supabase = createClient()
      const { error } = await supabase.from('diary_catches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}
