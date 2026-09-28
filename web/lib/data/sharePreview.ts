// What get_share_preview returns for a guest (see the migration
// share_preview_and_referrals) — raw snake_case JSON, one shape per kind.
// Deliberately no coordinates for a sector: point and route are for
// signed-in players only.

export type PreviewPerson = { public_id: string | null; display_name: string | null; avatar_url: string | null }

export type PreviewCatch = {
  id: number
  species: string | null
  category: string | null
  length_cm: number | null
  weight_kg: number | null
  photo_url: string | null
  caught_at: string
  territory_id: string
  territory_kind: string | null
  user: PreviewPerson
}

export type TerritoryPreview = {
  id: string
  kind: string
  corners: [number, number][] | null
  catch_count: number
  last_catch_at: string | null
  shield_until: string | null
  owner: PreviewPerson | null
  co_holders: { id: string; avatar_url: string | null; display_name: string | null }[] | null
  clan: { id: number; name: string; crest: unknown } | null
  recent: PreviewCatch[]
}

export type UserPreview = PreviewPerson & {
  city: string
  hero_bg: string | null
  created_at: string
  sectors: number
  catches: number
  clan: { id: number; name: string; crest: unknown } | null
  recent: PreviewCatch[]
}

export type CatchPreview = PreviewCatch & { likes: number; comments: number }

export type ClanPreview = {
  id: number
  name: string
  motto: string | null
  crest: unknown
  background: string
  city: string
  level: number
  trophies: number
  members: number
  capacity: number
  join_type: 'open' | 'request' | 'invite'
  top: { display_name: string | null; avatar_url: string | null; role: string }[]
}

export type AchievementPreview = PreviewPerson & { icon: string }
