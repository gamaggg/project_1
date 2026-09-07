import type { Catch, Territory } from '@/lib/data/types'

export type Achievement = {
  icon: 'first' | 'territory' | 'species' | 'sunrise' | 'record' | 'ten'
  title: string
  desc: string
  unlocked: boolean
  progress?: string
}

const SPECIES_COLLECTOR_TARGET = 5

// Ported from fishzone-app.html computeAchievements() — real milestones computed
// fresh from current state every time, not stored "unlocked" flags/game points.
// "Коллекционер видов" originally required all 3 (of exactly 3) species — with the
// 36-species table (see DECISIONS.md) "catch everything" isn't a reasonable bar,
// so this counts distinct *marine* species caught against a fixed target instead.
export function computeAchievements(myCatches: Catch[], myTerritories: Territory[]): Achievement[] {
  const marineSpeciesCount = new Set(myCatches.filter((c) => c.speciesCategory === 'marine').map((c) => c.species)).size
  const record = personalRecord(myCatches)
  const earlyCatch = myCatches.some((c) => new Date(c.caughtAt).getHours() < 8)

  return [
    { icon: 'first', title: 'Первый улов', desc: 'Зафиксирован первый улов в приложении', unlocked: myCatches.length >= 1 },
    { icon: 'territory', title: 'Три территории', desc: 'Заняты три береговые территории', unlocked: myTerritories.length >= 3, progress: `${myTerritories.length}/3` },
    {
      icon: 'species',
      title: 'Коллекционер видов',
      desc: `Поймано ${SPECIES_COLLECTOR_TARGET} разных видов морской рыбы`,
      unlocked: marineSpeciesCount >= SPECIES_COLLECTOR_TARGET,
      progress: `${marineSpeciesCount}/${SPECIES_COLLECTOR_TARGET}`,
    },
    { icon: 'sunrise', title: 'Ранний рыбак', desc: 'Улов зафиксирован до 8 утра', unlocked: earlyCatch },
    { icon: 'record', title: 'Личный рекорд 40 см', desc: 'Поймана рыба длиной от 40 см', unlocked: !!(record && record.lengthCm !== null && record.lengthCm >= 40) },
    { icon: 'ten', title: 'Десять уловов', desc: 'Зафиксировано десять уловов', unlocked: myCatches.length >= 10, progress: `${Math.min(myCatches.length, 10)}/10` },
  ]
}

// Only among catches where a size was actually given — see DECISIONS.md, size
// is optional now. No sized catches -> no record, rather than crashing/picking
// an arbitrary one.
export function personalRecord(myCatches: Catch[]): Catch | null {
  const sized = myCatches.filter((c) => c.lengthCm !== null)
  if (!sized.length) return null
  return sized.reduce((a, b) => (b.lengthCm! > a.lengthCm! ? b : a))
}
