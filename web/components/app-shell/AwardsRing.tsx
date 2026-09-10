'use client'

import type { UserAward } from '@/lib/data/types'
import { AWARD_ICONS, AWARD_COLOR } from '@/components/app-shell/awardIcons'

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
export function AwardsRing({ awards, radius = 92, onOpenAward, children }: { awards: UserAward[]; radius?: number; onOpenAward: (award: UserAward) => void; children: React.ReactNode }) {
  if (awards.length === 0) return <>{children}</>

  const stageSize = (radius + 29) * 2

  return (
    <div className="award-ring-stage" style={{ width: stageSize, height: stageSize }}>
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
        const dx1 = ((seed * 37) % 11) - 5
        const dy1 = ((seed * 53) % 11) - 5
        const dx2 = ((seed * 71) % 11) - 5
        const dy2 = ((seed * 89) % 11) - 5
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
