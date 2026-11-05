import type { EconomySettings, GoalItem, ProjectId, ProjectLevel, QuestKind, TreasuryKind } from '@/lib/clan2/types'

// The numbers of the clan economy. The server (web/supabase-drafts/clan-update-06-11/)
// holds the same ones in `clan_economy`; the admin screen edits them there.
// Where a number comes from is written beside it — all of it checked against
// the database on 06.11.2026.

export const HOURS = 3_600_000
export const DAY = 24 * HOURS

// The personal Kazna paid 1 coin per 3 hours per sector (8 a day). The clan
// rent keeps that rate, but goes to the clan's treasury and has no 30-a-day cap.
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
  hqPlaceCost: 400,
  hqMoveCost: 600,
}

export const TAX_RATES = [0, 5, 10] as const
export const BUFF_HOURS = 2
export const BUFF_COIN_FACTOR = 2
export const BUFF_METER_FACTOR = 1.5
export const HQ_RENT_FACTOR = 2
export const HQ_MOVE_COOLDOWN_DAYS = 3
// An outsider's catch on an HQ sector with no defence left starts a siege, not a capture: the clan has this long to break it.
export const SIEGE_MINUTES = 30
export const SIEGE_BREAK_REWARD = 20
export const BOUNTY_MAX_ACTIVE = 3
// One bounty is at most this share of the treasury, and no member gets more than the cap a day from bounties.
export const BOUNTY_MAX_SHARE = 0.25
export const BOUNTY_DAILY_CAP = 300
export const SEASON_WEEKS = 4

// The treasury holds only so much, by clan level (the levels of lib/data/clanLevels.ts, 1–10):
// it cannot be hoarded for ever, which keeps the money moving. «Склад» adds to it.
export function treasuryCap(level: number, storage: ProjectLevel): number {
  const base = level >= 9 ? 20_000 : level >= 7 ? 12_000 : level >= 5 ? 8_000 : level >= 3 ? 5_000 : 3_000
  return base + STORAGE_BONUS[storage]
}

const STORAGE_BONUS: Record<ProjectLevel, number> = { 0: 0, 1: 1_000, 2: 2_500, 3: 5_000 }

// What the sectors of the clan earn in a day: a sector shared by clan-mates pays more, the HQ sector doubles.
export function dailyRent(settings: EconomySettings, plainSectors: number, sharedSectors: number, hqSector: boolean): number {
  const plain = plainSectors * settings.rentPerSectorDay
  const shared = sharedSectors * settings.rentPerSectorDay * settings.sharedRentFactor
  const hq = hqSector ? settings.rentPerSectorDay * (HQ_RENT_FACTOR - 1) : 0
  return Math.round(plain + shared + hq)
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

export const SPEND_KINDS: TreasuryKind[] = ['spend_buff', 'spend_goal', 'spend_project', 'spend_bounty', 'spend_hq', 'spend_skin']
export const isSpend = (kind: TreasuryKind) => SPEND_KINDS.includes(kind)

// Clan buildings. Cosmetics and conveniences only — nothing here makes a clan stronger in the game itself.
export const PROJECTS: Record<ProjectId, { costs: [number, number, number] }> = {
  dock: { costs: [400, 900, 1800] },
  beacon: { costs: [500, 1200, 2400] },
  board: { costs: [300, 700, 1400] },
  storage: { costs: [600, 1400, 2800] },
}
export const PROJECT_IDS: ProjectId[] = ['dock', 'beacon', 'board', 'storage']

// The clan skins of the sector: animated, painted by lib/map/clanSkins.ts. One clan wears one at a time.
export const CLAN_SKINS = [
  { id: 'clan_tide', price: 900 },
  { id: 'clan_aurora', price: 1200 },
  { id: 'clan_flotilla', price: 1500 },
  { id: 'clan_lanterns', price: 1800 },
] as const

// What the treasury can save up for. A project upgrade is a goal too, priced by PROJECTS.
export const GOAL_CATALOG: GoalItem[] = [
  { id: 'skin_clan_tide', kind: 'clan_skin', cost: 900 },
  { id: 'skin_clan_aurora', kind: 'clan_skin', cost: 1200 },
  { id: 'skin_clan_flotilla', kind: 'clan_skin', cost: 1500 },
  { id: 'skin_clan_lanterns', kind: 'clan_skin', cost: 1800 },
  { id: 'boat_gold', kind: 'boat', cost: 1000 },
  { id: 'banner_storm', kind: 'banner', cost: 700 },
]

// The weekly quest of the whole clan: the target grows with the clan's active members (the
// Duolingo «family quest» idea — more people, more to do, so everyone has to take part).
export function questTarget(kind: QuestKind, activeMembers: number): number {
  const per: Record<QuestKind, number> = { catches: 12, species: 2, capture: 3, rare: 2 }
  const floor: Record<QuestKind, number> = { catches: 30, species: 6, capture: 8, rare: 5 }
  return Math.max(floor[kind], Math.round(per[kind] * Math.max(1, activeMembers)))
}

export function questReward(kind: QuestKind): number {
  return { catches: 150, species: 200, capture: 180, rare: 220 }[kind]
}

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ | /g, ' ')
