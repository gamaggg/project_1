'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useActivity, useAdminActions } from '@/lib/supabase/queries'

function storageKey(name: string, userId: string) {
  return `fishzone:${name}:${userId}`
}

// "Read" state lives in localStorage, not the DB — purely cosmetic (has this
// device seen it), doesn't need to sync across devices or survive a cleared
// browser. First-ever visit bootstraps to "now" so a user's own pre-existing
// history isn't retroactively shown as a pile of unread notifications the
// moment they open the tab for the first time. Shared by the activity feed
// and (for super admins) the "Последние действия" moderation log.
function useReadState<T extends { id: string | number; createdAt: string }>(name: string, items: T[]) {
  const { user } = useAuth()
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLastReadAt(null)
      return
    }
    const stored = localStorage.getItem(storageKey(name, user.id))
    if (stored) {
      setLastReadAt(stored)
    } else {
      const now = new Date().toISOString()
      localStorage.setItem(storageKey(name, user.id), now)
      setLastReadAt(now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const unreadIds = useMemo(() => {
    if (!lastReadAt) return new Set<T['id']>()
    return new Set(items.filter((a) => a.createdAt > lastReadAt).map((a) => a.id))
  }, [items, lastReadAt])

  function markAllRead() {
    if (!user) return
    const now = new Date().toISOString()
    localStorage.setItem(storageKey(name, user.id), now)
    setLastReadAt(now)
  }

  return { unreadIds, unreadCount: unreadIds.size, markAllRead }
}

export function useActivityReadState() {
  const { data: activity = [] } = useActivity()
  return useReadState('lastReadActivity', activity)
}

// Only ever non-empty for super admins — useAdminActions() itself is gated
// behind useIsSuperAdmin(), so this is a harmless no-op for everyone else.
export function useAdminActionsReadState() {
  const { data: actions = [] } = useAdminActions()
  return useReadState('lastReadAdminActions', actions)
}
