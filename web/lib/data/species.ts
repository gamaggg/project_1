import type { Database } from '@/lib/types'
import type { CityId } from '@/lib/data/city'

// Species (now 59 total across both cities) live in the `species` table
// (public, read-only for clients) — not hardcoded here. See DECISIONS.md.
// Batumi's sea sectors split species by water type (marine/freshwater);
// Moscow has no sea, so its species split by feeding behavior instead
// (predator/peaceful) — the two category pairs never mix on one city's map.
export type SpeciesCategory = 'marine' | 'freshwater' | 'predator' | 'peaceful'

export const CATEGORY_LABEL: Record<SpeciesCategory, string> = {
  marine: 'Морская',
  freshwater: 'Пресноводная',
  predator: 'Хищная',
  peaceful: 'Мирная',
}

// One gradient per category (not per species — 57 individual gradients isn't
// worth maintaining) for the catch-photo placeholder.
export const CATEGORY_GRADIENT: Record<SpeciesCategory, string> = {
  marine: 'linear-gradient(160deg,#123044,#0B4C63 45%,#0A6B7C 75%,#063A48)',
  freshwater: 'linear-gradient(160deg,#0E3B36,#146050 45%,#1E8067 75%,#0B4038)',
  predator: 'linear-gradient(160deg,#3B1410,#7A2210 45%,#A8380F 75%,#4A1608)',
  peaceful: 'linear-gradient(160deg,#123018,#1F5C2C 45%,#2E8541 75%,#0E401A)',
}

// Which pair of categories a city's species/catches split into — drives the
// filter chips in ConfirmScreen.
export const CATEGORIES_BY_CITY: Record<CityId, [SpeciesCategory, SpeciesCategory]> = {
  batumi: ['marine', 'freshwater'],
  moscow: ['predator', 'peaceful'],
}

// Starting category shown when the catch form opens — Batumi can infer it
// from the sector's kind (sea -> marine), Moscow's kinds are all freshwater
// water bodies so predator/peaceful isn't derivable from kind at all; defaults
// to predator there since that's the more commonly targeted catch.
export function categoryForKind(kind: Database['public']['Enums']['territory_kind'], city: CityId): SpeciesCategory {
  if (city === 'moscow') return 'predator'
  return kind === 'sea' ? 'marine' : 'freshwater'
}

export const METHODS = ['Спиннинг', 'Донная снасть', 'Поплавочная удочка']

export const BAITS_BY_CITY: Record<CityId, string[]> = {
  batumi: ['Микроджиг', 'Силикон', 'Блесна', 'Воблер', 'Креветка', 'Морской червь', 'Вертушка', 'Бомбарда', 'Пилькер', 'Булер', 'Мормышка'],
  moscow: ['Микроджиг', 'Блесна', 'Воблер', 'Червь', 'Опарыш', 'Кукуруза'],
}

// Union across both cities' baits — used only as the "tried every bait"
// achievement target, which is computed globally rather than per city (see
// achievements.ts).
export const ALL_BAITS = Array.from(new Set(Object.values(BAITS_BY_CITY).flat()))

export const KIND_LABEL: Record<Database['public']['Enums']['territory_kind'], string> = {
  sea: 'Море',
  river: 'Река',
  stream: 'Ручей',
  lake: 'Озеро',
  pond: 'Пруд',
}
