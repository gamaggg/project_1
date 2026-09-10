'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useWeeklyLeaderboard } from '@/lib/supabase/queries'
import { tbilisiWeekStart } from '@/lib/format'

function storageKey(userId: string) {
  return `fishzone:seenWeekTop:${userId}`
}

// One flag per user holding the last dismissed week's Monday (YYYY-MM-DD) —
// not a growing set like useAchievementUnlock's, since only ever one "current
// last week" exists at a time. Once that Monday rolls forward past what's
// stored, the modal is eligible again without any pruning.
export function useWeekTopModal() {
  const { user } = useAuth()
  const { data: lastWeekEntries, isSuccess } = useWeeklyLeaderboard(false, -1)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  const weekKey = tbilisiWeekStart(-1).toISOString().slice(0, 10)
  const entry = lastWeekEntries?.find((e) => e.userId === user?.id) ?? null

  useEffect(() => {
    if (!user) return
    setDismissedKey(localStorage.getItem(storageKey(user.id)))
  }, [user?.id])

  function dismiss() {
    if (user) {
      localStorage.setItem(storageKey(user.id), weekKey)
      setDismissedKey(weekKey)
    }
  }

  const show = isSuccess && !!entry && dismissedKey !== weekKey

  return { show, entry, dismiss }
}
