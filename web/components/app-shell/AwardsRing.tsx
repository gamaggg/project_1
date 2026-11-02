'use client'

import type { AwardKind, UserAward } from '@/lib/data/types'
import { AWARD_ICONS, AWARD_KINDS, awardMedalStyle, isKnownAward } from '@/components/app-shell/awardIcons'
import { tn } from '@/lib/i18n/runtime'

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

// One medal per kind (since 02.11): the 1st, 2nd and 3rd place of the week
// are one trophy with a count on it, repeats of the same medal are one. With
// showLocked (the owner's own profile) the kinds not earned yet are there
// too, grey with a lock — a tap says how to earn them — so the ring always
// holds all nine.
export type AwardGroup = { kind: AwardKind; awards: UserAward[] }

export function AwardsRing({ awards: allAwards, showLocked = false, radius = 96, onOpenAward, children }: { awards: UserAward[]; showLocked?: boolean; radius?: number; onOpenAward: (group: AwardGroup) => void; children: React.ReactNode }) {
  const listed = allAwards.filter((a) => isKnownAward(a.kind))
  // Each medal counts once (user_awards_once in the database); repeats
  // granted before that rule collapse into the earliest one.
  const seenMedals = new Set<string>()
  const unique = [...listed]
    .reverse()
    .filter((a) => {
      const key = `${a.kind}|${a.title}`
      if (seenMedals.has(key)) return false
      seenMedals.add(key)
      return true
    })
    .reverse()
  const earned: AwardGroup[] = AWARD_KINDS.map((kind) => ({ kind, awards: unique.filter((a) => a.kind === kind) })).filter((g) => g.awards.length > 0)
  const locked: AwardGroup[] = showLocked ? AWARD_KINDS.filter((kind) => !earned.some((g) => g.kind === kind)).map((kind) => ({ kind, awards: [] })) : []
  const medals = [...earned, ...locked]
  if (medals.length === 0) return <>{children}</>

  const stageSize = (radius + 29) * 2
  // The stage is a square around the avatar, but the medals rarely reach its
  // bottom: three of them sit level with the avatar's lower half, one sits
  // only on top. Pull what follows (the name) up over the empty part, or it
  // sits ~70px under the avatar.
  const lowest = Math.max(
    AVATAR_REACH,
    ...medals.map((_, i) => Math.sin((i / medals.length) * Math.PI * 2 - Math.PI / 2) * radius + BADGE_REACH)
  )
  const emptyBelow = Math.max(0, Math.floor(stageSize / 2 - lowest))

  return (
    <div className="award-ring-stage" style={{ width: stageSize, height: stageSize, marginBottom: -emptyBelow }}>
      {children}
      {medals.map((group, i) => {
        const angle = (i / medals.length) * Math.PI * 2 - Math.PI / 2
        const cx = Math.cos(angle) * radius
        const cy = Math.sin(angle) * radius
        // Deterministic-but-varied per-badge drift (seeded off the medal's
        // place in the ring) so several badges sharing the same @keyframes
        // don't all move in lockstep — no Math.random() here, this re-renders
        // on every parent update and random values would make the drift jitter.
        const seed = (group.awards[0]?.id ?? 0) + i * 13
        // ±3px: enough to feel alive, small enough that the gap to the
        // avatar stays even all round (±5 read as lopsided top vs bottom).
        const dx1 = ((seed * 37) % 7) - 3
        const dy1 = ((seed * 53) % 7) - 3
        const dx2 = ((seed * 71) % 7) - 3
        const dy2 = ((seed * 89) % 7) - 3
        const isLocked = group.awards.length === 0
        return (
          <div
            key={group.kind}
            className="award-ring-slot"
            style={
              {
                left: `calc(50% + ${cx}px)`,
                top: `calc(50% + ${cy}px)`,
                '--dx1': `${dx1}px`,
                '--dy1': `${dy1}px`,
                '--dx2': `${dx2}px`,
                '--dy2': `${dy2}px`,
                animationDuration: `${3 + (seed % 3)}s`,
                animationDelay: `${-(seed % 4)}s`,
              } as React.CSSProperties
            }
          >
            <button
              className={`award-medal award-ring-badge${isLocked ? ' award-medal-locked' : ' award-medal-shine'}`}
              style={{ ...(isLocked ? {} : awardMedalStyle(group.kind)), '--shine-delay': `${-((seed * 7) % 6)}s` } as React.CSSProperties}
              onClick={() => onOpenAward(group)}
              aria-label={isLocked ? `${medalName(group.kind)} · ${tn('medals.locked')}` : medalName(group.kind)}
            >
              {AWARD_ICONS[group.kind]}
            </button>
            {group.awards.length > 1 && <span className="award-ring-count">{group.awards.length}</span>}
            {isLocked && (
              <span className="award-ring-lock" aria-hidden>
                <svg viewBox="0 0 24 24" width="10" height="10">
                  <rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor" />
                  <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
                </svg>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// The medal's own name: the trophy of the week has none of its own in the
// database (its awards are «1 место», «2 место», «3 место»).
export function medalName(kind: AwardKind): string {
  return kind === 'weekly_rank' ? tn('medals.weeklyName') : tn(`dbText.awTitle_${kind}`)
}
