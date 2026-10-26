'use client'

import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

// How long after the first event of a burst the collected refetches fire.
// Measured from the first event, not reset by later ones, so a steady stream
// of catches still refreshes at least this often.
const REALTIME_COALESCE_MS = 800

// Without this, territories/catches/activity only ever refresh from this
// tab's own mutations (the invalidateQueries calls below), a window refocus,
// or a reload — another user's capture never reaches an already-open tab on
// its own (see DECISIONS.md). One shared channel for the session, mirroring
// the same query keys those mutations already invalidate on success; the
// payload itself is ignored; a change just means "go refetch" and the
// existing queries re-apply their own filtering/sorting/RLS as normal.
//
// Coalesced: one catch lands as a burst of row events (the catch itself,
// its sector's update, and more), and each event used to refetch on its
// own — measured 5 requests on every online client for just a two-event
// burst, four of them two full territory reloads (two pages each), each
// also redrawing every polygon on the map. Keys are collected and each is
// invalidated once per burst.
export function useRealtimeSync() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const pending = new Map<string, QueryKey>()
    let timer: ReturnType<typeof setTimeout> | null = null
    function schedule(...keys: QueryKey[]) {
      for (const key of keys) pending.set(JSON.stringify(key), key)
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        const keysToRefetch = [...pending.values()]
        pending.clear()
        for (const queryKey of keysToRefetch) queryClient.invalidateQueries({ queryKey })
      }, REALTIME_COALESCE_MS)
    }

    const channel = supabase
      .channel('territory-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, () => schedule(['territories']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches' }, () => schedule(['territories'], ['catches']))
      // No activity_log listener: the feed is built from `notifications`
      // (below, already scoped to this user) plus announcements, and nothing
      // under the ['activity'] key reads activity_log. Listening to it made
      // every action by anyone in the game refetch this user's feed.
      //
      // Own channel filter (not RLS) — a new row here fires for many users at
      // once (e.g. a claim fans out to one notification per follower), and
      // without user_id=eq scoping this client would get invalidation pings
      // for everyone else's notifications too, not just its own. Covers the
      // unread badge (useUnreadNotificationCount had no realtime source of
      // its own before this) and also fixes new_follower, which activity_log
      // alone never carried — follows never had a listener either.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () =>
        schedule(['activity'], ['unread-notifications', user.id], ['support'])
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])
}
