'use client'

import type { UserAward } from '@/lib/data/types'
import { AWARD_ICONS, AWARD_COLOR, isKnownAward } from '@/components/app-shell/awardIcons'

// Wraps an avatar with its earned medals floating in a ring around it (see
// the awards proposal) — collapses to just the avatar when there are none,
// so most profiles (no awards yet) don't reserve empty ring space.
//
// onOpenAward bubbles the tap up to FishZoneApp rather than opening a modal
// locally: this ring nests several layers deep (ProfileScreen/UserProfileScreen
// -> .screen-inner), and .modal-overlay's `position:absolute` resolves
// against the *nearest positioned ancestor* — which would be this component's
// own .award-ring-stage (also `position:relative`, for the badges) instead of
// the app-shell root, clipping the modal to a ~240px box instead of the full
// screen. Every other modal in this app is rendered as a FishZoneApp-level
// sibling for the same reason (see DECISIONS.md) — this one follows suit.
// How far below its centre the avatar (108px .profile-hero-avatar-ring plus
// the 5px frame ring) and a medal (40px, ±3px drift) reach.
const AVATAR_REACH = 59
const BADGE_REACH = 23

export function AwardsRing({ awards: allAwards, radius = 96, onOpenAward, children }: { awards: UserAward[]; radius?: number; onOpenAward: (award: UserAward) => void; children: React.ReactNode }) {
  const listed = allAwards.filter((a) => isKnownAward(a.kind))
  // Each medal counts once (user_awards_once in the database); repeats
  // granted before that rule collapse into the earliest one.
  const seenMedals = new Set<string>()
  const awards = [...listed]
    .reverse()
    .filter((a) => {
      const key = `${a.kind}|${a.title}`
      if (seenMedals.has(key)) return false
      seenMedals.add(key)
      return true
    })
    .reverse()
  if (awards.length === 0) return <>{children}</>

  const stageSize = (radius + 29) * 2
  // The stage is a square around the avatar, but the medals rarely reach its
  // bottom: three of them sit level with the avatar's lower half, one sits
  // only on top. Pull what follows (the name) up over the empty part, or it
  // sits ~70px under the avatar.
  const lowest = Math.max(
    AVATAR_REACH,
    ...awards.map((_, i) => Math.sin((i / awards.length) * Math.PI * 2 - Math.PI / 2) * radius + BADGE_REACH)
  )
  const emptyBelow = Math.max(0, Math.floor(stageSize / 2 - lowest))

  return (
    <div className="award-ring-stage" style={{ width: stageSize, height: stageSize, marginBottom: -emptyBelow }}>
      {children}
      {awards.map((award, i) => {
        const angle = (i / awards.length) * Math.PI * 2 - Math.PI / 2
        const cx = Math.cos(angle) * radius
        const cy = Math.sin(angle) * radius
        const { color, colorHi } = AWARD_COLOR[award.kind]
        // Deterministic-but-varied per-badge drift (seeded off the award's own
        // id) so several badges sharing the same @keyframes don't all move in
        // lockstep — no Math.random() here, this re-renders on every parent
        // update and random values would make the drift jitter instead of flow.
        const seed = award.id
        // ±3px: enough to feel alive, small enough that the gap to the
        // avatar stays even all round (±5 read as lopsided top vs bottom).
        const dx1 = ((seed * 37) % 7) - 3
        const dy1 = ((seed * 53) % 7) - 3
        const dx2 = ((seed * 71) % 7) - 3
        const dy2 = ((seed * 89) % 7) - 3
        return (
          <button
            key={award.id}
            className="award-ring-badge"
            style={
              {
                left: `calc(50% + ${cx}px)`,
                top: `calc(50% + ${cy}px)`,
                background: `linear-gradient(160deg, ${colorHi}, ${color})`,
                '--dx1': `${dx1}px`,
                '--dy1': `${dy1}px`,
                '--dx2': `${dx2}px`,
                '--dy2': `${dy2}px`,
                animationDuration: `${3 + (seed % 3)}s`,
                animationDelay: `${-(seed % 4)}s`,
              } as React.CSSProperties
            }
            onClick={() => onOpenAward(award)}
            aria-label={award.title}
          >
            {AWARD_ICONS[award.kind]}
          </button>
        )
      })}
    </div>
  )
}
