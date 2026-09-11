'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useCatchesByUser, useProfile, useHasClaimedFromOthers } from '@/lib/supabase/queries'
import { computeAchievements, type Achievement } from '@/lib/data/achievements'
import type { Territory } from '@/lib/data/types'
import type { CityId } from '@/lib/data/city'

function storageKey(userId: string) {
  return `fishzone:seenAchievements:${userId}`
}

function readSeen(userId: string): Set<Achievement['icon']> | null {
  const raw = localStorage.getItem(storageKey(userId))
  return raw ? new Set(JSON.parse(raw) as Achievement['icon'][]) : null
}

function writeSeen(userId: string, seen: Set<Achievement['icon']>) {
  localStorage.setItem(storageKey(userId), JSON.stringify([...seen]))
}

// Watches this user's achievements and queues a one-time popup for each newly
// unlocked one. "Unlocked" itself has no DB column (computeAchievements derives
// it fresh from catches/territories/etc. every time — see achievements.ts), so
// "new" is tracked the same way as read-state elsewhere (see activityRead.ts):
// a set of icons already shown, kept in localStorage. First-ever run bootstraps
// that set to whatever's already unlocked (no popup for pre-existing progress),
// gated on all three queries actually resolving so we never bootstrap against
// a still-loading (falsely empty) achievement list.
export function useAchievementUnlock(territories: Territory[], territoriesReady: boolean, city: CityId) {
  const { user } = useAuth()
  const catchesQ = useCatchesByUser(user?.id ?? null)
  const profileQ = useProfile(user?.id ?? null)
  const claimedQ = useHasClaimedFromOthers(user?.id ?? null)
  // territoriesReady comes from the caller's own useTerritories() — without it,
  // territory-dependent achievements briefly compute against an empty []
  // (its default before that query resolves) whenever it happens to resolve
  // *after* the three queries above, and the prune step below then wrongly
  // reads that blip as "no longer unlocked" and wipes it from "seen",
  // re-popping the modal once real data arrives (see DECISIONS.md).
  const ready = catchesQ.isSuccess && profileQ.isSuccess && claimedQ.isSuccess && territoriesReady

  const myTerritories = territories.filter((t) => t.ownerId === user?.id)
  const achievements = computeAchievements(
    catchesQ.data ?? [],
    {
      myTerritories,
      allTerritories: territories,
      followersCount: profileQ.data?.followersCount ?? 0,
      claimedFromOthers: claimedQ.data ?? false,
    },
    city
  )
  const unlockedIcons = achievements.filter((a) => a.unlocked).map((a) => a.icon)
  const unlockedKey = unlockedIcons.join(',')

  const [queue, setQueue] = useState<Achievement['icon'][]>([])

  useEffect(() => {
    if (!user || !ready) return
    const seen = readSeen(user.id)
    if (seen === null) {
      writeSeen(user.id, new Set(unlockedIcons))
      return
    }
    // Prune anything no longer unlocked (e.g. a moderator deleted the catches
    // behind it) out of "seen" too — achievements aren't guaranteed monotonic
    // here, so losing one and earning it again should pop the modal again,
    // not stay silently marked as already shown.
    const unlockedSet = new Set(unlockedIcons)
    const pruned = new Set([...seen].filter((icon) => unlockedSet.has(icon)))
    if (pruned.size !== seen.size) writeSeen(user.id, pruned)
    const fresh = unlockedIcons.filter((icon) => !pruned.has(icon))
    if (fresh.length === 0) return
    setQueue((q) => [...q, ...fresh.filter((icon) => !q.includes(icon))])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ready, unlockedKey])

  function dismiss() {
    const icon = queue[0]
    if (icon && user) {
      const seen = readSeen(user.id) ?? new Set<Achievement['icon']>()
      seen.add(icon)
      writeSeen(user.id, seen)
    }
    setQueue((q) => q.slice(1))
  }

  const current = queue[0] ? achievements.find((a) => a.icon === queue[0]) ?? null : null

  return { current, dismiss }
}
