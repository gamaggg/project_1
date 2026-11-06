import { fallHq } from '@/lib/clan2/demoStore'
import { DEFAULT_SETTINGS, DAY, HOURS, questReward, questTarget } from '@/lib/clan2/rules'
import type { ClanRole, DemoMember, DemoState, MapSector, TreasuryEntry } from '@/lib/clan2/types'
import { resolveCrest } from '@/lib/data/clanCrests'
import type { ClanDetail, Territory } from '@/lib/data/types'

// The demo state of the clan the player really belongs to: its name, crest, level, members and sectors
// are the real ones (read, never written); everything new — the treasury, the HQ, the buildings — starts
// fresh and lives in this browser only.

export type LiveInput = {
  clan: ClanDetail
  userId: string
  coins: number
  isSuperAdmin: boolean
  territories: Territory[]
}

export const liveKey = (userId: string, clanId: number) => `range:clan2-live:v1:${userId}:${clanId}`

const hueOf = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

const isHot = (t: Territory, now: number) => !!t.hotUntil && new Date(t.hotUntil).getTime() > now

export function liveSectors(clanId: number, territories: Territory[], now: number): MapSector[] {
  return territories
    .filter((t) => t.ownerClanId === clanId && t.status !== 'free')
    .map((t) => ({
      id: t.id,
      q: 0,
      r: 0,
      owner: 'mine' as const,
      defense: t.defense,
      shield: !!t.shieldUntil && new Date(t.shieldUntil).getTime() > now,
      hot: isHot(t, now),
      shared: 1 + t.coHolders.length,
      skin: null,
      hq: null,
    }))
}

export function liveMembers(clan: ClanDetail, viewAs: ClanRole | null, userId: string): DemoMember[] {
  return clan.members.map((m) => ({
    id: m.userId,
    name: m.displayName,
    role: m.userId === userId && viewAs ? viewAs : m.role,
    hue: hueOf(m.userId),
    weekDeposit: 0,
    weekMeters: m.weekCatches * 10,
    lastCatchMin: m.weekCatches > 0 ? 180 : null,
    online: false,
  }))
}

export function buildLiveState(input: LiveInput, now: number = Date.now()): DemoState {
  const { clan, userId, coins, isSuperAdmin, territories } = input
  const realRole: ClanRole = clan.myRole ?? 'member'
  const members = liveMembers(clan, null, userId)
  const active = members.filter((m) => m.lastCatchMin !== null).length
  const weekCatches = clan.members.reduce((n, m) => n + m.weekCatches, 0)
  const seed: TreasuryEntry = { id: 1, at: now, kind: 'seed', amount: 800, actor: null, note: 'demo' }
  // The other clans of the city, for the tournament table: by how many sectors they hold.
  const byClan = new Map<number, { name: string; n: number }>()
  for (const t of territories) {
    if (!t.ownerClanId || t.status === 'free') continue
    const e = byClan.get(t.ownerClanId) ?? { name: t.ownerClanName ?? '', n: 0 }
    e.n++
    byClan.set(t.ownerClanId, e)
  }
  const standings = [...byClan.entries()]
    .map(([id, e]) => ({ clan: e.name, score: e.n * 4, mine: id === clan.id }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  return {
    live: { clanId: clan.id, userId, realRole, viewAs: null, isSuperAdmin },
    clockOffsetMs: 0,
    persona: realRole === 'leader' || realRole === 'co_leader' ? 'leader' : 'member',
    myId: userId,
    wallet: coins,
    clan: {
      name: clan.name,
      motto: clan.motto ?? '',
      crest: resolveCrest(clan.crest),
      background: clan.background,
      level: clan.level,
      xp: clan.xp,
      trophies: clan.trophies,
    },
    members,
    treasury: { balance: 800, taxRate: 0, entries: [seed], goalId: null },
    buff: { phase: 'idle', startsAt: null, endsAt: null, cooldownUntil: null, rsvp: [], startedBy: null, lastBonus: 0 },
    hq: { sectorId: null, placedAt: null, lastMoveAt: null, siege: null, defenseAt: null, ruins: null },
    alerts: [],
    quest: { kind: 'catches', target: questTarget('catches', active), progress: Math.min(weekCatches, questTarget('catches', active)), reward: questReward('catches', 0), endsAt: now + 3 * DAY, claimed: false },
    projects: { dock: 0, beacon: 0, fort: 0, board: 0, storage: 0 },
    owned: [],
    equippedSkin: null,
    bounties: [],
    tournament: { species: 'stavrida', endsAt: now + 3 * DAY, standings },
    hall: [],
    season: { n: 1, startedAt: now - 2 * DAY, endsAt: now + 26 * DAY, trophies: clan.trophies },
    recruit: [],
    sectors: liveSectors(clan.id, territories, now),
    settings: { ...DEFAULT_SETTINGS },
    toursSeen: { player: true, admin: true },
    questSeen: [],
    lastRentAt: now - 6 * HOURS,
    nudgedAt: {},
    seq: 100,
  }
}

// Brings the real parts of a saved state up to date (the clan may have lost or won sectors, changed members).
export function syncLiveState(d: DemoState, input: LiveInput, now: number = Date.now()) {
  const { clan, userId, territories } = input
  const fresh = liveSectors(clan.id, territories, now)
  const old = new Map(d.sectors.map((x) => [x.id, x]))
  d.sectors = fresh.map((f) => {
    const o = old.get(f.id)
    if (!o) return f
    // The local game owns the headquarters sector's defence (the real one keeps its own count).
    return { ...f, skin: o.skin, hq: o.hq, defense: o.hq ? o.defense : f.defense }
  })
  // A sector the clan held and the real game took away: with the HQ on it, the headquarters has fallen.
  if (d.hq.sectorId && !d.sectors.some((x) => x.id === d.hq.sectorId)) {
    const t = territories.find((x) => x.id === d.hq.sectorId)
    fallHq(d, t?.ownerClanName ?? t?.ownerDisplayName ?? '?', now + (d.clockOffsetMs ?? 0))
  }
  d.clan.level = Math.max(d.clan.level, clan.level)
  d.clan.name = clan.name
  d.clan.crest = resolveCrest(clan.crest)
  d.clan.trophies = clan.trophies
  d.members = liveMembers(clan, d.live?.viewAs ?? null, userId)
  if (d.live) d.live.realRole = clan.myRole ?? d.live.realRole
}
