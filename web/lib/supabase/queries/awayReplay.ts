'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { AwayRow } from '@/lib/data/awayEvents'

// «Пока тебя не было» (AwayReplay): sectors taken from the player or attacked
// while they were away — the same sector_lost / sector_attacked notifications the
// feed shows, still unread there (whoever read the feed already knows) and newer
// than the last replay on this device. Fetched once per app start, not on every
// return to the tab. The notifications stay unread: the replay is no reason to
// clear the «Активность» badge.
//
// «Shown» lives in this browser (localStorage), so another phone replays the same
// news once more if it is still unread there; marking single notifications read
// from the client isn't possible (they only have a read policy).
const SEEN_KEY = 'range.awayReplay.seenUntil'
const MAX_AGE_MS = 7 * 86_400_000

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

// Seen from the moment the replay starts: closing the app halfway doesn't bring it back.
export function markAwayReplaySeen(until: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, until)
  } catch {
    // private mode: the replay may come again next start, nothing else breaks
  }
}

export function useAwayEvents(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['away-replay', user?.id ?? null],
    enabled: enabled && !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<{ rows: AwayRow[] }> => {
      const supabase = createClient()
      const seen = readSeen()
      const since = new Date(Date.now() - MAX_AGE_MS).toISOString()
      const { data, error } = await supabase
        .from('notifications')
        .select('id, kind, created_at, territory_id, payload, actor:profiles!notifications_actor_id_fkey(display_name, avatar_url, territory_color)')
        .in('kind', ['sector_lost', 'sector_attacked'])
        .is('read_at', null)
        .gt('created_at', seen && seen > since ? seen : since)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return { rows: (data ?? []) as unknown as AwayRow[] }
    },
  })
}
