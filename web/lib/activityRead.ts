'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useAdminActions } from '@/lib/supabase/queries'

function storageKey(name: string, userId: string) {
  return `fishzone:${name}:${userId}`
}

// Browser-local "read" tracking for the super-admin-only "Последние
// действия" moderation log. The activity feed used to work this way too, but
// moved to a real notifications table once read state needed to survive a
// device switch; this log is one person's own audit view, so localStorage is
// still enough. useAdminActions() is gated behind useIsSuperAdmin(), making
// this a harmless no-op for everyone else.
export function useAdminActionsReadState() {
  const { user } = useAuth()
  const { data: actions = [] } = useAdminActions()
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLastReadAt(null)
      return
    }
    const stored = localStorage.getItem(storageKey('lastReadAdminActions', user.id))
    if (stored) {
      setLastReadAt(stored)
    } else {
      const now = new Date().toISOString()
      localStorage.setItem(storageKey('lastReadAdminActions', user.id), now)
      setLastReadAt(now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const unreadIds = useMemo((): Set<number> => {
    if (!lastReadAt) return new Set()
    return new Set(actions.filter((a) => a.createdAt > lastReadAt).map((a) => a.id))
  }, [actions, lastReadAt])

  function markAllRead() {
    if (!user) return
    const now = new Date().toISOString()
    localStorage.setItem(storageKey('lastReadAdminActions', user.id), now)
    setLastReadAt(now)
  }

  return { unreadIds, unreadCount: unreadIds.size, markAllRead }
}
