'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useActivity } from '@/lib/supabase/queries'

function storageKey(userId: string) {
  return `fishzone:lastReadActivity:${userId}`
}

// "Read" state for the activity feed lives in localStorage, not the DB — purely
// cosmetic (has this device seen it), doesn't need to sync across devices or
// survive a cleared browser. First-ever visit bootstraps to "now" so a user's
// own pre-existing history isn't retroactively shown as a pile of unread
// notifications the moment they open the tab for the first time.
export function useActivityReadState() {
  const { user } = useAuth()
  const { data: activity = [] } = useActivity()
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLastReadAt(null)
      return
    }
    const stored = localStorage.getItem(storageKey(user.id))
    if (stored) {
      setLastReadAt(stored)
    } else {
      const now = new Date().toISOString()
      localStorage.setItem(storageKey(user.id), now)
      setLastReadAt(now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const unreadIds = useMemo(() => {
    if (!lastReadAt) return new Set<number>()
    return new Set(activity.filter((a) => a.createdAt > lastReadAt).map((a) => a.id))
  }, [activity, lastReadAt])

  function markAllRead() {
    if (!user) return
    const now = new Date().toISOString()
    localStorage.setItem(storageKey(user.id), now)
    setLastReadAt(now)
  }

  return { unreadIds, unreadCount: unreadIds.size, markAllRead }
}
