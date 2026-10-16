'use client'

import { useCatchesByUser, useProfile, useHasClaimedFromOthers, useSyncMyAchievements } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { computeAchievements, heldTerritories, type Achievement } from '@/lib/data/achievements'
import { AchievementCard, achievementFraction } from '@/components/app-shell/AchievementCard'
import { BackButton } from '@/components/app-shell/BackButton'
import type { Territory } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'

// Full achievements list for one profile (own or someone else's) — ProfileScreen/
// UserProfileScreen only show a 4-item preview with a button into this screen.
// Self-contained (fetches its own catches/profile/claim-history by userId) rather
// than fed pre-computed data, so it works the same regardless of which screen
// pushed it. City comes from that profile's own `city` column (not the viewer's)
// so achievement thresholds match whichever city this account actually plays in.
export function AchievementsScreen({
  userId,
  territories,
  onBack,
  onOpenDetail,
}: {
  userId: string
  territories: Territory[]
  onBack: () => void
  onOpenDetail: (icon: Achievement['icon']) => void
}) {
  const { user } = useAuth()
  const { data: profile } = useProfile(userId)
  const { data: catches = [] } = useCatchesByUser(userId)
  const { data: claimedFromOthers = false } = useHasClaimedFromOthers(userId)
  useSyncMyAchievements(userId === user?.id)
  const myTerritories = heldTerritories(territories, userId)
  const achievements = computeAchievements(
    catches,
    {
      myTerritories,
      allTerritories: territories,
      followersCount: profile?.followersCount ?? 0,
      claimedFromOthers,
    },
    profile?.city ?? 'batumi'
  )

  const done = achievements.filter((a) => a.unlocked).length
  const total = achievements.length
  // Open ones first (in their usual order), then the closed ones, the nearest
  // to opening leading them.
  const ordered = [...achievements.filter((a) => a.unlocked), ...achievements.filter((a) => !a.unlocked).sort((x, y) => achievementFraction(y) - achievementFraction(x))]
  const closest = ordered.find((a) => !a.unlocked)
  const RING = 2 * Math.PI * 34

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{tn('weekly.achievements')}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="ach-summary">
          <div className="ach-summary-ring">
            <svg viewBox="0 0 80 80" aria-hidden>
              <circle className="ach-ring-track" cx="40" cy="40" r="34" />
              <circle
                className="ach-ring-fill"
                cx="40"
                cy="40"
                r="34"
                style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - (total ? done / total : 0)) }}
              />
            </svg>
            <div className="ach-ring-num">
              <b>{done}</b>
              <span>/{total}</span>
            </div>
          </div>
          <div className="ach-summary-text">
            <div className="ach-summary-title">{tn('ach.summary', { done, total })}</div>
            <div className="ach-summary-sub">{closest ? tn('ach.closest', { title: closest.title }) : tn('ach.allDone')}</div>
          </div>
        </div>
        <div className="ach-grid">
          {ordered.map((a, i) => (
            <AchievementCard key={a.icon} a={a} index={i} onOpen={() => onOpenDetail(a.icon)} />
          ))}
        </div>
      </div>
    </>
  )
}
