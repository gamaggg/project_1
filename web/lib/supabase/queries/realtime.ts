'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { CITIES, type CityId } from '@/lib/data/city'
import { appInFront } from '@/lib/appFocus'

// How long after the first event of a burst the collected refetches fire.
// Measured from the first event, not reset by later ones, so a steady stream
// of catches still refreshes at least this often. Was 800 ms: every catch
// anywhere reloaded the sectors of everyone online within a second, the
// bulk of the database's view queries (13.11.2026). The player's own catch
// does not wait for it: its mutation invalidates at once.
const REALTIME_COALESCE_MS = 5000

// Fired on window for a clan notification to this player (kind clan_…): the
// clan screen (Clan2Live) reads the clan again at once instead of waiting for
// its next poll.
export const CLAN_NOTIFICATION_EVENT = 'range:clan-notification'

type Row = Record<string, unknown> | null | undefined
// The sector a row event is about: a territories row's own id, a catch's
// territory_id; null when the event does not say (a DELETE carries only the
// primary key).
function sectorOf(key: 'id' | 'territory_id', p: { new?: Row; old?: Row }): string | null {
  const v = p.new?.[key] ?? p.old?.[key]
  return typeof v === 'string' ? v : null
}

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
//
// Only the city on screen: an event about a sector of another city is
// dropped (the sector id starts with its city's letter). The player's own
// sectors elsewhere, which the territories list also carries, come back
// through the player's own notification (it names the sector). While the app
// is away nothing is refetched: the keys are only marked stale and refetch
// when it is back in front (refetchOnWindowFocus).
export function useRealtimeSync(city: CityId) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const cityRef = useRef(city)
  useEffect(() => {
    cityRef.current = city
  }, [city])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const elsewhere = (sector: string | null) => sector !== null && !sector.startsWith(CITIES[cityRef.current].idPrefix)
    const pending = new Map<string, QueryKey>()
    let timer: ReturnType<typeof setTimeout> | null = null
    function schedule(...keys: QueryKey[]) {
      for (const key of keys) pending.set(JSON.stringify(key), key)
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        const keysToRefetch = [...pending.values()]
        pending.clear()
        const refetchType = appInFront() ? 'active' : 'none'
        for (const queryKey of keysToRefetch) queryClient.invalidateQueries({ queryKey, refetchType })
      }, REALTIME_COALESCE_MS)
    }

    const channel = supabase
      .channel('territory-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, (p) => {
        if (!elsewhere(sectorOf('id', p))) schedule(['territories'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches' }, (p) => {
        if (!elsewhere(sectorOf('territory_id', p))) schedule(['territories'], ['catches'])
      })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => {
        schedule(['activity'], ['unread-notifications', user.id], ['support'])
        // About one of the player's sectors in another city (taken from them, say).
        if (elsewhere(sectorOf('territory_id', p))) schedule(['territories'])
        const kind = (p.new as Row)?.kind
        if (typeof kind === 'string' && kind.startsWith('clan_')) window.dispatchEvent(new Event(CLAN_NOTIFICATION_EVENT))
      })
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])
}
