import type { EconomySettings, GoalItem, ProjectId, ProjectLevel, QuestKind, TreasuryKind } from '@/lib/clan2/types'

// The numbers of the clan economy. The server (web/supabase-drafts/clan-update-06-11/)
// holds the same ones in `clan_economy`; the admin screen edits them there.
// Where a number comes from is written beside it — all of it checked against
// the database on 06.11.2026.

export const HOURS = 3_600_000
export const DAY = 24 * HOURS

// The personal Kazna paid 1 coin per 3 hours per sector (8 a day). The clan
// rent keeps that rate, but goes to the clan's treasury and has no 30-a-day cap.
// So one sector = 1 coin every 3 hours; the sector with the headquarters pays 2 every 3 hours (16 a day).
export const DEFAULT_SETTINGS: EconomySettings = {
  enabled: true,
  rentPerSectorDay: 8,
  // A sector several clan-mates share pays more, so the clan gains from sharing.
  sharedRentFactor: 1.5,
  // A two-hour window of a clan brings 74 coins from catches on average (median 55,
  // top tenth 155, best 250; a catch pays 15.4): ×2 on that alone is worth little,
  // so the buff is priced in hundreds and also lifts the chest and battle metres.
  buffPrice: 300,
  buffCooldownHours: 12,
  buffMinRsvp: 3,
  taxMax: 10,
  // The share of the clan chest's and the battle's coins that goes to the treasury.
  chestShare: 25,
  recruitReward: 100,
  hqPlaceCost: 1000,
  hqMoveCost: 2000,
  // Finishing a build whole costs this share of the building's price (see speedupCost); the owner can change it.
  speedupShare: 35,
}

export const TAX_RATES = [0, 5, 10] as const
export const BUFF_HOURS = 2
export const BUFF_COIN_FACTOR = 2
export const BUFF_METER_FACTOR = 1.5
export const HQ_RENT_FACTOR = 2
export const HQ_MOVE_COOLDOWN_DAYS = 3
// An outsider's catch on an HQ sector with no defence left starts a siege, not a capture: the clan has this long to break it.
export const SIEGE_MINUTES = 30
// The defence of a sector is 0–3 shields everywhere in the game (SectorDefense.tsx).
export const DEFENSE_MAX = 3
// A fallen HQ: the attackers carry off this share of the treasury (at most HQ_LOOT_MAX), the clan's buildings sleep
// until a new HQ stands, and a new one cannot be built for HQ_RUINS_HOURS.
export const HQ_LOOT_SHARE = 0.2
export const HQ_LOOT_MAX = 1500
export const HQ_RUINS_HOURS = 24
export const SIEGE_BREAK_REWARD = 20

// The treasury holds only so much, by clan level (the levels of lib/data/clanLevels.ts, 1–10):
// it cannot be hoarded for ever, which keeps the money moving. «Склад» adds to it.
export function treasuryCap(level: number, storage: ProjectLevel): number {
  const base = level >= 9 ? 20_000 : level >= 7 ? 12_000 : level >= 5 ? 8_000 : level >= 3 ? 5_000 : 3_000
  return base + PROJECT_EFFECTS.storage.cap[storage]
}

// What the sectors of the clan earn in a day: a sector shared by clan-mates pays more, the HQ sector doubles.
export function dailyRent(settings: EconomySettings, plainSectors: number, sharedSectors: number, hqSector: boolean, market: ProjectLevel = 0): number {
  const plain = plainSectors * settings.rentPerSectorDay
  const shared = sharedSectors * settings.rentPerSectorDay * settings.sharedRentFactor
  const hq = hqSector ? settings.rentPerSectorDay * (HQ_RENT_FACTOR - 1) : 0
  return Math.round((plain + shared + hq) * (1 + PROJECT_EFFECTS.market.rentPct[market] / 100))
}

// How the coin bonuses add up on one catch: hot sector +1, clan buff +1 (the old «×3, not ×4»). The
// personal «Двойные монеты» are gone, so it can no longer be ×4.
export function coinMultiplier(hotSector: boolean, clanBuff: boolean): number {
  return 1 + (hotSector ? 1 : 0) + (clanBuff ? 1 : 0)
}

// The catch tax: a share of the coins for the species, taken from the catcher.
export function taxOf(coins: number, ratePercent: number): number {
  return Math.floor((coins * ratePercent) / 100)
}

export function shareOf(coins: number, settings: EconomySettings): number {
  return Math.floor((coins * settings.chestShare) / 100)
}

// The treasury takes only up to its cap; the rest is lost (the entry says how much).
export function intake(balance: number, cap: number, amount: number): { added: number; lost: number } {
  const room = Math.max(0, cap - balance)
  const added = Math.min(room, amount)
  return { added, lost: amount - added }
}

export const SPEND_KINDS: TreasuryKind[] = ['spend_buff', 'spend_goal', 'spend_project', 'spend_hq', 'spend_skin']
export const isSpend = (kind: TreasuryKind) => SPEND_KINDS.includes(kind)

// Clan buildings. They stand only while the clan's headquarters stands: with the HQ fallen they sleep.
// Every level changes something real in the game (the numbers below), not just the look.
//
// Pacing: the whole base (6 buildings x 3 levels) costs 35 000 coins. A clan holding 27 sectors earns about
// 220 a day from rent and 300-350 with tax, deposits and its share of the chest, so a clan that plays together
// needs about three months; a small clan needs longer and gets its perks as it goes. On top of the money:
//   - a level opens only with the clan's own level (BUILD_CLAN_LEVEL), so activity decides, not only coins;
//   - the building takes time (BUILD_HOURS) and only one is built at a time.
export const PROJECTS: Record<ProjectId, { costs: [number, number, number] }> = {
  storage: { costs: [500, 1_200, 2_800] },
  board: { costs: [400, 900, 2_100] },
  beacon: { costs: [600, 1_500, 3_300] },
  fort: { costs: [700, 1_800, 3_900] },
  dock: { costs: [900, 2_100, 4_500] },
  market: { costs: [900, 2_100, 4_800] },
}
// What the next level (index = level it builds) needs from the clan's level, and how long it takes.
export const BUILD_CLAN_LEVEL = [2, 4, 6] as const
// A level takes this long to build; the heavier the building, the longer (the longest, the fort's third level, is
// about five days). A clan can finish a build at once for coins, like Clash of Clans' gems. The price is worked
// out from the economy, not from a flat rate: finishing a build whole costs SPEEDUP_SHARE % of what the building
// itself cost, and a build that is half done costs half of that. That is about what the clan would have earned
// waiting (a clan of 27 sectors earns 300-350 a day: the fort's last level, 115 hours, is about 1 500 coins of
// waiting and costs 1 365 to skip), so skipping buys back time at the clan's own pace and never makes the build
// nearly free, and it competes with saving up for the next building.
export const BUILD_HOURS: Record<ProjectId, readonly [number, number, number]> = {
  storage: [12, 36, 72],
  board: [12, 36, 72],
  beacon: [14, 42, 86],
  market: [16, 50, 100],
  dock: [16, 50, 100],
  fort: [20, 58, 115],
}
export const SPEEDUP_MIN = 20
export function speedupCost(settings: EconomySettings, buildCost: number, startedAt: number, endsAt: number, now: number): number {
  const total = Math.max(1, endsAt - startedAt)
  const left = Math.min(total, Math.max(0, endsAt - now))
  return left === 0 ? 0 : Math.max(SPEEDUP_MIN, Math.ceil(((buildCost * settings.speedupShare) / 100) * (left / total)))
}
// Index = the building's level (0 = not built).
export const PROJECT_EFFECTS = {
  // «Причал»: more places in the clan (clans.extra_slots on the server).
  dock: { slots: [0, 2, 4, 6] },
  // «Маяк»: more minutes to break a siege of the HQ.
  beacon: { siegeMinutes: [0, 10, 20, 30] },
  // «Крепость»: the defence of the HQ sector wears down 1 per this many days without clan catches (1 for everybody else).
  fort: { decayDays: [1, 2, 3, 5] },
  // «Доска заданий»: a bigger reward for the weekly task.
  board: { questPct: [0, 15, 30, 50] },
  // «Склад»: the treasury holds more.
  storage: { cap: [0, 1_000, 2_500, 5_000] },
  // «Рынок»: the rent of every sector is higher.
  market: { rentPct: [0, 5, 10, 15] },
} as const
export const PROJECT_IDS: ProjectId[] = ['dock', 'beacon', 'fort', 'board', 'storage', 'market']

// The clan skins of the sector: animated, painted by lib/map/clanSkins.ts. One clan wears one at a time.
// A skin opens with the clan's level (the treasury cap at that level is above its price) and costs about a month of saving.
export const CLAN_SKINS = [
  { id: 'clan_tide', price: 5_000, minLevel: 3 },
  { id: 'clan_aurora', price: 8_000, minLevel: 5 },
  { id: 'clan_flotilla', price: 11_000, minLevel: 7 },
  { id: 'clan_lanterns', price: 15_000, minLevel: 9 },
] as const

// What the treasury can save up for.
export const GOAL_CATALOG: GoalItem[] = [
  { id: 'skin_clan_tide', kind: 'clan_skin', cost: 5_000, minLevel: 3 },
  { id: 'skin_clan_aurora', kind: 'clan_skin', cost: 8_000, minLevel: 5 },
  { id: 'skin_clan_flotilla', kind: 'clan_skin', cost: 11_000, minLevel: 7 },
  { id: 'skin_clan_lanterns', kind: 'clan_skin', cost: 15_000, minLevel: 9 },
  { id: 'boat_gold', kind: 'boat', cost: 6_000, minLevel: 5 },
  { id: 'banner_storm', kind: 'banner', cost: 3_000, minLevel: 3 },
]

// The weekly quest of the whole clan: the target grows with the clan's active members (the
// Duolingo «family quest» idea — more people, more to do, so everyone has to take part).
export function questTarget(kind: QuestKind, activeMembers: number): number {
  // Calibrated on the database (06.11): an active player makes about 8 catches and 2 captures a week;
  // the targets are set near 60 % of that, so a clan that plays together reaches them.
  const per: Record<QuestKind, number> = { catches: 5, species: 1, capture: 1, rare: 0.6 }
  const floor: Record<QuestKind, number> = { catches: 20, species: 5, capture: 4, rare: 3 }
  return Math.max(floor[kind], Math.round(per[kind] * Math.max(1, activeMembers)))
}

export function questReward(kind: QuestKind, board: ProjectLevel = 0): number {
  const base = { catches: 150, species: 200, capture: 180, rare: 220 }[kind]
  return Math.round(base * (1 + PROJECT_EFFECTS.board.questPct[board] / 100))
}

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ | /g, ' ')
