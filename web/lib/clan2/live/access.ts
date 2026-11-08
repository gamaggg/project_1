'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { setClan2Allowed } from '@/lib/clan2/live/flag'

// Who sees the clan update in the real app (the hidden launch, supabase-drafts/clan-update-06-11): nobody until the
// server has it (the clan_economy row is there); then the super admin and the members of the pilot clans
// (clan_economy.pilot_clans) while the treasury is off for everybody; and everyone once it is on.
export function useClan2Access(profile: { isSuperAdmin?: boolean; clanId?: number | null } | null | undefined) {
  const { data } = useQuery({
    queryKey: ['clan2-access'],
    enabled: !!profile,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<{ enabled: boolean; pilot: number[] } | null> => {
      const supabase = createClient()
      // The table is not in the generated types until the migrations are applied.
      const from = supabase.from as unknown as (t: string) => { select: (c: string) => { eq: (k: string, v: number) => { maybeSingle: () => Promise<{ data: { enabled: boolean; pilot_clans: number[] | null } | null; error: unknown }> } } }
      const { data, error } = await from('clan_economy').select('enabled,pilot_clans').eq('id', 1).maybeSingle()
      if (error || !data) return null
      return { enabled: !!data.enabled, pilot: (data.pilot_clans ?? []).map(Number) }
    },
  })
  const on = !!data && (data.enabled || !!profile?.isSuperAdmin || (profile?.clanId != null && data.pilot.includes(profile.clanId)))
  useEffect(() => setClan2Allowed(on), [on])
}
