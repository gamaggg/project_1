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
