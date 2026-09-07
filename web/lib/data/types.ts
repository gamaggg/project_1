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
  caughtAt: string
  mine: boolean
}

export type PendingCatch = {
  territoryId: string
  species: string
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
}

export type ActivityEntry = {
  id: number
  who: string
  mine: boolean
  kind: 'catch' | 'claim'
  territoryId: string
  territoryKind: TerritoryKind
  speciesName: string | null
  speciesCategory: SpeciesCategory | null
  lengthCm: number | null
  weightKg: number | null
  createdAt: string
}
