import { DAY, DEFAULT_SETTINGS, HOURS, questTarget, questReward } from '@/lib/clan2/rules'
import type { ClanRole, DemoMember, DemoState, HallRecord, MapSector, SectorOwner, TreasuryEntry } from '@/lib/clan2/types'

// The fictional clan the demo runs on: «Морские волки» of Batumi, nine
// players, a small map around its headquarters, a week of treasury history.
// Nothing here is real data; every id is local to the demo.

const M = (id: string, name: string, role: ClanRole, hue: number, weekDeposit: number, weekMeters: number, lastCatchMin: number | null, online: boolean): DemoMember => ({
  id,
  name,
  role,
  hue,
  weekDeposit,
  weekMeters,
  lastCatchMin,
  online,
})

export const DEMO_MEMBERS: DemoMember[] = [
  M('m1', 'Мага', 'leader', 205, 340, 420, 12, true),
  M('m2', 'Руслан', 'co_leader', 28, 210, 380, 35, true),
  M('m3', 'Георгий', 'elder', 150, 95, 260, 190, false),
  M('m4', 'Нино', 'member', 330, 60, 240, 75, true),
  M('m5', 'Давид', 'member', 262, 120, 310, 22, true),
  M('m6', 'Анна', 'member', 8, 0, 90, 1260, false),
  M('m7', 'Илья', 'member', 98, 45, 150, 410, false),
  M('m8', 'Тамара', 'member', 190, 30, 70, 2300, false),
  M('m9', 'Саша', 'member', 52, 0, 0, null, false),
]

// A hex of radius 3 around (0,0): 37 sectors. Axial coordinates; the map
// component turns them into pixels.
const LAYOUT: { q: number; r: number; owner: SectorOwner; defense?: number; shield?: boolean; hot?: boolean; shared?: number; hq?: 'mine' | 'enemy' }[] = [
  // The clan: nine sectors around the headquarters.
  { q: -1, r: 1, owner: 'mine', defense: 3, hq: 'mine' },
  { q: -2, r: 1, owner: 'mine', defense: 2 },
  { q: -2, r: 2, owner: 'mine', defense: 3 },
  { q: -1, r: 2, owner: 'mine', defense: 1 },
  { q: -1, r: 0, owner: 'mine', defense: 2, shared: 2 },
  { q: 0, r: 0, owner: 'mine', defense: 3, shared: 3 },
  { q: 0, r: 1, owner: 'mine', defense: 2, shield: true },
  { q: -3, r: 2, owner: 'mine', defense: 1 },
  { q: -2, r: 0, owner: 'mine', defense: 2 },
  // An allied clan to the south-west.
  { q: -3, r: 3, owner: 'ally', defense: 2 },
  { q: -2, r: 3, owner: 'ally', defense: 1 },
  { q: -1, r: 3, owner: 'ally', defense: 3 },
  // The rival to the north-east, with a headquarters of its own.
  { q: 1, r: -1, owner: 'enemy', defense: 3, hq: 'enemy' },
  { q: 1, r: 0, owner: 'enemy', defense: 2 },
  { q: 0, r: -1, owner: 'enemy', defense: 1 },
  { q: 2, r: -1, owner: 'enemy', defense: 2, shield: true },
  { q: 1, r: -2, owner: 'enemy', defense: 1 },
  { q: 2, r: 0, owner: 'enemy', defense: 3 },
  { q: 0, r: -2, owner: 'enemy', defense: 0 },
]

export function buildSectors(): MapSector[] {
  const sectors: MapSector[] = []
  let n = 0
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (Math.abs(q + r) > 3) continue
      n++
      const spec = LAYOUT.find((s) => s.q === q && s.r === r)
      sectors.push({
        id: `B${1020 + n}`,
        q,
        r,
        owner: spec?.owner ?? 'free',
        defense: spec?.defense ?? 0,
        shield: spec?.shield ?? false,
        hot: spec ? false : q === 1 && r === 1,
        shared: spec?.shared ?? 1,
        skin: spec?.owner === 'mine' ? 'clan_tide' : null,
        hq: spec?.hq ?? null,
      })
    }
  }
  return sectors
}

// The ids are numbered as the grid is walked, so they are looked up, never typed.
const SECTORS0 = buildSectors()
export const HQ_SECTOR_ID = SECTORS0.find((s) => s.hq === 'mine')!.id
export const sectorIdAt = (q: number, r: number) => SECTORS0.find((s) => s.q === q && s.r === r)!.id

function history(now: number): TreasuryEntry[] {
  let id = 0
  const e = (ago: number, kind: TreasuryEntry['kind'], amount: number, actor: string | null, note: string): TreasuryEntry => ({ id: ++id, at: now - ago, kind, amount, actor, note })
  return [
    e(6.8 * DAY, 'rent', 168, null, 'rent'),
    e(6.6 * DAY, 'deposit', 200, 'm1', ''),
    e(6.1 * DAY, 'tax', 14, 'm5', 'skorpena'),
    e(5.8 * DAY, 'rent', 176, null, 'rent'),
    e(5.3 * DAY, 'chest_share', 96, null, 'chest'),
    e(5.3 * DAY, 'race_share', 60, null, 'race'),
    e(4.9 * DAY, 'tax', 8, 'm4', 'stavrida'),
    e(4.8 * DAY, 'rent', 184, null, 'rent'),
    e(4.2 * DAY, 'spend_project', -900, 'm1', 'dock:1'),
    e(3.9 * DAY, 'deposit', 120, 'm2', ''),
    e(3.8 * DAY, 'rent', 184, null, 'rent'),
    e(3.4 * DAY, 'tax', 22, 'm5', 'katran'),
    e(2.9 * DAY, 'hot_rent', 48, null, 'hot'),
    e(2.8 * DAY, 'rent', 192, null, 'rent'),
    e(2.5 * DAY, 'spend_hq', -1000, 'm1', 'hq'),
    e(2.2 * DAY, 'recruit', 100, null, 'Нино'),
    e(1.8 * DAY, 'rent', 192, null, 'rent'),
    e(1.4 * DAY, 'deposit', 90, 'm3', ''),
    e(1.1 * DAY, 'tax', 10, 'm2', 'lufar'),
    e(0.8 * DAY, 'rent', 192, null, 'rent'),
    e(0.5 * DAY, 'tax', 12, 'm1', 'sibas'),
    e(0.2 * DAY, 'deposit', 50, 'm4', ''),
  ].reverse()
}

const HALL: HallRecord[] = [
  { species: 'katran', member: 'Давид', cm: 88, kg: 4.1, at: -9 * DAY, hue: 262 },
  { species: 'lufar', member: 'Мага', cm: 64, kg: 3.2, at: -5 * DAY, hue: 205 },
  { species: 'sibas', member: 'Руслан', cm: 58, kg: 2.7, at: -12 * DAY, hue: 28 },
  { species: 'skorpena', member: 'Нино', cm: 31, kg: 0.9, at: -2 * DAY, hue: 330 },
  { species: 'kefal', member: 'Георгий', cm: 47, kg: 1.6, at: -7 * DAY, hue: 150 },
]

export function initialDemoState(now: number = Date.now()): DemoState {
  const active = DEMO_MEMBERS.filter((m) => m.lastCatchMin !== null && m.lastCatchMin < 7 * 24 * 60).length
  return {
    clockOffsetMs: 0,
    persona: 'leader',
    myId: 'm1',
    wallet: 1520,
    clan: {
      name: 'Морские волки',
      motto: 'Ловим вместе',
      crest: { shape: 'shield', symbol: 'anchor', primary: '#1D5C80', secondary: '#F0A93E' },
      background: 'waves',
      level: 5,
      xp: 850,
      trophies: 640,
    },
    members: DEMO_MEMBERS.map((m) => ({ ...m })),
    treasury: { balance: 1240, taxRate: 5, entries: history(now), goalId: 'skin_clan_lanterns' },
    buff: { phase: 'idle', startsAt: null, endsAt: null, cooldownUntil: null, rsvp: [], startedBy: null, lastBonus: 0 },
    hq: { sectorId: HQ_SECTOR_ID, placedAt: now - 2.5 * DAY, lastMoveAt: null, siege: null, defenseAt: now - 0.5 * DAY, ruins: null },
    alerts: [
      { id: 1, at: now - 3 * HOURS, kind: 'sector_attack', text: sectorIdAt(-2, 0), sectorId: sectorIdAt(-2, 0), read: true },
      { id: 2, at: now - 26 * HOURS, kind: 'project_done', text: 'dock', read: true },
    ],
    quest: { kind: 'catches', target: questTarget('catches', active), progress: 21, reward: questReward('catches', 1), endsAt: now + 3.2 * DAY, claimed: false },
    projects: { dock: 1, beacon: 0, fort: 0, board: 1, storage: 0, market: 0 },
    build: null,
    owned: ['clan_tide'],
    equippedSkin: 'clan_tide',
    hall: HALL.map((h) => ({ ...h, at: now + h.at })),
    recruit: [
      { name: 'Лео', state: 'caught', daysLeft: 0 },
      { name: 'Мариам', state: 'joined', daysLeft: 5 },
      { name: 'Бека', state: 'invited', daysLeft: 6 },
    ],
    sectors: buildSectors(),
    settings: { ...DEFAULT_SETTINGS },
    toursSeen: { player: false, admin: false },
    questSeen: [],
    lastRentAt: now - 0.8 * DAY,
    nudgedAt: {},
    seq: 100,
  }
}
