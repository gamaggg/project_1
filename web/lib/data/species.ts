import type { Database } from '@/lib/types'

export type SpeciesKey = Database['public']['Enums']['catch_species']

export const SPECIES: { key: SpeciesKey; name: string; latin: string }[] = [
  { key: 'stavrida', name: 'Ставрида', latin: 'Trachurus mediterraneus' },
  { key: 'skorpena', name: 'Скорпена', latin: 'Scorpaena porcus' },
  { key: 'laskir', name: 'Ласкирь', latin: 'Diplodus sargus' },
]

export const SPECIES_GRADIENT: Record<SpeciesKey, string> = {
  stavrida: 'linear-gradient(160deg,#123044,#0B4C63 45%,#0A6B7C 75%,#063A48)',
  skorpena: 'linear-gradient(160deg,#3A1420,#6B2030 45%,#8C3A2E 75%,#4A1A12)',
  laskir: 'linear-gradient(160deg,#0E3B36,#146050 45%,#1E8067 75%,#0B4038)',
}

export function speciesInfo(key: SpeciesKey) {
  return SPECIES.find((s) => s.key === key)!
}

export const METHODS = ['Спиннинг', 'Донная снасть', 'Поплавочная удочка']
export const BAITS = ['Микроджиг', 'Креветка', 'Морской червь', 'Блесна']

export const KIND_LABEL: Record<Database['public']['Enums']['territory_kind'], string> = {
  sea: 'Море',
  river: 'Река',
  stream: 'Ручей',
  lake: 'Озеро',
}
