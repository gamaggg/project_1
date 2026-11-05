'use client'

import { useSyncExternalStore } from 'react'
import { initialDemoState } from '@/lib/clan2/demoData'
import {
  BOUNTY_DAILY_CAP,
  BOUNTY_MAX_ACTIVE,
  BOUNTY_MAX_SHARE,
  BUFF_HOURS,
  BUFF_METER_FACTOR,
  CLAN_SKINS,
  DAY,
  GOAL_CATALOG,
  HOURS,
  HQ_MOVE_COOLDOWN_DAYS,
  PROJECTS,
  SIEGE_BREAK_REWARD,
  SIEGE_MINUTES,
  coinMultiplier,
  dailyRent,
  intake,
  questTarget,
  taxOf,
  treasuryCap,
} from '@/lib/clan2/rules'
import type { Bounty, ClanAlert, DemoMember, DemoState, EconomySettings, MapSector, Persona, ProjectId, TreasuryEntry, TreasuryKind } from '@/lib/clan2/types'

// The demo's whole world: one state object, changed only by the actions
// below, kept in localStorage so a reload (or a day later) finds it as it
// was. «Ускорить время» shifts the demo clock instead of waiting for hours.
// Every action returns `ok` or the key of the reason it refused (clan2.err.*),
// which the screens show as a toast.

export type Result = { ok: true; info?: string } | { ok: false; reason: string }
const OK: Result = { ok: true }
const no = (reason: string): Result => ({ ok: false, reason })

const KEY = 'range:clan2-demo:v3'

let state: DemoState = initialDemoState()
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) state = JSON.parse(raw) as DemoState
  } catch {
    // A broken save is just the starting world.
  }
}

function commit(next: DemoState) {
  state = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  load()
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, () => (load(), state), () => state)
}

export const getDemoState = () => (load(), state)

// A mutation on a copy: the draft is changed freely, the result replaces the state.
function mutate(fn: (d: DemoState) => Result | void): Result {
  load()
  const draft = structuredClone(state) as DemoState
  const res = fn(draft)
  if (res && !res.ok) return res
  commit(draft)
  return res ?? OK
}

export const nowOf = (s: DemoState) => Date.now() + s.clockOffsetMs
export const meOf = (s: DemoState): DemoMember | null => s.members.find((m) => m.id === s.myId) ?? null
export const canManage = (s: DemoState) => {
  const me = meOf(s)
  return !!me && (me.role === 'leader' || me.role === 'co_leader')
}
export const isLeader = (s: DemoState) => meOf(s)?.role === 'leader'
export const inClan = (s: DemoState) => s.persona !== 'solo'
export const activeMembers = (s: DemoState) => s.members.filter((m) => m.lastCatchMin !== null && m.lastCatchMin < 7 * 24 * 60).length
export const capOf = (s: DemoState) => treasuryCap(s.clan.level, s.projects.storage)
export const goalOf = (s: DemoState) => GOAL_CATALOG.find((g) => g.id === s.treasury.goalId) ?? null

export function sectorCounts(s: DemoState) {
  const mine = s.sectors.filter((x) => x.owner === 'mine')
  const hq = mine.some((x) => x.hq === 'mine')
  const shared = mine.filter((x) => x.shared > 1 && x.hq !== 'mine').length
  const plain = mine.length - shared - (hq ? 1 : 0)
  return { total: mine.length, plain, shared, hq }
}

export function rentPerDay(s: DemoState): number {
  const c = sectorCounts(s)
  // The HQ sector pays like a plain one, and the HQ doubles it (dailyRent adds the second share).
  const hot = s.sectors.filter((x) => x.owner === 'mine' && x.hot).length
  return dailyRent(s.settings, c.plain + (c.hq ? 1 : 0), c.shared, c.hq) + Math.round(hot * s.settings.rentPerSectorDay * 2)
}

function push(d: DemoState, kind: TreasuryKind, amount: number, actor: string | null, note: string, at?: number) {
  const entry: TreasuryEntry = { id: ++d.seq, at: at ?? nowOf(d), kind, amount, actor, note }
  d.treasury.entries.push(entry)
  if (d.treasury.entries.length > 300) d.treasury.entries.splice(0, d.treasury.entries.length - 300)
  return entry
}

// Money coming in: up to the cap. What does not fit is lost, and the entry says so.
function income(d: DemoState, kind: TreasuryKind, amount: number, actor: string | null, note: string, at?: number) {
  const { added, lost } = intake(d.treasury.balance, capOf(d), amount)
  d.treasury.balance += added
  push(d, kind, added, actor, lost > 0 ? `${note}|lost:${lost}` : note, at)
  return added
}

function spend(d: DemoState, kind: TreasuryKind, amount: number, actor: string | null, note: string): boolean {
  if (d.treasury.balance < amount) return false
  d.treasury.balance -= amount
  push(d, kind, -amount, actor, note)
  return true
}

function alert(d: DemoState, kind: ClanAlert['kind'], text: string, sectorId?: string, at?: number) {
  d.alerts.unshift({ id: ++d.seq, at: at ?? nowOf(d), kind, text, sectorId, read: false })
  if (d.alerts.length > 60) d.alerts.length = 60
}

const memberName = (d: DemoState, id: string | null) => d.members.find((m) => m.id === id)?.name ?? ''

// ───────────── time ─────────────

function runTime(d: DemoState) {
  const now = nowOf(d)
  // Rent: one entry per whole day.
  while (now - d.lastRentAt >= DAY) {
    d.lastRentAt += DAY
    const amount = rentPerDay(d)
    if (amount > 0) income(d, 'rent', amount, null, 'rent', d.lastRentAt)
  }
  // Buff.
  const b = d.buff
  if (b.phase === 'planned' && b.startsAt !== null && now >= b.startsAt) {
    if (b.rsvp.length >= d.settings.buffMinRsvp) {
      b.phase = 'active'
      b.endsAt = b.startsAt + BUFF_HOURS * HOURS
      b.lastBonus = 0
      alert(d, 'buff', 'started', undefined, b.startsAt)
    } else {
      income(d, 'refund', d.settings.buffPrice, null, 'buff', b.startsAt)
      alert(d, 'buff', 'cancelled', undefined, b.startsAt)
      b.phase = 'idle'
      b.startsAt = b.endsAt = null
      b.rsvp = []
    }
  }
  if (b.phase === 'active' && b.endsAt !== null && now >= b.endsAt) {
    alert(d, 'buff', `ended:${b.lastBonus}`, undefined, b.endsAt)
    b.phase = 'cooldown'
    b.cooldownUntil = b.endsAt + d.settings.buffCooldownHours * HOURS
  }
  if (b.phase === 'cooldown' && b.cooldownUntil !== null && now >= b.cooldownUntil) {
    b.phase = 'idle'
    b.startsAt = b.endsAt = b.cooldownUntil = null
    b.rsvp = []
  }
  // The headquarters under siege.
  if (d.hq.siege && now >= d.hq.siege.endsAt && d.hq.sectorId) {
    const lost = d.sectors.find((x) => x.id === d.hq.sectorId)
    if (lost) {
      lost.owner = 'enemy'
      lost.hq = null
      lost.skin = null
      lost.shield = false
      lost.defense = 1
    }
    alert(d, 'hq_fallen', d.hq.sectorId, d.hq.sectorId, d.hq.siege.endsAt)
    d.hq = { sectorId: null, placedAt: null, lastMoveAt: d.hq.lastMoveAt, siege: null }
  }
  // Bounties that ran out give the reward back to the treasury.
  for (const bn of d.bounties) {
    if (!bn.claimedBy && now >= bn.expiresAt && bn.reward > 0) {
      income(d, 'refund', bn.reward, null, 'bounty', bn.expiresAt)
      bn.reward = 0
    }
  }
  d.bounties = d.bounties.filter((bn) => bn.reward > 0 || bn.claimedBy)
}

// Called by the screens once a second; commits only if something happened.
export function tick() {
  load()
  const draft = structuredClone(state) as DemoState
  const before = JSON.stringify({ r: draft.lastRentAt, b: draft.buff, h: draft.hq, n: draft.bounties.length })
  runTime(draft)
  const after = JSON.stringify({ r: draft.lastRentAt, b: draft.buff, h: draft.hq, n: draft.bounties.length })
  if (before !== after) commit(draft)
}

export function advanceTime(ms: number): Result {
  return mutate((d) => {
    d.clockOffsetMs += ms
    for (const m of d.members) if (m.lastCatchMin !== null) m.lastCatchMin += Math.round(ms / 60_000)
    runTime(d)
  })
}

// ───────────── the world ─────────────

export function resetDemo(): Result {
  commit(initialDemoState())
  return OK
}

export function setPersona(p: Persona): Result {
  return mutate((d) => {
    d.persona = p
    d.myId = p === 'member' ? 'm5' : p === 'solo' ? 'none' : 'm1'
  })
}

export function joinDemoClan(): Result {
  return mutate((d) => {
    d.persona = 'member'
    d.myId = 'm5'
    alert(d, 'recruit', 'joined')
  })
}

export function markAlertsRead(): Result {
  return mutate((d) => {
    d.alerts.forEach((a) => (a.read = true))
  })
}

export function markTourSeen(audience: 'player' | 'admin', seen = true): Result {
  return mutate((d) => {
    d.toursSeen[audience] = seen
  })
}

// ───────────── the treasury ─────────────

export function deposit(amount: number): Result {
  return mutate((d) => {
    const me = d.members.find((m) => m.id === d.myId)
    if (!me) return no('notMember')
    if (!Number.isFinite(amount) || amount < 10) return no('minDeposit')
    if (d.wallet < amount) return no('wallet')
    if (d.treasury.balance >= capOf(d)) return no('full')
    d.wallet -= amount
    const added = income(d, 'deposit', amount, me.id, '')
    // What did not fit goes back to the wallet.
    d.wallet += amount - added
    me.weekDeposit += added
  })
}

export function setTaxRate(rate: number): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (rate < 0 || rate > d.settings.taxMax) return no('badRate')
    d.treasury.taxRate = rate
  })
}

export function setGoal(id: string | null): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    d.treasury.goalId = id
  })
}

export function buyGoal(): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    const goal = goalOf(d)
    if (!goal) return no('noGoal')
    if (d.treasury.balance < goal.cost) return no('notEnough')
    if (!spend(d, goal.kind === 'clan_skin' ? 'spend_skin' : 'spend_goal', goal.cost, d.myId, goal.id)) return no('notEnough')
    // skin_clan_tide → clan_tide; the boat and the banner keep their ids.
    const owned = goal.id.replace(/^skin_/, '')
    if (!d.owned.includes(owned)) d.owned.push(owned)
    if (goal.kind === 'clan_skin') {
      d.equippedSkin = owned
      for (const s of d.sectors) if (s.owner === 'mine') s.skin = owned
    }
    d.treasury.goalId = null
    alert(d, 'project_done', goal.id)
  })
}

export function equipSkin(id: string | null): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (id && !d.owned.includes(id)) return no('notOwned')
    d.equippedSkin = id
    for (const s of d.sectors) if (s.owner === 'mine') s.skin = id
  })
}

export function upgradeProject(id: ProjectId): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    const level = d.projects[id]
    if (level >= 3) return no('maxLevel')
    const cost = PROJECTS[id].costs[level as 0 | 1 | 2]
    if (!spend(d, 'spend_project', cost, d.myId, `${id}:${level + 1}`)) return no('notEnough')
    d.projects[id] = (level + 1) as 1 | 2 | 3
    alert(d, 'project_done', `${id}:${level + 1}`)
  })
}

export function buyOffer(id: string): Result {
  return mutate((d) => {
    if (!isLeader(d)) return no('notLeader')
    const o = d.offers.find((x) => x.id === id)
    if (!o || o.owned) return no('notEnough')
    if (!spend(d, 'spend_goal', o.cost, d.myId, `offer:${o.id}`)) return no('notEnough')
    o.owned = true
  })
}

export function claimQuest(): Result {
  return mutate((d) => {
    const q = d.quest
    if (q.claimed || q.progress < q.target) return no('questOpen')
    q.claimed = true
    income(d, 'quest', q.reward, null, q.kind)
    alert(d, 'quest_done', q.kind)
  })
}

// ───────────── the buff «Выход» ─────────────

export function planBuff(inMinutes: number): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (d.buff.phase !== 'idle') return no(d.buff.phase === 'cooldown' ? 'buffCooldown' : 'buffBusy')
    if (!spend(d, 'spend_buff', d.settings.buffPrice, d.myId, 'buff')) return no('notEnough')
    const at = nowOf(d) + inMinutes * 60_000
    d.buff = { phase: 'planned', startsAt: at, endsAt: null, cooldownUntil: null, rsvp: [d.myId], startedBy: d.myId, lastBonus: 0 }
    alert(d, 'buff', `planned:${memberName(d, d.myId)}`)
    if (inMinutes === 0) runTime(d)
  })
}

export function rsvpBuff(on: boolean): Result {
  return mutate((d) => {
    if (d.buff.phase !== 'planned' && d.buff.phase !== 'active') return no('buffNone')
    if (!d.members.some((m) => m.id === d.myId)) return no('notMember')
    const has = d.buff.rsvp.includes(d.myId)
    if (on && !has) d.buff.rsvp.push(d.myId)
    if (!on && has) d.buff.rsvp = d.buff.rsvp.filter((x) => x !== d.myId)
  })
}

// The demo panel: the others say «иду».
export function othersRsvp(count: number): Result {
  return mutate((d) => {
    if (d.buff.phase !== 'planned') return no('buffNone')
    for (const m of d.members) {
      if (d.buff.rsvp.length >= 1 + count) break
      if (!d.buff.rsvp.includes(m.id)) d.buff.rsvp.push(m.id)
    }
  })
}

export const buffActive = (s: DemoState) => s.buff.phase === 'active'

// ───────────── the headquarters ─────────────

export function placeHq(sectorId: string): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    const target = d.sectors.find((x) => x.id === sectorId)
    if (!target || target.owner !== 'mine') return no('hqNotMine')
    if (target.hq) return no('hqTaken')
    const moving = !!d.hq.sectorId
    if (moving) {
      const since = nowOf(d) - (d.hq.lastMoveAt ?? d.hq.placedAt ?? 0)
      if (since < HQ_MOVE_COOLDOWN_DAYS * DAY) return no('hqCooldown')
    }
    const cost = moving ? d.settings.hqMoveCost : d.settings.hqPlaceCost
    if (!spend(d, 'spend_hq', cost, d.myId, moving ? 'move' : 'place')) return no('notEnough')
    const old = d.sectors.find((x) => x.id === d.hq.sectorId)
    if (old) old.hq = null
    target.hq = 'mine'
    d.hq = { sectorId, placedAt: nowOf(d), lastMoveAt: moving ? nowOf(d) : d.hq.lastMoveAt, siege: null }
  })
}

// An outsider catches on the headquarters sector. Defence runs down first; with none left the next catch starts a siege.
export function attackHq(): Result {
  return mutate((d) => {
    const sector = d.sectors.find((x) => x.id === d.hq.sectorId)
    if (!sector) return no('hqNone')
    if (d.hq.siege) return no('hqSiege')
    if (sector.defense > 0) {
      sector.defense -= 1
      alert(d, 'sector_attack', `hq:${sector.defense}`, sector.id)
    } else {
      const now = nowOf(d)
      d.hq.siege = { by: 'Fish-hook', startedAt: now, endsAt: now + SIEGE_MINUTES * 60_000 }
      alert(d, 'hq_siege', 'Fish-hook', sector.id)
    }
  })
}

// A clan-mate catches on the headquarters sector: it breaks a siege, or at least builds defence back up.
export function defendHq(): Result {
  return mutate((d) => {
    const sector = d.sectors.find((x) => x.id === d.hq.sectorId)
    if (!sector) return no('hqNone')
    const me = d.members.find((m) => m.id === d.myId) ?? d.members[0]
    if (d.hq.siege) {
      d.hq.siege = null
      sector.defense = 1
      alert(d, 'hq_saved', me.name, sector.id)
      if (d.persona !== 'solo') d.wallet += SIEGE_BREAK_REWARD
      return { ok: true, info: 'siegeBroken' }
    }
    sector.defense = Math.min(4, sector.defense + 1)
    return { ok: true, info: 'defence' }
  })
}

export function attackSector(): Result {
  return mutate((d) => {
    const mine = d.sectors.filter((x) => x.owner === 'mine' && x.hq !== 'mine')
    const target = mine[Math.floor(Math.random() * mine.length)]
    if (!target) return no('hqNone')
    target.defense = Math.max(0, target.defense - 1)
    alert(d, 'sector_attack', `${target.id}:${target.defense}`, target.id)
  })
}

export function toggleHot(sectorId: string): Result {
  return mutate((d) => {
    const s = d.sectors.find((x) => x.id === sectorId)
    if (s) s.hot = !s.hot
  })
}

// ───────────── bounties, nudges, members ─────────────

export function createBounty(input: { kind: Bounty['kind']; species?: string; minCm?: number; reward: number }): Result {
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (d.bounties.filter((b) => !b.claimedBy).length >= BOUNTY_MAX_ACTIVE) return no('bountyMax')
    if (input.reward < 20 || input.reward > BOUNTY_DAILY_CAP) return no('bountyReward')
    if (input.reward > Math.floor(d.treasury.balance * BOUNTY_MAX_SHARE)) return no('bountyShare')
    if (!spend(d, 'spend_bounty', input.reward, d.myId, `${input.kind}`)) return no('notEnough')
    d.bounties.push({
      id: ++d.seq,
      kind: input.kind,
      species: input.species,
      minCm: input.minCm,
      reward: input.reward,
      createdBy: d.myId,
      claimedBy: null,
      expiresAt: nowOf(d) + 3 * DAY,
    })
  })
}

export function nudge(memberId: string): Result {
  return mutate((d) => {
    const me = meOf(d)
    if (!me || me.role === 'member') return no('notManager')
    const last = d.nudgedAt[memberId] ?? 0
    if (nowOf(d) - last < DAY) return no('nudgeOnce')
    d.nudgedAt[memberId] = nowOf(d)
    alert(d, 'nudge', memberName(d, memberId))
  })
}

export function transferLeadership(toId: string): Result {
  return mutate((d) => {
    if (!isLeader(d)) return no('notLeader')
    const to = d.members.find((m) => m.id === toId)
    const me = meOf(d)
    if (!to || !me) return no('notMember')
    me.role = 'co_leader'
    to.role = 'leader'
    d.myId = me.id
    alert(d, 'nudge', `leader:${to.name}`)
  })
}

// Demo: the leader has been away for two weeks; the co-leader takes over by himself.
export function leaderAway(): Result {
  return mutate((d) => {
    const leader = d.members.find((m) => m.role === 'leader')
    const co = d.members.find((m) => m.role === 'co_leader')
    if (!leader || !co) return no('notMember')
    leader.role = 'member'
    leader.lastCatchMin = 15 * 24 * 60
    co.role = 'leader'
    alert(d, 'nudge', `autoleader:${co.name}`)
  })
}

export function recruitCatch(): Result {
  return mutate((d) => {
    const r = d.recruit.find((x) => x.state === 'caught') ?? d.recruit.find((x) => x.state === 'joined')
    if (!r) return no('recruitNone')
    if (r.state === 'joined') {
      r.state = 'caught'
      return { ok: true, info: 'caught' }
    }
    r.state = 'paid'
    income(d, 'recruit', d.settings.recruitReward, null, r.name)
    alert(d, 'recruit', `paid:${r.name}`)
    return { ok: true, info: 'paid' }
  })
}

// ───────────── simulation: a catch ─────────────

const SPECIES = [
  { key: 'stavrida', coins: 5, cm: [14, 24], w: 30 },
  { key: 'skorpena', coins: 10, cm: [18, 32], w: 22 },
  { key: 'kefal', coins: 20, cm: [30, 50], w: 18 },
  { key: 'lufar', coins: 25, cm: [40, 66], w: 12 },
  { key: 'zubar', coins: 75, cm: [35, 60], w: 8 },
  { key: 'sibas', coins: 100, cm: [40, 62], w: 6 },
  { key: 'katran', coins: 150, cm: [60, 95], w: 4 },
]

export type CatchSummary = { member: string; species: string; cm: number; coins: number; tax: number; hot: boolean; buff: boolean; bounty: number; record: boolean }

export function simulateCatch(opts: { memberId?: string; species?: string } = {}): Result & { summary?: CatchSummary } {
  let summary: CatchSummary | undefined
  const res = mutate((d) => {
    if (!d.settings.enabled) return no('disabled')
    const members = d.members.filter((m) => m.role !== undefined)
    const member = members.find((m) => m.id === (opts.memberId ?? '')) ?? (d.persona === 'solo' ? members[1] : members.find((m) => m.id === d.myId)) ?? members[0]
    const total = SPECIES.reduce((n, s) => n + s.w, 0)
    let pick = Math.random() * total
    const sp = SPECIES.find((s) => opts.species === s.key) ?? SPECIES.find((s) => (pick -= s.w) < 0) ?? SPECIES[0]
    const cm = Math.round(sp.cm[0] + Math.random() * (sp.cm[1] - sp.cm[0]))
    const sector = d.sectors.filter((x) => x.owner === 'mine')[Math.floor(Math.random() * 9)] ?? d.sectors[0]
    const buffOn = d.buff.phase === 'active' && d.buff.rsvp.includes(member.id)
    const mult = coinMultiplier(sector.hot, buffOn)
    const coins = sp.coins * mult
    const tax = taxOf(coins, d.treasury.taxRate)
    const taken = tax > 0 ? income(d, 'tax', tax, member.id, sp.key) : 0
    if (member.id === d.myId) d.wallet += coins - taken
    member.weekDeposit += taken
    member.weekMeters += Math.round(10 * (buffOn ? BUFF_METER_FACTOR : 1))
    member.lastCatchMin = 0
    if (buffOn) d.buff.lastBonus += sp.coins * (mult - coinMultiplier(sector.hot, false))
    // The weekly quest.
    const q = d.quest
    if (!q.claimed && q.progress < q.target) {
      if (q.kind === 'catches') q.progress += 1
      else if (q.kind === 'species' && !d.questSeen.includes(sp.key)) {
        d.questSeen.push(sp.key)
        q.progress += 1
      } else if (q.kind === 'rare' && sp.coins >= 50) q.progress += 1
    }
    // The tournament: the species of the week counts for the clan.
    if (sp.key === d.tournament.species) {
      const mine = d.tournament.standings.find((x) => x.mine)
      if (mine) mine.score += 1
    }
    // A bounty somebody posted.
    let bounty = 0
    for (const b of d.bounties) {
      if (b.claimedBy || b.reward <= 0) continue
      const hit = (b.kind === 'species' && b.species === sp.key) || (b.kind === 'size' && (b.minCm ?? 0) <= cm)
      if (hit) {
        b.claimedBy = member.id
        bounty = b.reward
        if (member.id === d.myId) d.wallet += b.reward
        alert(d, 'bounty', `${member.name}:${b.reward}`)
        break
      }
    }
    // The hall of fame: a bigger fish of the species.
    const rec = d.hall.find((h) => h.species === sp.key)
    const kg = Math.round(Math.pow(cm / 20, 3) * 0.12 * 10) / 10
    let record = false
    if (!rec || cm > rec.cm) {
      record = true
      const entry = { species: sp.key, member: member.name, cm, kg, at: nowOf(d), hue: member.hue }
      if (rec) Object.assign(rec, entry)
      else d.hall.push(entry)
    }
    d.clan.xp += 2
    summary = { member: member.name, species: sp.key, cm, coins, tax: taken, hot: sector.hot, buff: buffOn, bounty, record }
  })
  return res.ok ? { ok: true, summary } : res
}

// The weekly settlement: a share of the chest and the battle goes to the treasury.
export function settleWeek(): Result {
  return mutate((d) => {
    const chest = 96 + Math.round(Math.random() * 60)
    const race = 60 + Math.round(Math.random() * 80)
    const share = (n: number) => Math.floor((n * d.settings.chestShare) / 100)
    income(d, 'chest_share', share(chest * 9), null, 'chest')
    income(d, 'race_share', share(race * 9), null, 'race')
    const target = questTarget(d.quest.kind, activeMembers(d))
    d.quest = { ...d.quest, progress: 0, claimed: false, target, endsAt: nowOf(d) + 7 * DAY }
    d.questSeen = []
  })
}

// ───────────── the admin ─────────────

export function updateSettings(patch: Partial<EconomySettings>): Result {
  return mutate((d) => {
    if (d.persona !== 'admin') return no('notAdmin')
    d.settings = { ...d.settings, ...patch }
  })
}

export function reverseEntry(entryId: number): Result {
  return mutate((d) => {
    if (d.persona !== 'admin') return no('notAdmin')
    const e = d.treasury.entries.find((x) => x.id === entryId)
    if (!e || e.note.startsWith('reversed')) return no('badEntry')
    d.treasury.balance = Math.max(0, d.treasury.balance - e.amount)
    push(d, e.amount > 0 ? 'spend_goal' : 'refund', -e.amount, null, `reversed:${e.id}`)
    e.note = `reversed:${e.note}`
  })
}

export const SKIN_IDS = CLAN_SKINS.map((s) => s.id)
export type { MapSector }
