'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useWeeklyLeaderboard } from '@/lib/supabase/queries'
import { tbilisiWeekStart } from '@/lib/format'
import { CITIES, type CityId } from '@/lib/data/city'
import { useUiState } from '@/lib/uiState'

function storageKey(userId: string, city: CityId) {
  return `fishzone:seenWeekTop:${userId}:${city}`
}

// One flag per user holding the last dismissed week's Monday (YYYY-MM-DD) —
// not a growing set like useAchievementUnlock's, since only ever one "current
// last week" exists at a time. Once that Monday rolls forward past what's
// stored, the modal is eligible again without any pruning.
export function useWeekTopModal(city: CityId) {
  const { user } = useAuth()
  const cityInfo = CITIES[city]
  const { data: lastWeekEntries, isSuccess } = useWeeklyLeaderboard(false, -1, cityInfo.idPrefix, cityInfo.timezone)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  // On the account too (lib/uiState.ts), so it isn't shown again on another device.
  const ui = useUiState()
  const uiKey = `week_top_seen:${city}`
  const remoteKey = (ui.state?.[uiKey] as string | undefined) ?? null

  const weekKey = tbilisiWeekStart(-1, cityInfo.timezone).toISOString().slice(0, 10)
  const entry = lastWeekEntries?.find((e) => e.userId === user?.id) ?? null

  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage, only available after mount
    setDismissedKey(localStorage.getItem(storageKey(user.id, city)))
  }, [user?.id, city])
  const seenWeek = [remoteKey, dismissedKey].filter((w): w is string => !!w).sort().pop() ?? null

  function dismiss() {
    if (user) {
      localStorage.setItem(storageKey(user.id, city), weekKey)
      setDismissedKey(weekKey)
      ui.set(uiKey, weekKey)
    }
  }

  const show = isSuccess && ui.ready && !!entry && seenWeek !== weekKey

  return { show, entry, dismiss }
}
