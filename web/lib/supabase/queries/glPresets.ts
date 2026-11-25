'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

// The presets of the paid live backgrounds (25.11.2026, supabase-drafts/economy-24-11/13; glKits.ts, glFamilies.tsx).
// A player remembers one preset per background they own (user_gl_presets); the one that is on the profile is also in
// profiles.hero_bg as «<id>~<preset>». Loosely typed like the Stars calls: the generated types do not know these
// functions until the migration is applied, and before that the list is simply empty.
type LooseRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
const looseRpc = () => {
  const supabase = createClient()
  return supabase.rpc.bind(supabase) as unknown as LooseRpc
}

// background id → the preset the player keeps for it.
export function useMyGlPresets() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-gl-presets', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await looseRpc()('get_my_gl_presets')
      if (error || !data || typeof data !== 'object') return new Map()
      return new Map(Object.entries(data as Record<string, string>))
    },
  })
}

// Saves the preset for a background the player owns; `equip` also puts that background (with the preset) on the profile.
export function useSetHeroBgPreset() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ itemId, preset, equip }: { itemId: string; preset: string; equip: boolean }) => {
      const { error } = await looseRpc()('set_hero_bg_preset', { p_item_id: itemId, p_preset: preset, p_equip: equip })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-gl-presets', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}
