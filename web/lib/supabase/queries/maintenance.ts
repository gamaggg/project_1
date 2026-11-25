'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// «Идут технические работы»: one switch in the database (supabase-drafts/maintenance-08-11), turned on and off by the
// super admin from «Управление» in the profile. Asked every 5 minutes while the app is in front (was 30 s from every
// player online) and whenever the app comes back to the screen (staleTime 15 s, so a return always asks);
// while it is on, everybody but the super admin sees the maintenance screen (FishZoneApp). Any failure to ask (no
// network, the function not there yet) counts as «off»: the switch must never lock players out by accident.
// shopClosed — «Заглушка магазина» (25.11.2026, supabase-drafts/economy-24-11/12): players see «Магазин обновляется».
export type Maintenance = { enabled: boolean; message: string | null; since: string | null; shopClosed: boolean }
const OFF: Maintenance = { enabled: false, message: null, since: null, shopClosed: false }

export function useMaintenance() {
  return useQuery({
    queryKey: ['maintenance'],
    staleTime: 15_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Maintenance> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_maintenance')
      if (error || !data) return OFF
      const r = data as Record<string, unknown>
      return {
        enabled: r.enabled === true,
        message: typeof r.message === 'string' ? r.message : null,
        since: typeof r.since === 'string' ? r.since : null,
        shopClosed: r.shop_closed === true,
      }
    },
  })
}

export function useSetMaintenance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: { enabled: boolean; message: string | null }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_maintenance', { p_enabled: v.enabled, p_message: v.message })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  })
}

// «Заглушка магазина»: the super admin closes the Shop for players (and opens it again) from «Управление».
export function useSetShopClosed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (closed: boolean) => {
      const supabase = createClient()
      const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>).call(
        supabase,
        'admin_set_shop_closed',
        { p_closed: closed }
      )
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  })
}

