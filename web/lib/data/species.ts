import type { Database } from '@/lib/types'

// Species (36 total: sea/river/stream/lake catch) now live in the `species`
// table (public, read-only for clients) — not hardcoded here, unlike the
// original 3-species prototype list. See DECISIONS.md.
export type SpeciesCategory = 'marine' | 'freshwater'

export const CATEGORY_LABEL: Record<SpeciesCategory, string> = {
  marine: 'Морская',
  freshwater: 'Пресноводная',
}

// One gradient per category (not per species — 36 individual gradients isn't
// worth maintaining) for the catch-photo placeholder.
export const CATEGORY_GRADIENT: Record<SpeciesCategory, string> = {
  marine: 'linear-gradient(160deg,#123044,#0B4C63 45%,#0A6B7C 75%,#063A48)',
  freshwater: 'linear-gradient(160deg,#0E3B36,#146050 45%,#1E8067 75%,#0B4038)',
}

export function categoryForKind(kind: Database['public']['Enums']['territory_kind']): SpeciesCategory {
  return kind === 'sea' ? 'marine' : 'freshwater'
}

export const METHODS = ['Спиннинг', 'Донная снасть', 'Поплавочная удочка']
export const BAITS = ['Микроджиг', 'Креветка', 'Морской червь', 'Блесна']

export const KIND_LABEL: Record<Database['public']['Enums']['territory_kind'], string> = {
  sea: 'Море',
  river: 'Река',
  stream: 'Ручей',
  lake: 'Озеро',
}
