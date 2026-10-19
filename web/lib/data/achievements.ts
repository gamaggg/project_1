import { tn } from '@/lib/i18n/runtime'
import type { Catch, Territory, TerritoryKind } from '@/lib/data/types'
import { METHODS, ALL_BAITS, WATER_KINDS_BY_CITY } from '@/lib/data/species'
import { CITIES, cityForSectorId, type CityId } from '@/lib/data/city'

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
  // One evocative line for the detail screen's flavor card — always shown
  // regardless of locked/unlocked state (the existing `progress` string
  // already covers "how close", so this doesn't need two variants).
  flavor: string
  unlocked: boolean
  // Unlocked only because the server recorded it earlier, not by today's state
  // (the sectors behind it are gone): no popup for it.
  earnedOnly?: boolean
  progress?: string
}

const SPECIES_COLLECTOR_TARGET = 5
const HEAVY_TARGET_KG = 1
const GIANT_TARGET_CM = 60
const LOYAL_TARGET = 5
const LANDLORD_TARGET = 10
const POPULAR_TARGET = 10

// Sectors a player holds for achievements: owned ones plus shares in a
// clan-mate's sector (Territory.coHolders). Inside a clan a sector is shared
// rather than taken over, so a share counts as a whole sector — same rule as
// the server's _sync_achievements_for_user and the weekly rating.
export function heldTerritories(territories: Territory[], userId: string | null | undefined): Territory[] {
  if (!userId) return []
  return territories.filter((t) => t.ownerId === userId || t.coHolders.some((h) => h.id === userId))
}

export type AchievementContext = {
  // Territories this profile currently holds — owned plus clan shares, see
  // heldTerritories above.
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
  // Keys of the achievements this profile has ever earned (user_achievements):
  // they stay unlocked even if the condition no longer holds (sectors lost).
  earned?: readonly string[]
}

// Ported from fishzone-app.html computeAchievements() — real milestones computed
// fresh from current state every time, not stored "unlocked" flags/game points.
// "Коллекционер видов" originally required all 3 (of exactly 3) species — with the
// 36-species table (see DECISIONS.md) "catch everything" isn't a reasonable bar,
// so this counts distinct *marine* species caught against a fixed target instead.
// Moscow has no marine/freshwater split (see lib/data/species) so its variant
// of a few achievements below differs — `city` is whichever map tab is
// currently active (FishZoneApp's own city lens, not an account setting: see
// lib/data/city), same source every other city-aware screen already uses.
export function computeAchievements(myCatches: Catch[], ctx: AchievementContext, city: CityId): Achievement[] {
  const { myTerritories, allTerritories, followersCount, claimedFromOthers } = ctx
  // The freshwater variant (no marine / freshwater split): Moscow, Saint Petersburg, Tbilisi.
  const isMoscow = CITIES[city].theme === 'fresh'

  const speciesCollectorCount = isMoscow
    ? new Set(myCatches.filter((c) => cityForSectorId(c.territoryId) === city).map((c) => c.species)).size
    : new Set(myCatches.filter((c) => c.speciesCategory === 'marine').map((c) => c.species)).size
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
  const requiredWaterKinds: TerritoryKind[] = WATER_KINDS_BY_CITY[city]
  const waterKindsCaught = new Set(
    myCatches
      .filter((c) => cityForSectorId(c.territoryId) === city)
      .map((c) => territoryKindById.get(c.territoryId))
      .filter((k): k is TerritoryKind => !!k && requiredWaterKinds.includes(k))
  )

  const heaviestKg = myCatches.reduce((max, c) => (c.weightKg !== null && c.weightKg > max ? c.weightKg : max), 0)

  const speciesCounts = new Map<string, number>()
  for (const c of myCatches) speciesCounts.set(c.species, (speciesCounts.get(c.species) ?? 0) + 1)
  const maxSameSpecies = Math.max(0, ...speciesCounts.values())

  const list: Achievement[] = [
    {
      icon: 'first',
      title: tn('ach.firstTitle'),
      desc: tn('ach.firstDesc'),
      flavor: tn('ach.firstFlavor'),
      unlocked: myCatches.length >= 1,
    },
    {
      icon: 'territory',
      title: tn('ach.territoryTitle'),
      desc: tn('ach.territoryDesc'),
      flavor: tn('ach.territoryFlavor'),
      unlocked: myTerritories.length >= 3,
      progress: `${myTerritories.length}/3`,
    },
    {
      icon: 'species',
      title: tn('ach.speciesTitle'),
      desc: isMoscow ? tn('ach.speciesDescMoscow', { count: SPECIES_COLLECTOR_TARGET }) : tn('ach.speciesDescSea', { count: SPECIES_COLLECTOR_TARGET }),
      flavor: tn('ach.speciesFlavor'),
      unlocked: speciesCollectorCount >= SPECIES_COLLECTOR_TARGET,
      progress: `${speciesCollectorCount}/${SPECIES_COLLECTOR_TARGET}`,
    },
    {
      icon: 'sunrise',
      title: tn('ach.sunriseTitle'),
      desc: tn('ach.sunriseDesc'),
      flavor: tn('ach.sunriseFlavor'),
      unlocked: earlyCatch,
    },
    {
      icon: 'record',
      title: tn('ach.recordTitle'),
      desc: tn('ach.recordDesc'),
      flavor: tn('ach.recordFlavor'),
      unlocked: !!(record && record.lengthCm !== null && record.lengthCm >= 40),
    },
    {
      icon: 'ten',
      title: tn('ach.tenTitle'),
      desc: tn('ach.tenDesc'),
      flavor: tn('ach.tenFlavor'),
      unlocked: myCatches.length >= 10,
      progress: `${Math.min(myCatches.length, 10)}/10`,
    },
    {
      icon: 'nightowl',
      title: tn('ach.nightowlTitle'),
      desc: tn('ach.nightowlDesc'),
      flavor: tn('ach.nightowlFlavor'),
      unlocked: nightCatch,
    },
    ...(isMoscow
      ? []
      : [
          {
            icon: 'universal' as const,
            title: tn('ach.universalTitle'),
            desc: tn('ach.universalDesc'),
            flavor: tn('ach.universalFlavor'),
            unlocked: hasMarine && hasFreshwater,
          },
        ]),
    {
      icon: 'allmethods',
      title: tn('ach.allmethodsTitle'),
      desc: tn('ach.allmethodsDesc'),
      flavor: tn('ach.allmethodsFlavor'),
      unlocked: methodsUsed >= METHODS.length,
      progress: `${methodsUsed}/${METHODS.length}`,
    },
    {
      icon: 'allbaits',
      title: tn('ach.allbaitsTitle'),
      desc: tn('ach.allbaitsDesc'),
      flavor: tn('ach.allbaitsFlavor'),
      unlocked: baitsUsed >= ALL_BAITS.length,
      progress: `${baitsUsed}/${ALL_BAITS.length}`,
    },
    {
      icon: 'allwaters',
      title: tn('ach.allwatersTitle'),
      desc: requiredWaterKinds.includes('sea') ? tn('ach.allwatersDescSea') : tn('ach.allwatersDescMoscow'),
      flavor: tn('ach.allwatersFlavor'),
      unlocked: waterKindsCaught.size >= requiredWaterKinds.length,
      progress: `${waterKindsCaught.size}/${requiredWaterKinds.length}`,
    },
    {
      icon: 'heavy',
      title: tn('ach.heavyTitle'),
      desc: tn('ach.heavyDesc', { grams: HEAVY_TARGET_KG * 1000 }),
      flavor: tn('ach.heavyFlavor'),
      unlocked: heaviestKg >= HEAVY_TARGET_KG,
    },
    {
      icon: 'giant',
      title: tn('ach.giantTitle'),
      desc: tn('ach.giantDesc', { cm: GIANT_TARGET_CM }),
      flavor: tn('ach.giantFlavor'),
      unlocked: !!(record && record.lengthCm !== null && record.lengthCm >= GIANT_TARGET_CM),
    },
    {
      icon: 'loyal',
      title: tn('ach.loyalTitle'),
      desc: tn('ach.loyalDesc', { count: LOYAL_TARGET }),
      flavor: tn('ach.loyalFlavor'),
      unlocked: maxSameSpecies >= LOYAL_TARGET,
      progress: `${maxSameSpecies}/${LOYAL_TARGET}`,
    },
    {
      icon: 'landlord',
      title: tn('ach.landlordTitle'),
      desc: tn('ach.landlordDesc', { count: LANDLORD_TARGET }),
      flavor: tn('ach.landlordFlavor'),
      unlocked: myTerritories.length >= LANDLORD_TARGET,
      progress: `${Math.min(myTerritories.length, LANDLORD_TARGET)}/${LANDLORD_TARGET}`,
    },
    {
      icon: 'popular',
      title: tn('ach.popularTitle'),
      desc: tn('ach.popularDesc', { count: POPULAR_TARGET }),
      flavor: tn('ach.popularFlavor'),
      unlocked: followersCount >= POPULAR_TARGET,
      progress: `${Math.min(followersCount, POPULAR_TARGET)}/${POPULAR_TARGET}`,
    },
    {
      icon: 'conqueror',
      title: tn('ach.conquerorTitle'),
      desc: tn('ach.conquerorDesc'),
      flavor: tn('ach.conquerorFlavor'),
      unlocked: claimedFromOthers,
    },
  ]
  // Earned once, earned for good: what the server has recorded stays unlocked
  // when the live state has moved on (ten sectors held, then lost).
  const earned = new Set(ctx.earned ?? [])
  for (const a of list) {
    if (!a.unlocked && earned.has(a.icon)) {
      a.unlocked = true
      a.earnedOnly = true
    }
  }
  return list.sort((a, b) => Number(b.unlocked) - Number(a.unlocked)) // unlocked first, stable otherwise
}

// Only among catches where a size was actually given — see DECISIONS.md, size
// is optional now. No sized catches -> no record, rather than crashing/picking
// an arbitrary one.
export function personalRecord(myCatches: Catch[]): Catch | null {
  const sized = myCatches.filter((c) => c.lengthCm !== null)
  if (!sized.length) return null
  return sized.reduce((a, b) => (b.lengthCm! > a.lengthCm! ? b : a))
}
