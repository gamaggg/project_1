// «Где это?» — one 360° panorama of a shore a day per city; the player picks
// on the map the sector it was taken in: the right one pays GEO_COINS, any
// other nothing. Where it was taken stays on the server until the guess
// (get_geo_today / submit_geo_guess); this file is the client's side.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

// The right sector pays this (submit_geo_guess); any other — nothing.
export const GEO_COINS = 30
// The day's quest after the answer, whatever it was: a catch in the
// panorama's sector before midnight pays this (_geo_catch_bonus).
export const GEO_BONUS = 50
// Where panoramas come from, north to south: Batumi's coast up to Kobuleti
// (scripts/geo-import.mjs --max-lat, no Ureki / Grigoleti); all of Moscow.
// The map opens on all of it for the pick — no part of the city singled out.
export const GEO_AREA_MAX_LAT: Record<GeoCity, number> = { batumi: 41.9, moscow: 90 }

// The sector's record on the result screen is a real fish — from this
// weight or this length (get_geo_sector); a 50 g goby isn't one.
export const GEO_RECORD_MIN_KG = 0.3
export const GEO_RECORD_MIN_CM = 20

// Sector centres are 600 m apart: one this close is a neighbour of the answer.
export const GEO_NEIGHBOUR_M = 650

// «340 м», «2,3 км», «14 км».
export function formatGeoDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} м`
  const km = m / 1000
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} км`
}

export function geoVerdict(correct: boolean, neighbour: boolean, distance: number): string {
  if (correct) return 'В точку!'
  if (neighbour) return 'Соседний сектор'
  if (distance <= 2000) return 'Близко'
  return 'Мимо'
}

// The share line's marker, like a Wordle square.
export function geoEmoji(correct: boolean, neighbour: boolean): string {
  return correct ? '🎯' : neighbour ? '🟨' : '🟥'
}

export function geoImageUrl(path: string, size: 'full' | 'small' = 'full'): string {
  const name = size === 'small' ? path.replace(/\.jpg$/, '_s.jpg') : path
  return `${SUPABASE_URL}/storage/v1/object/public/geo-panoramas/${name}`
}

export type GeoPanorama = { id: number; image: string; heading: number; north: number }

export type GeoResult = {
  guessTerritoryId: string
  correct: boolean
  // From the centre of the sector picked to where the panorama was taken.
  distance: number
  coins: number
  answerLat: number
  answerLng: number
  territoryId: string | null
  author: string | null
  source: string
  sourceId: string | null
  capturedAt: string | null
  // The quest: 0 until the catch there, then GEO_BONUS.
  bonusCoins: number
  bonusAt: string | null
  rank: number
  players: number
  winners: number
}

export type GeoToday = {
  day: string
  city: 'batumi' | 'moscow'
  nextReset: string
  panorama: GeoPanorama | null
  result: GeoResult | null
}

export type GeoBoardEntry = {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  equippedFrame: string | null
  territoryId: string
  correct: boolean
  distance: number
  coins: number
  isMe: boolean
}

export type AdminGeoPanorama = {
  id: number
  city: string
  lat: number
  lng: number
  territoryId: string | null
  image: string
  heading: number
  north: number
  source: string
  sourceId: string | null
  author: string | null
  capturedAt: string | null
  status: 'pending' | 'approved' | 'rejected'
  shown: number
  lastShown: string | null
  // Mapillary's quality score (0–1) and metres to the water line, from the
  // import.
  quality: number | null
  waterM: number | null
  // The next day it's planned for (today included), if any.
  nextDay: string | null
}

// One day of the admin's plan; no panorama: the game picks one on the day.
export type AdminGeoPlanDay = {
  day: string
  panoramaId: number | null
  image: string | null
  territoryId: string | null
  heading: number | null
  // Somebody already answered that day — it can't change.
  locked: boolean
}

export type GeoCity = 'batumi' | 'moscow'

// The answer's sector, told (get_geo_sector).
export type GeoSectorStory = {
  catches: number
  anglers: number
  firstAt: string | null
  owner: { id: string; name: string | null; avatarUrl: string | null; since: string | null } | null
  record: { catchId: number; speciesName: string | null; weightKg: number | null; lengthCm: number | null; userName: string | null } | null
  species: { key: string; name: string | null; count: number }[]
  last: {
    id: number
    speciesName: string | null
    weightKg: number | null
    lengthCm: number | null
    photoUrl: string
    caughtAt: string
    userId: string
    userName: string | null
    avatarUrl: string | null
  }[]
}
