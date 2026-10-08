'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/providers/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/types'

// Per-account «seen / hidden» flags for one-time UI — which achievement
// popups were shown, the hidden recap week, last week's top-3 and clan-battle
// ceremonies, the spotlight tours (table user_ui_state, own rows only). They
// used to live in each device's localStorage, so a popup closed on the phone
// came back in Telegram on the desktop, and on iPhone Telegram sometimes on
// the same phone, whenever it dropped the Mini App's storage. One tiny read
// per launch; every write goes to the cache at once and to the table in the
// background. Callers keep localStorage too: it covers guests, and a device
// that hid something before this existed hands it over on first read.
export type UiState = Record<string, Json>

export function useUiState() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? null
  const q = useQuery({
    queryKey: ['ui-state', userId],
    enabled: !!userId,
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<UiState> => {
      const { data, error } = await createClient().from('user_ui_state').select('key, value')
      if (error) throw error
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    },
  })

  const set = useCallback(
    (key: string, value: Json) => {
      if (!userId) return
      queryClient.setQueryData<UiState>(['ui-state', userId], (old) => ({ ...(old ?? {}), [key]: value }))
      void createClient()
        .from('user_ui_state')
        .upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' })
        .then(() => undefined)
    },
    [userId, queryClient]
  )

  // `ready` also when the read failed (offline, say): callers then go by
  // localStorage alone, as before.
  return { ready: !userId || q.isSuccess || q.isError, state: q.data ?? null, set }
}
