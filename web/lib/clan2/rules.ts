import type { EconomySettings, GoalItem, ProjectId, ProjectLevel, QuestKind, TreasuryKind, WeeklyQuest } from '@/lib/clan2/types'

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
export const SIEGE_MINUTES = 90
// The defence of a sector is 0–3 shields everywhere in the game (SectorDefense.tsx).
export const DEFENSE_MAX = 3
// A fallen HQ: the attackers carry off this share of the treasury (at most HQ_LOOT_MAX), the clan's buildings sleep
// until a new HQ stands, and a new one cannot be built for HQ_RUINS_HOURS.
export const HQ_LOOT_SHARE = 0.2
export const HQ_LOOT_MAX = 1500
export const HQ_RUINS_HOURS = 24
export const SIEGE_BREAK_REWARD = 150

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

// The clan shop: what the treasury buys for the whole clan. Every item opens with the clan's level (its price fits under
// the treasury's cap at that level, without the «Склад»), and any of them can be set as the treasury's goal.
//   clan_skin — the players' own sector skins (lib/data/territorySkins.ts), worn by every sector of the clan on the
//               «Кланы» layer, in the clan's colour; five times the player's price;
//   boat      — the colours of the clan's boat in the clan battle;
//   frame     — a frame round the clan's crest on the clan screen.
export type ShopKind = GoalItem['kind']
// The players' prices of the skins (shop_items, 07.11.2026); the clan pays CLAN_SKIN_FACTOR times that.
const PLAYER_SKIN_PRICE: Record<string, number> = {
  skin_stripes: 300, skin_horizon: 300, skin_diagonal: 350, skin_zigzag: 350, skin_herringbone: 400, skin_rain: 400,
  skin_wave: 450, skin_scribble: 450, skin_net: 500, skin_grass: 550, skin_scales: 800, skin_depth: 1_000,
  skin_compass: 1_300, skin_school: 1_600, skin_sonar: 2_200, skin_aquarium: 2_400, skin_lighthouse: 2_600, skin_lightning: 3_000,
}
export const CLAN_SKIN_FACTOR = 5
// The lowest clan level whose treasury cap (without the «Склад») holds the price.
export function levelForPrice(cost: number): number {
  for (const level of [1, 3, 5, 7, 9]) if (treasuryCap(level, 0) >= cost) return level
  return 9
}
const clanSkinPrice = (player: number) => Math.max(1_500, Math.round((player * CLAN_SKIN_FACTOR) / 500) * 500)
export const SHOP_ITEMS: GoalItem[] = [
  ...Object.entries(PLAYER_SKIN_PRICE).map(([id, p]) => ({ id, kind: 'clan_skin' as const, cost: clanSkinPrice(p), minLevel: levelForPrice(clanSkinPrice(p)) })),
  { id: 'boat_coral', kind: 'boat', cost: 3_000, minLevel: 2 },
  { id: 'boat_night', kind: 'boat', cost: 4_500, minLevel: 4 },
  { id: 'boat_gold', kind: 'boat', cost: 6_000, minLevel: 5 },
  { id: 'boat_dragon', kind: 'boat', cost: 9_000, minLevel: 7 },
  { id: 'frame_bronze', kind: 'frame', cost: 2_000, minLevel: 2 },
  { id: 'frame_silver', kind: 'frame', cost: 4_000, minLevel: 4 },
  { id: 'frame_gold', kind: 'frame', cost: 7_000, minLevel: 6 },
  { id: 'frame_legend', kind: 'frame', cost: 12_000, minLevel: 8 },
]
// The old name: the treasury's goal is any item of the shop.
export const GOAL_CATALOG = SHOP_ITEMS
export const SHOP_KINDS: ShopKind[] = ['clan_skin', 'boat', 'frame']
export const shopItem = (id: string | null | undefined) => SHOP_ITEMS.find((g) => g.id === id) ?? null
// A clan skin's item id is the skin's own id (skin_wave): the map paints the clan's sectors with it.
export const skinIdOf = (itemId: string) => itemId

// What each look is made of.
export const BOAT_LOOKS: Record<string, { primary: string; secondary: string }> = {
  boat_coral: { primary: '#FF6B4A', secondary: '#FFF1E0' },
  boat_night: { primary: '#2A3247', secondary: '#FFC93C' },
  boat_gold: { primary: '#D99A22', secondary: '#FFF3C0' },
  boat_dragon: { primary: '#1F7A5C', secondary: '#F0B53E' },
}

// The month the treasury's «взнос за месяц» counts (it starts again on the 1st, local time).
export function monthKeyOf(now: number): number {
  const d = new Date(now)
  return d.getFullYear() * 12 + d.getMonth()
}

// The weekly task of the whole clan. It is drawn at random when the week starts (the same for the whole clan, by the
// clan and the week), cannot be swapped, and is paid into the treasury when the leader collects it. Eight kinds, each
// counted from the clan's catches of the week; the target grows with the clan's active members so that everybody
// has to take part (the idea of a family quest).
export const QUEST_KINDS: QuestKind[] = ['catches', 'species', 'rare', 'big', 'length', 'members', 'days', 'sectors']
export const BIG_FISH_CM = 60
// «Rare» is a fish that pays this many coins or more.
export const RARE_COINS = 50

export function questTarget(kind: QuestKind, activeMembers: number, members: number = activeMembers): number {
  const a = Math.max(1, activeMembers)
  // Calibrated on the database (06.11): an active player makes about 8 catches a week; targets sit near 60 % of that.
  switch (kind) {
    case 'catches':
      return Math.max(20, Math.round(5 * a))
    case 'species':
      return Math.min(12, Math.max(5, Math.round(a)))
    case 'rare':
      return Math.max(3, Math.round(0.6 * a))
    case 'big':
      return 1
    case 'length':
      return Math.max(8, Math.round(1.6 * a))
    case 'members':
      return Math.max(3, Math.ceil(members * 0.6))
    case 'days':
      return 4
    case 'sectors':
      return Math.max(4, Math.round(a))
  }
}

export function questReward(kind: QuestKind, board: ProjectLevel = 0): number {
  const base: Record<QuestKind, number> = { catches: 150, species: 200, rare: 220, big: 200, length: 150, members: 180, days: 150, sectors: 170 }
  return Math.round(base[kind] * (1 + PROJECT_EFFECTS.board.questPct[board] / 100))
}

// Monday 00:00 (local time) of the week that `now` is in, and the next Monday.
export function weekStartOf(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}
export function weekEndOf(now: number): number {
  const d = new Date(weekStartOf(now))
  d.setDate(d.getDate() + 7)
  return d.getTime()
}

// The kind of the week: a fixed pseudo-random pick by clan and week, so every member sees the same task.
export function pickQuestKind(clanId: number, weekKey: number): QuestKind {
  let h = Math.imul(clanId + 1, 2654435761) ^ Math.imul(weekKey + 7, 40503)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  return QUEST_KINDS[Math.abs(h) % QUEST_KINDS.length]
}
export const weekKeyOf = (now: number) => Math.floor(weekStartOf(now) / (7 * DAY))

export function makeQuest(kind: QuestKind, activeMembers: number, members: number, board: ProjectLevel, endsAt: number): WeeklyQuest {
  return { kind, target: questTarget(kind, activeMembers, members), progress: 0, reward: questReward(kind, board), endsAt, claimed: false, param: kind === 'big' ? BIG_FISH_CM : undefined, real: 0, sim: 0 }
}

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ')
