'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useActivity, useAdminActions } from '@/lib/supabase/queries'

function storageKey(name: string, userId: string) {
  return `fishzone:${name}:${userId}`
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
    const stored = localStorage.getItem(storageKey('lastReadActivity', user.id))
    if (stored) {
      setLastReadAt(stored)
    } else {
      const now = new Date().toISOString()
      localStorage.setItem(storageKey('lastReadActivity', user.id), now)
      setLastReadAt(now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const unreadIds = useMemo((): Set<string> => {
    if (!lastReadAt) return new Set()
    return new Set(activity.filter((a) => a.createdAt > lastReadAt).map((a) => a.id))
  }, [activity, lastReadAt])

  function markAllRead() {
    if (!user) return
    const now = new Date().toISOString()
    localStorage.setItem(storageKey('lastReadActivity', user.id), now)
    setLastReadAt(now)
  }

  return { unreadIds, unreadCount: unreadIds.size, markAllRead }
}

// Same "read" tracking as useActivityReadState, for the super-admin-only
// "Последние действия" moderation log — a separate function (rather than a
// shared generic helper) because sharing one across AdminAction's numeric id
// and ActivityEntry's string id tripped up Vercel's production type-check
// (Set<string | number> inferred instead of narrowing per call site) even
// though `next dev` never flagged it — see DECISIONS.md. useAdminActions()
// itself is gated behind useIsSuperAdmin(), so this is a harmless no-op for
// everyone else.
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
