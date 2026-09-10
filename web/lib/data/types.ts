import type { Database } from '@/lib/types'
import type { SpeciesCategory } from '@/lib/data/species'

export type TerritoryKind = Database['public']['Enums']['territory_kind']
export type TerritoryStatus = 'mine' | 'other' | 'free'

// Geometry (id/kind/lat/lng/corners) comes from public/data/sectors.json — static,
// never changes at runtime. Ownership (status/ownerId/catchCount/lastCatchAt) comes
// from Supabase (territories_with_stats) and is merged onto it by id. See DOCS.md.
export type Territory = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
  status: TerritoryStatus
  ownerId: string | null
  catchCount: number
  lastCatchAt: string | null
}

export type Species = {
  key: string
  name: string
  category: SpeciesCategory
}

// From profiles_with_stats (view) — followers/following are real aggregates,
// not the old static placeholder column. See DECISIONS.md.
export type Profile = {
  id: string
  displayName: string
  location: string | null
  avatarUrl: string | null
  bio: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  isBlocked: boolean
  publicId: string
  followersCount: number
  followingCount: number
  // birthDate/gender/heightCm/weightKg are masked to non-owners at the view
  // level (profiles_with_stats) — always null when viewing someone else's
  // profile, regardless of whether they actually set them.
  birthDate: string | null
  gender: 'male' | 'female' | null
  heightCm: number | null
  weightKg: number | null
  // null until the onboarding wizard's color step runs (or for pre-wizard
  // accounts) — read sites fall back to DEFAULT_TERRITORY_COLOR.
  territoryColor: string | null
  onboardingCompleted: boolean
  createdAt: string
}

// One row from profiles_with_stats for the admin "Все пользователи" list —
// shaped in queries.ts (useAllUsers), not the full Profile (no need for the
// self-only masked fields there).
export type UserListEntry = {
  id: string
  displayName: string
  avatarUrl: string | null
  publicId: string
  createdAt: string
  catchesCount: number
  territoriesCount: number
}

// One row from get_weekly_leaderboard(), shaped in queries.ts
// (useWeeklyLeaderboard). Ranked by sectors first-claimed this Batumi week
// (Mon 00:00 – Sun 23:59), catches this week as the tiebreaker/secondary
// stat — see DECISIONS.md.
export type WeeklyLeaderboardEntry = {
  userId: string
  displayName: string
  avatarUrl: string | null
  sectorsThisWeek: number
  catchesThisWeek: number
  rank: number
}

// A collectible medal a user has earned (see user_awards, AwardsRing) — public
// on any profile, distinct from Achievement (progress-grid, self-computed).
// kind drives the icon/color (see awardIcons.tsx); title/subtitle/description
// are plain text set when the award was granted, not recomputed client-side.
export type AwardKind = 'weekly_rank' | 'guardian' | 'catch_of_month' | 'lightning' | 'season_legend' | 'night_watch' | 'duelist'
export type UserAward = {
  id: number
  kind: AwardKind
  title: string
  subtitle: string
  description: string
  earnedAt: string
}

export type Catch = {
  id: number
  territoryId: string
  userId: string
  species: string
  speciesName: string
  speciesCategory: SpeciesCategory
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
  photoUrl: string
  caughtAt: string
  mine: boolean
}

// One row from catch_reports, joined with what an admin needs to act on it —
// shaped in queries.ts (useReports), not a raw DB row.
export type CatchReport = {
  id: number
  catchId: number
  reason: string
  createdAt: string
  reporterId: string
  reporterName: string
  territoryId: string
  photoUrl: string
  speciesName: string | null
}

// One row from admin_actions, joined with the admin's display name — shaped
// in queries.ts (useAdminActions), used for "Последние действия".
export type AdminAction = {
  id: number
  adminName: string
  details: string
  createdAt: string
  targetUserId: string | null
  targetUserName: string | null
  territoryId: string | null
}

// A profile currently holding admin access (is_admin && !is_super_admin),
// with when it was granted — a live view, not a log entry, so a revoked
// admin simply drops out of this list rather than leaving a "revoked" row.
export type AdminListEntry = {
  id: string
  displayName: string
  grantedAt: string | null
}

export type PendingCatch = {
  territoryId: string
  species: string
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
  photoUrl: string
}

// id is a string, not the raw activity_log bigint — 'follow' entries are
// synthesized client-side from the `follows` table (see useActivity in
// queries.ts), so ids need a namespaced format (`log:123` / `follow:<uid>`)
// to guarantee no collision between the two sources. territoryId/territoryKind
// are absent on 'follow' entries (a subscription isn't tied to any sector).
export type ActivityEntry = {
  id: string
  who: string
  userId: string
  avatarUrl: string | null
  mine: boolean
  kind: 'catch' | 'claim' | 'follow' | 'moderation'
  territoryId?: string
  territoryKind?: TerritoryKind
  speciesName: string | null
  speciesCategory: SpeciesCategory | null
  lengthCm: number | null
  weightKg: number | null
  photoUrl: string | null
  createdAt: string
}
