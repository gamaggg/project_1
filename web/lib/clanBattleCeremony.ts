'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useClanRace } from '@/lib/supabase/queries'
import type { CityId } from '@/lib/data/city'

function storageKey(userId: string, city: CityId) {
  return `fishzone:seenClanBattle:${userId}:${city}`
}

// The clan battle's results ceremony — once per week per city, for players
// whose clan raced last week. Same shape as useWeekTopModal: one stored
// value, the current week's start, so the next week re-arms it without any
// pruning. Reads the race the map's plaque already loads (same query key),
// so it costs nothing extra.
export function useClanBattleCeremony(city: CityId, clanId: number | null) {
  const { user } = useAuth()
  const { data: race } = useClanRace(city, !!clanId)
  const [seenWeek, setSeenWeek] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    let stored: string | null = null
    try {
      stored = localStorage.getItem(storageKey(user.id, city))
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage, only available after mount
    setSeenWeek(stored)
  }, [user?.id, city])

  const weekKey = race?.weekStart.slice(0, 10) ?? null
  const mine = race && clanId ? race.lastWeek.find((c) => c.id === clanId) : undefined

  function dismiss() {
    if (!user || !weekKey) return
    try {
      localStorage.setItem(storageKey(user.id, city), weekKey)
    } catch {}
    setSeenWeek(weekKey)
  }

  const show = !!race && !!mine && !!weekKey && seenWeek !== undefined && seenWeek !== weekKey
  return { show, race, clanId, dismiss }
}
