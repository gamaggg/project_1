'use client'

import { useCatchesByUser, useProfile, useHasClaimedFromOthers } from '@/lib/supabase/queries'
import { computeAchievements, type Achievement } from '@/lib/data/achievements'
import { ACH_ICONS } from '@/components/app-shell/icons'
import type { Territory } from '@/lib/data/types'

// Full achievements list for one profile (own or someone else's) — ProfileScreen/
// UserProfileScreen only show a 4-item preview with a button into this screen.
// Self-contained (fetches its own catches/profile/claim-history by userId) rather
// than fed pre-computed data, so it works the same regardless of which screen
// pushed it.
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
  const { data: profile } = useProfile(userId)
  const { data: catches = [] } = useCatchesByUser(userId)
  const { data: claimedFromOthers = false } = useHasClaimedFromOthers(userId)
  const myTerritories = territories.filter((t) => t.ownerId === userId)
  const achievements = computeAchievements(catches, {
    myTerritories,
    allTerritories: territories,
    followersCount: profile?.followersCount ?? 0,
    claimedFromOthers,
  })

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Достижения</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="ach-grid">
          {achievements.map((a) => (
            <div className={`ach-card${a.unlocked ? '' : ' locked'}`} key={a.icon} onClick={() => onOpenDetail(a.icon)}>
              <div className={`ach-icon hex-aspect hex-shape ${a.unlocked ? 'on' : 'off'}`}>{ACH_ICONS[a.icon]}</div>
              <div>
                <div className="ach-title">{a.title}</div>
                <div className="ach-desc">{a.desc}</div>
                {!a.unlocked && a.progress && <div className="ach-progress">{a.progress}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
