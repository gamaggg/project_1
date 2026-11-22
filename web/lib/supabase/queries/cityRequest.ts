'use client'

import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// «Нет твоего города?» on the city step of sign-up: the city the player typed goes to request_city
// (supabase-drafts/city-requests-22-11), which keeps it and tells the super admins in «Активность» and
// Telegram. A repeat within a minute, or a fourth in a day, comes back as CITY_REQUEST:too_fast / too_many.
export type CityRequestResult = 'sent' | 'limit'

export function useRequestCity() {
  return useMutation({
    mutationFn: async (city: string): Promise<CityRequestResult> => {
      const { error } = await createClient().rpc('request_city', { p_city: city })
      if (!error) return 'sent'
      if (/CITY_REQUEST:too_(fast|many)/.test(error.message)) return 'limit'
      throw error
    },
  })
}
