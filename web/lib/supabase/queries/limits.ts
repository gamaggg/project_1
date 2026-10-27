'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ServiceLimits } from '@/lib/data/serviceLimits'

// «Лимиты сервисов» in the profile: the super admin, or an admin given the switch
// (get_service_limits checks the same itself).
export function useServiceLimits(enabled: boolean) {
  return useQuery({
    queryKey: ['service-limits'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ServiceLimits> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_service_limits')
      if (error) throw error
      return data as unknown as ServiceLimits
    },
  })
}
