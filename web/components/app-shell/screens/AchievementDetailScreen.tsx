'use client'

import { cloneElement, type ReactElement } from 'react'
import { useCatchesByUser, useProfile, useHasClaimedFromOthers } from '@/lib/supabase/queries'
import { computeAchievements, type Achievement } from '@/lib/data/achievements'
import { ACH_ICONS } from '@/components/app-shell/icons'
import { HexBadge } from '@/components/app-shell/HexBadge'
import type { Territory } from '@/lib/data/types'

// Single-achievement screen (pushed from a card tap in AchievementsScreen or
// the profile preview) — mirrors the Apple Fitness+ "award detail" layout the
// user pointed at: big badge, title, description, share in the header.
// Self-contained like AchievementsScreen (fetches its own data by userId)
// rather than threading one Achievement object through the stack, since the
// stack only carries the icon key (see FishZoneApp's StackEntry).
export function AchievementDetailScreen({
  userId,
  icon,
  territories,
  onBack,
  onShowToast,
}: {
  userId: string
  icon: Achievement['icon']
  territories: Territory[]
  onBack: () => void
  onShowToast: (msg: string) => void
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
  const achievement = achievements.find((a) => a.icon === icon)

  async function handleShare() {
    if (!achievement) return
    const text = `🏆 Я получил достижение «${achievement.title}» в RANGE!\n${achievement.desc}\n\nПрисоединяйся и сразимся за территории на побережье Батуми 🎣\n${window.location.origin}`
    try {
      await navigator.clipboard.writeText(text)
      onShowToast('Скопировано в буфер обмена')
    } catch {
      onShowToast('Не удалось скопировать')
    }
  }

  if (!achievement) return null

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        {achievement.unlocked ? (
          <div className="icon-btn tap-scale" onClick={handleShare}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M12 4 8 8M12 4l4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </div>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </div>
      <div className="screen-inner ach-detail-inner">
        <div className="ach-detail-badge-outer hex-aspect">
          <div className={`ach-detail-badge-glow ${achievement.unlocked ? 'on' : 'off'}`} />
          <div className="ach-detail-badge">
            <HexBadge
              unlocked={achievement.unlocked}
              strokeWidth={7}
              icon={cloneElement(ACH_ICONS[achievement.icon] as ReactElement<{ width: number; height: number }>, { width: 100, height: 100 })}
            />
          </div>
        </div>
        <div className="ach-detail-title">{achievement.title}</div>
        <div className="ach-detail-desc">{achievement.desc}</div>
        {!achievement.unlocked && achievement.progress && <div className="ach-detail-progress">{achievement.progress}</div>}
      </div>
    </>
  )
}
