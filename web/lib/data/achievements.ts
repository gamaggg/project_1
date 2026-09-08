import type { Catch, Territory } from '@/lib/data/types'
import { METHODS, BAITS } from '@/lib/data/species'

export type Achievement = {
  icon:
    | 'first'
    | 'territory'
    | 'species'
    | 'sunrise'
    | 'record'
    | 'ten'
    | 'universal'
    | 'allmethods'
    | 'allbaits'
    | 'allwaters'
    | 'heavy'
    | 'giant'
    | 'nightowl'
    | 'loyal'
    | 'landlord'
    | 'popular'
    | 'conqueror'
  title: string
  desc: string
  unlocked: boolean
  progress?: string
}

const SPECIES_COLLECTOR_TARGET = 5
const HEAVY_TARGET_KG = 1
const GIANT_TARGET_CM = 60
const LOYAL_TARGET = 5
const LANDLORD_TARGET = 10
const POPULAR_TARGET = 10

export type AchievementContext = {
  // Territories this profile currently owns — same set ProfileScreen/
  // UserProfileScreen already render under "Мои/чужие территории".
  myTerritories: Territory[]
  // The full board, needed only to look up which kind (sea/river/stream/lake)
  // each of this profile's catches happened in — myCatches only carries a
  // territoryId, not the kind, and a since-lost sector wouldn't be in
  // myTerritories anymore.
  allTerritories: Territory[]
  followersCount: number
  // Did this profile ever take over a sector that belonged to someone else
  // (activity_log kind:'claim' with a previous_owner_id)? Computed by the
  // caller (useHasClaimedFromOthers) since it needs its own query.
  claimedFromOthers: boolean
}

// Ported from fishzone-app.html computeAchievements() — real milestones computed
// fresh from current state every time, not stored "unlocked" flags/game points.
// "Коллекционер видов" originally required all 3 (of exactly 3) species — with the
// 36-species table (see DECISIONS.md) "catch everything" isn't a reasonable bar,
// so this counts distinct *marine* species caught against a fixed target instead.
export function computeAchievements(myCatches: Catch[], ctx: AchievementContext): Achievement[] {
  const { myTerritories, allTerritories, followersCount, claimedFromOthers } = ctx

  const marineSpeciesCount = new Set(myCatches.filter((c) => c.speciesCategory === 'marine').map((c) => c.species)).size
  const record = personalRecord(myCatches)
  const earlyCatch = myCatches.some((c) => new Date(c.caughtAt).getHours() < 7)
  // "После 00:00" — bounded to the dead of night (before dawn), otherwise
  // "any time from midnight onward" would just mean "always true".
  const nightCatch = myCatches.some((c) => new Date(c.caughtAt).getHours() < 4)

  const hasMarine = myCatches.some((c) => c.speciesCategory === 'marine')
  const hasFreshwater = myCatches.some((c) => c.speciesCategory === 'freshwater')

  const methodsUsed = new Set(myCatches.map((c) => c.method).filter((m): m is string => !!m)).size
  const baitsUsed = new Set(myCatches.map((c) => c.bait).filter((b): b is string => !!b)).size

  const territoryKindById = new Map(allTerritories.map((t) => [t.id, t.kind]))
  const waterKindsCaught = new Set(
    myCatches.map((c) => territoryKindById.get(c.territoryId)).filter((k): k is Territory['kind'] => !!k)
  )

  const heaviestKg = myCatches.reduce((max, c) => (c.weightKg !== null && c.weightKg > max ? c.weightKg : max), 0)

  const speciesCounts = new Map<string, number>()
  for (const c of myCatches) speciesCounts.set(c.species, (speciesCounts.get(c.species) ?? 0) + 1)
  const maxSameSpecies = Math.max(0, ...speciesCounts.values())

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
    { icon: 'sunrise', title: 'Ранний рыбак', desc: 'Улов зафиксирован до 7 утра', unlocked: earlyCatch },
    { icon: 'record', title: 'Личный рекорд 40 см', desc: 'Поймана рыба длиной от 40 см', unlocked: !!(record && record.lengthCm !== null && record.lengthCm >= 40) },
    { icon: 'ten', title: 'Десять уловов', desc: 'Зафиксировано десять уловов', unlocked: myCatches.length >= 10, progress: `${Math.min(myCatches.length, 10)}/10` },
    { icon: 'nightowl', title: 'Ночной клёв', desc: 'Улов зафиксирован после полуночи', unlocked: nightCatch },
    { icon: 'universal', title: 'Универсал', desc: 'Поймана и морская, и пресноводная рыба', unlocked: hasMarine && hasFreshwater },
    {
      icon: 'allmethods',
      title: 'Всеядный',
      desc: 'Испробованы все способы ловли',
      unlocked: methodsUsed >= METHODS.length,
      progress: `${methodsUsed}/${METHODS.length}`,
    },
    {
      icon: 'allbaits',
      title: 'Экспериментатор',
      desc: 'Испробованы все виды приманок',
      unlocked: baitsUsed >= BAITS.length,
      progress: `${baitsUsed}/${BAITS.length}`,
    },
    {
      icon: 'allwaters',
      title: 'Обошёл всё побережье',
      desc: 'Улов в каждом типе водоёма: море, река, ручей, озеро',
      unlocked: waterKindsCaught.size >= 4,
      progress: `${waterKindsCaught.size}/4`,
    },
    { icon: 'heavy', title: 'Тяжеловес', desc: `Поймана рыба весом от ${HEAVY_TARGET_KG} кг`, unlocked: heaviestKg >= HEAVY_TARGET_KG },
    { icon: 'giant', title: 'Гигант', desc: `Поймана рыба длиной от ${GIANT_TARGET_CM} см`, unlocked: !!(record && record.lengthCm !== null && record.lengthCm >= GIANT_TARGET_CM) },
    {
      icon: 'loyal',
      title: 'Постоянный клиент',
      desc: `Один вид пойман ${LOYAL_TARGET} раз`,
      unlocked: maxSameSpecies >= LOYAL_TARGET,
      progress: `${maxSameSpecies}/${LOYAL_TARGET}`,
    },
    {
      icon: 'landlord',
      title: 'Хозяин побережья',
      desc: `Заняты ${LANDLORD_TARGET} территорий одновременно`,
      unlocked: myTerritories.length >= LANDLORD_TARGET,
      progress: `${Math.min(myTerritories.length, LANDLORD_TARGET)}/${LANDLORD_TARGET}`,
    },
    {
      icon: 'popular',
      title: 'Известный рыбак',
      desc: `${POPULAR_TARGET}+ подписчиков`,
      unlocked: followersCount >= POPULAR_TARGET,
      progress: `${Math.min(followersCount, POPULAR_TARGET)}/${POPULAR_TARGET}`,
    },
    { icon: 'conqueror', title: 'Отбил территорию', desc: 'Занял сектор, который раньше принадлежал другому', unlocked: claimedFromOthers },
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
