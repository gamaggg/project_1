'use client'

import { useSyncExternalStore } from 'react'
import { initialDemoState } from '@/lib/clan2/demoData'
import { clanLevel } from '@/lib/data/clanLevels'
import {
  BUILD_CLAN_LEVEL,
  BUILD_HOURS,
  speedupCost,
  BUFF_HOURS,
  BUFF_METER_FACTOR,
  CLAN_SKINS,
  DAY,
  DEFENSE_MAX,
  HOURS,
  HQ_LOOT_MAX,
  HQ_LOOT_SHARE,
  HQ_MOVE_COOLDOWN_DAYS,
  HQ_RUINS_HOURS,
  PROJECTS,
  PROJECT_EFFECTS,
  SIEGE_BREAK_REWARD,
  SIEGE_MINUTES,
  TAX_RATES,
  coinMultiplier,
  dailyRent,
  intake,
  BIG_FISH_CM,
  RARE_COINS,
  makeQuest,
  pickQuestKind,
  questReward,
  taxOf,
  weekEndOf,
  weekKeyOf,
  treasuryCap,
  monthKeyOf,
  shopItem,
  skinIdOf,
} from '@/lib/clan2/rules'
import type { ClanAlert, ClanRole, DemoMember, DemoState, EconomySettings, GoalItem, MapSector, Persona, ProjectId, ProjectLevel, TreasuryEntry, TreasuryKind } from '@/lib/clan2/types'
import { applyServerClan, callServer, readServerClan } from '@/lib/clan2/live/server'

// The demo's whole world: one state object, changed only by the actions
// below, kept in localStorage so a reload (or a day later) finds it as it
// was. «Ускорить время» shifts the demo clock instead of waiting for hours.
// Every action returns `ok` or the key of the reason it refused (clan2.err.*),
// which the screens show as a toast.

export type Result = { ok: true; info?: string } | { ok: false; reason: string }
const OK: Result = { ok: true }
const no = (reason: string): Result => ({ ok: false, reason })

const KEY = 'range:clan2-demo:v6'
// Where the state is kept: the demo's own key, or — bound to a real clan — a key of that player and clan.
let storageKey = KEY

let state: DemoState = initialDemoState()
let loaded = false
const listeners = new Set<() => void>()

// A save from an older build: the fields added since get their starting values, so no screen meets a hole.
function upgrade(d: DemoState): DemoState {
  d.equipped ??= { boat: null, frame: null }
  d.deposits ??= { month: monthKeyOf(Date.now() + (d.clockOffsetMs ?? 0)), byMember: {} }
  // Items of an older shop (the four clan-only skins, the banners) are no longer sold: they drop out.
  d.owned = (d.owned ?? []).filter((id) => !!shopItem(id))
  if (d.equippedSkin && !shopItem(d.equippedSkin)) d.equippedSkin = null
  if (d.treasury.goalId && !shopItem(d.treasury.goalId)) d.treasury.goalId = null
  return d
}

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) state = upgrade(JSON.parse(raw) as DemoState)
  } catch {
    // A broken save is just the starting world.
  }
}

function commit(next: DemoState) {
  state = next
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {}
  listeners.forEach((l) => l())
}

// The state of /clan-preview (fictional clan).
export function bindDemo() {
  if (storageKey === KEY && loaded) return
  storageKey = KEY
  loaded = false
  state = initialDemoState()
  load()
  listeners.forEach((l) => l())
}

// The state of the real clan: read back from this browser if it is there, otherwise built by `make`.
// `sync` then brings the parts that are real (sectors, members) up to date, on every call.
export function bindLive(key: string, make: () => DemoState, sync: (d: DemoState) => void) {
  if (storageKey !== key || !loaded) {
    storageKey = key
    loaded = true
    try {
      const raw = window.localStorage.getItem(key)
      state = raw ? upgrade(JSON.parse(raw) as DemoState) : make()
    } catch {
      state = make()
    }
    if (!state.live) state = make()
    listeners.forEach((l) => l())
  }
  const draft = structuredClone(state) as DemoState
  const before = JSON.stringify(draft)
  sync(draft)
  if (JSON.stringify(draft) !== before) commit(draft)
}

export function resetLive(make: () => DemoState) {
  commit(make())
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
// ───────────── the server (supabase-drafts/clan-update-06-11) ─────────────
// Bound to a real clan whose functions answer, the store mirrors the server: every action is the server's function
// (its refusal comes back as a toast through onServerReply), and the state is read again after it and every 30 s.
// Until the functions are in the database, nothing here is used and the preview keeps its browser-only world.
let server: { clanId: number; userId: string } | null = null
const replyListeners = new Set<(r: Result) => void>()
export const serverOn = () => !!server
export function onServerReply(fn: (r: Result) => void): () => void {
  replyListeners.add(fn)
  return () => {
    replyListeners.delete(fn)
  }
}
// Reads the clan from the server; true when it answered (the store now mirrors it).
export async function refreshFromServer(clanId: number, userId: string): Promise<boolean> {
  const r = await readServerClan(clanId, userId)
  if (!r.ok) {
    if (r.missing) server = null
    return false
  }
  server = { clanId, userId }
  load()
  const draft = structuredClone(state) as DemoState
  applyServerClan(draft, r.data, r.alerts)
  // The wallet is the player's real coins, not the copy saved in the browser at the first visit.
  if (r.coins != null) draft.wallet = r.coins
  commit(draft)
  return true
}
function srv(fn: string, args: Record<string, unknown>): Result {
  const bound = server
  if (!bound) return no('network')
  void callServer(fn, args).then(async (res) => {
    if (!res.ok) replyListeners.forEach((l) => l(no(res.reason)))
    await refreshFromServer(bound.clanId, bound.userId)
  })
  return OK
}

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
// The buildings work only while the headquarters stands.
export const buildingsOn = (s: DemoState) => !!s.hq.sectorId
export const levelOf = (s: DemoState, id: ProjectId): ProjectLevel => (buildingsOn(s) ? s.projects[id] : 0)
export const capOf = (s: DemoState) => treasuryCap(s.clan.level, levelOf(s, 'storage'))
export const siegeMinutesOf = (s: DemoState) => SIEGE_MINUTES + PROJECT_EFFECTS.beacon.siegeMinutes[levelOf(s, 'beacon')]
export const extraSlotsOf = (s: DemoState) => PROJECT_EFFECTS.dock.slots[levelOf(s, 'dock')]
export const goalOf = (s: DemoState) => shopItem(s.treasury.goalId)
// What a member put into the treasury this month (0 once the month has turned and nothing came in yet).
export const monthDepositOf = (s: DemoState, memberId: string) => (s.deposits?.month === monthKeyOf(nowOf(s)) ? (s.deposits.byMember[memberId] ?? 0) : 0)
// Is the item owned (a clan skin also by its old id)?
export const ownsItem = (s: DemoState, id: string) => s.owned.includes(id)

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
  return dailyRent(s.settings, c.plain + (c.hq ? 1 : 0), c.shared, c.hq, levelOf(s, 'market')) + Math.round(hot * s.settings.rentPerSectorDay * 2)
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

// A member's coins that came into the treasury: counted for the month (the column in the members list).
function credit(d: DemoState, memberId: string, amount: number) {
  if (amount <= 0) return
  const month = monthKeyOf(nowOf(d))
  if (d.deposits.month !== month) d.deposits = { month, byMember: {} }
  d.deposits.byMember[memberId] = (d.deposits.byMember[memberId] ?? 0) + amount
}

// The headquarters falls: the attackers carry off part of the treasury, the sector is theirs, the clan has ruins and no HQ for a day.
export function fallHq(d: DemoState, by: string, fellAt: number) {
  const sectorId = d.hq.sectorId
  if (!sectorId) return
  const lost = d.sectors.find((x) => x.id === sectorId)
  const loot = Math.min(HQ_LOOT_MAX, Math.floor(d.treasury.balance * HQ_LOOT_SHARE))
  if (loot > 0) {
    d.treasury.balance -= loot
    push(d, 'looted', -loot, null, by, fellAt)
  }
  if (lost) {
    lost.owner = 'enemy'
    lost.hq = null
    lost.skin = null
    lost.shield = false
    lost.defense = 1
  }
  alert(d, 'hq_fallen', `${sectorId}:${loot}`, sectorId, fellAt)
  d.hq = {
    sectorId: null,
    placedAt: null,
    lastMoveAt: d.hq.lastMoveAt,
    siege: null,
    defenseAt: null,
    ruins: { sectorId, by, loot, fellAt, until: fellAt + HQ_RUINS_HOURS * HOURS },
    // The first new HQ after a fall is free, once.
    freeRebuild: !d.hq.freeRebuildUsed,
    freeRebuildUsed: d.hq.freeRebuildUsed,
  }
}

// The task of the next week: a random kind, never the same as this one's.
function nextQuest(d: DemoState) {
  const now = nowOf(d)
  let salt = d.seq
  let kind = pickQuestKind(d.live?.clanId ?? 7, weekKeyOf(now) + salt)
  while (kind === d.quest.kind && salt < d.seq + 20) kind = pickQuestKind(d.live?.clanId ?? 7, weekKeyOf(now) + ++salt)
  d.seq = salt + 1
  return makeQuest(kind, activeMembers(d), d.members.length, levelOf(d, 'board'), d.live ? weekEndOf(now) : now + 7 * DAY)
}

// ───────────── time ─────────────

function runTime(d: DemoState) {
  const now = nowOf(d)
  // A new month: everybody's «взнос за месяц» starts from nothing.
  if (d.deposits.month !== monthKeyOf(now)) d.deposits = { month: monthKeyOf(now), byMember: {} }
  // Rent: one entry per whole day.
  while (now - d.lastRentAt >= DAY) {
    d.lastRentAt += DAY
    const amount = rentPerDay(d)
    if (amount > 0) income(d, 'rent', amount, null, 'rent', d.lastRentAt)
  }
  // Live mode: a new week brings a new task (the kind comes from the clan and the week, so every member sees the same one).
  if (d.live && now >= d.quest.endsAt) {
    d.quest = makeQuest(pickQuestKind(d.live.clanId, weekKeyOf(now)), activeMembers(d), d.members.length, levelOf(d, 'board'), weekEndOf(now))
    d.questSeen = []
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
  // The defence of the HQ sector wears down on its own, slower with «Крепость».
  if (d.hq.sectorId && d.hq.defenseAt !== null) {
    const hqSector = d.sectors.find((x) => x.id === d.hq.sectorId)
    const every = PROJECT_EFFECTS.fort.decayDays[levelOf(d, 'fort')] * DAY
    while (hqSector && hqSector.defense > 0 && now - d.hq.defenseAt >= every) {
      d.hq.defenseAt += every
      hqSector.defense -= 1
    }
    if (hqSector && hqSector.defense === 0) d.hq.defenseAt = now
  }
  // The headquarters under siege: not broken in time, it falls.
  if (d.hq.siege && now >= d.hq.siege.endsAt && d.hq.sectorId) fallHq(d, d.hq.siege.by, d.hq.siege.endsAt)
  // A building under construction is ready.
  if (d.build && now >= d.build.endsAt) {
    const done = d.build
    d.projects[done.id] = done.toLevel
    alert(d, 'project_done', `${done.id}:${done.toLevel}`, undefined, done.endsAt)
    d.build = null
  }
}

// Called by the screens once a second; commits only if something happened.
export function tick() {
  // The server keeps the time itself (rent, sieges, builds): the store only waits for the next read.
  if (server) return
  load()
  const draft = structuredClone(state) as DemoState
  const before = JSON.stringify({ r: draft.lastRentAt, b: draft.buff, h: draft.hq, n: draft.build, d: draft.sectors.map((x) => x.defense), m: draft.deposits.month, q: draft.quest.endsAt })
  runTime(draft)
  const after = JSON.stringify({ r: draft.lastRentAt, b: draft.buff, h: draft.hq, n: draft.build, d: draft.sectors.map((x) => x.defense), m: draft.deposits.month, q: draft.quest.endsAt })
  if (before !== after) commit(draft)
}

export function advanceTime(ms: number): Result {
  if (server) return no('serverGame')
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

// Live mode: look at the screens as the leader, as a plain member, or as the admin — or as the player really is.
export function setViewAs(role: ClanRole | 'admin' | null): Result {
  return mutate((d) => {
    if (!d.live) return no('notLive')
    const me = d.members.find((m) => m.id === d.myId)
    if (role === 'admin') {
      if (!d.live.isSuperAdmin) return no('notAdmin')
      d.persona = 'admin'
      return
    }
    d.live.viewAs = role
    const r = role ?? d.live.realRole
    if (me) me.role = r
    d.persona = r === 'leader' || r === 'co_leader' ? 'leader' : 'member'
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
  if (server) return srv('clan_treasury_donate', { p_amount: amount })
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
    credit(d, me.id, added)
  })
}

export function setTaxRate(rate: number): Result {
  if (server) return srv('clan_set_tax', { p_rate: rate })
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (!TAX_RATES.includes(rate as 0 | 5 | 10) || rate > d.settings.taxMax) return no('badRate')
    d.treasury.taxRate = rate
  })
}

// The treasury's goal: any item of the shop the clan does not own yet (the whole clan sees it on the treasury's card).
export function setGoal(id: string | null): Result {
  if (server) return srv('clan_set_goal', { p_goal: id })
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (id === null) {
      d.treasury.goalId = null
      return
    }
    const wanted = shopItem(id)
    if (!wanted) return no('noGoal')
    if (d.owned.includes(wanted.id)) return no('owned')
    d.treasury.goalId = wanted.id
  })
}

// Puts an owned item on (or takes the kind off with null).
function wear(d: DemoState, kind: GoalItem['kind'], id: string | null) {
  if (kind === 'clan_skin') {
    const skin = id ? skinIdOf(id) : null
    d.equippedSkin = skin
    for (const s of d.sectors) if (s.owner === 'mine') s.skin = skin
  } else d.equipped[kind] = id
}

// Buys an item of the shop from the treasury: the leader or a co-leader, the clan's level, enough coins. The item is
// put on at once, and if it was the goal, the goal is done.
export function buyItem(id: string): Result {
  if (server) return srv('clan_shop_buy', { p_item: id })
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    const item = shopItem(id)
    if (!item) return no('noGoal')
    if (d.owned.includes(item.id)) return no('owned')
    if (d.clan.level < item.minLevel) return no('levelLow')
    if (d.treasury.balance < item.cost) return no('notEnough')
    if (d.hq.siege) return no('siegeLock')
    if (!spend(d, item.kind === 'clan_skin' ? 'spend_skin' : 'spend_goal', item.cost, d.myId, item.id)) return no('notEnough')
    d.owned.push(item.id)
    wear(d, item.kind, item.id)
    if (d.treasury.goalId === item.id) d.treasury.goalId = null
    alert(d, 'project_done', item.id)
  })
}

export function buyGoal(): Result {
  const goal = goalOf(getDemoState())
  return goal ? buyItem(goal.id) : no('noGoal')
}

// Puts on an item the clan owns, or (null) takes that kind off.
export function equipItem(kind: GoalItem['kind'], id: string | null): Result {
  if (server) return srv('clan_shop_equip', { p_kind: kind, p_item: id })
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (id && !d.owned.includes(id)) return no('notOwned')
    wear(d, kind, id)
  })
}

// The old call: a sector skin by its id.
export function equipSkin(id: string | null): Result {
  return equipItem('clan_skin', id)
}

// Starts building the next level: paid at once, ready after BUILD_HOURS, one building at a time, and only
// while an HQ stands and the clan is of the level that opens it.
export function upgradeProject(id: ProjectId): Result {
  if (server) return srv('clan_upgrade_project', { p_id: id })
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (!buildingsOn(d)) return no('noHqBuild')
    if (d.build) return no('buildBusy')
    const level = d.projects[id]
    if (level >= 3) return no('maxLevel')
    if (d.clan.level < BUILD_CLAN_LEVEL[level as 0 | 1 | 2]) return no('levelLow')
    const cost = PROJECTS[id].costs[level as 0 | 1 | 2]
    if (d.hq.siege) return no('siegeLock')
    if (!spend(d, 'spend_project', cost, d.myId, `${id}:${level + 1}`)) return no('notEnough')
    const now = nowOf(d)
    d.build = { id, toLevel: (level + 1) as 1 | 2 | 3, startedAt: now, endsAt: now + BUILD_HOURS[id][level as 0 | 1 | 2] * HOURS }
  })
}

// Pays to finish the building at once: the price is by the hours left.
export const speedupPrice = (d: DemoState): number => {
  if (!d.build) return 0
  const cost = PROJECTS[d.build.id].costs[d.build.toLevel - 1]
  return speedupCost(d.settings, cost, d.build.startedAt, d.build.endsAt, nowOf(d))
}

export function speedUpBuild(): Result {
  if (server) return srv('clan_speedup_build', {})
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (!d.build) return no('buildNone')
    const cost = speedupPrice(d)
    if (d.hq.siege) return no('siegeLock')
    if (!spend(d, 'spend_project', cost, d.myId, `speedup:${d.build.id}:${d.build.toLevel}`)) return no('notEnough')
    d.build.endsAt = nowOf(d)
    runTime(d)
    return { ok: true, info: 'sped' }
  })
}

export function claimQuest(): Result {
  if (server) return srv('clan_quest_claim', {})
  return mutate((d) => {
    const q = d.quest
    if (q.claimed || q.progress < q.target) return no('questOpen')
    if (!canManage(d)) return no('notManager')
    q.claimed = true
    q.claimedBy = d.myId
    q.claimedAt = nowOf(d)
    q.reward = questReward(q.kind, levelOf(d, 'board'))
    income(d, 'quest', q.reward, d.myId, `${q.kind}:${q.target}`)
    alert(d, 'quest_done', q.kind)
  })
}

// ───────────── the buff «Выход» ─────────────

export function planBuff(inMinutes: number): Result {
  if (server) return srv('clan_buff_launch', { p_start_in_minutes: Math.max(5, inMinutes) })
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    if (d.buff.phase !== 'idle') return no(d.buff.phase === 'cooldown' ? 'buffCooldown' : 'buffBusy')
    if (d.hq.siege) return no('siegeLock')
    if (!spend(d, 'spend_buff', d.settings.buffPrice, d.myId, 'buff')) return no('notEnough')
    const at = nowOf(d) + inMinutes * 60_000
    d.buff = { phase: 'planned', startsAt: at, endsAt: null, cooldownUntil: null, rsvp: [d.myId], startedBy: d.myId, lastBonus: 0 }
    alert(d, 'buff', `planned:${memberName(d, d.myId)}`)
    if (inMinutes === 0) runTime(d)
  })
}

export function rsvpBuff(on: boolean): Result {
  if (server) return state.buffId ? srv('clan_buff_rsvp', { p_buff_id: state.buffId, p_going: on }) : no('buffNone')
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
  if (server) return no('serverGame')
  return mutate((d) => {
    if (d.buff.phase !== 'planned') return no('buffNone')
    for (const m of d.members) {
      if (d.buff.rsvp.length >= 1 + count) break
      if (!d.buff.rsvp.includes(m.id)) d.buff.rsvp.push(m.id)
    }
  })
}

export const buffActive = (s: DemoState) => s.buff.phase === 'active'

// While the HQ is under siege the treasury is shut: nothing is bought, built, sped up, launched or moved with it
// (coins still come in). The server refuses the same (CLAN:siege_lock, supabase-drafts/clan-siege-lock-13-11).
export const siegeLocked = (s: DemoState) => !!s.hq.siege

// What setting the HQ costs now: a move, a placing, or nothing — the first new HQ after a fall is free, once.
export const hqFreeRebuild = (s: DemoState) => !s.hq.sectorId && !!s.hq.freeRebuild
export const hqPlaceCostOf = (s: DemoState) => (s.hq.sectorId ? s.settings.hqMoveCost : hqFreeRebuild(s) ? 0 : s.settings.hqPlaceCost)

// ───────────── the headquarters ─────────────

export function placeHq(sectorId: string): Result {
  if (server) return srv('clan_hq_place', { p_territory_id: sectorId })
  return mutate((d) => {
    if (!canManage(d)) return no('notManager')
    const target = d.sectors.find((x) => x.id === sectorId)
    if (!target || target.owner !== 'mine') return no('hqNotMine')
    if (target.hq) return no('hqTaken')
    if (d.hq.ruins && nowOf(d) < d.hq.ruins.until) return no('hqRuins')
    const moving = !!d.hq.sectorId
    // A besieged HQ stays where it is: moving it would end the siege for the price of the move.
    if (moving && d.hq.siege) return no('hqMoveSiege')
    if (moving) {
      const since = nowOf(d) - (d.hq.lastMoveAt ?? d.hq.placedAt ?? 0)
      if (since < HQ_MOVE_COOLDOWN_DAYS * DAY) return no('hqCooldown')
    }
    const cost = hqPlaceCostOf(d)
    if (cost > 0 && !spend(d, 'spend_hq', cost, d.myId, moving ? 'move' : 'place')) return no('notEnough')
    const freeUsed = !moving && hqFreeRebuild(d)
    const old = d.sectors.find((x) => x.id === d.hq.sectorId)
    if (old) old.hq = null
    target.hq = 'mine'
    d.hq = { sectorId, placedAt: nowOf(d), lastMoveAt: moving ? nowOf(d) : d.hq.lastMoveAt, siege: null, defenseAt: nowOf(d), ruins: null, freeRebuild: false, freeRebuildUsed: d.hq.freeRebuildUsed || freeUsed }
    // A fresh HQ stands with some defence, even on a thinly held sector.
    target.defense = Math.max(target.defense, 1)
  })
}

// An outsider catches on the headquarters sector. Defence runs down first; with none left the next catch starts a siege.
export function attackHq(): Result {
  if (server) return no('serverGame')
  return mutate((d) => {
    const sector = d.sectors.find((x) => x.id === d.hq.sectorId)
    if (!sector) return no('hqNone')
    if (d.hq.siege) return no('hqSiege')
    if (sector.defense > 0) {
      sector.defense -= 1
      alert(d, 'sector_attack', `hq:${sector.defense}`, sector.id)
    } else {
      const now = nowOf(d)
      d.hq.siege = { by: 'Fish-hook', startedAt: now, endsAt: now + siegeMinutesOf(d) * 60_000 }
      alert(d, 'hq_siege', 'Fish-hook', sector.id)
    }
  })
}

// A clan-mate catches on the headquarters sector: it breaks a siege, or at least builds defence back up.
export function defendHq(): Result {
  if (server) return no('catchToDefend')
  return mutate((d) => {
    const sector = d.sectors.find((x) => x.id === d.hq.sectorId)
    if (!sector) return no('hqNone')
    const me = d.members.find((m) => m.id === d.myId) ?? d.members[0]
    if (d.hq.siege) {
      d.hq.siege = null
      sector.defense = 1
      d.hq.defenseAt = nowOf(d)
      alert(d, 'hq_saved', me.name, sector.id)
      if (d.persona !== 'solo') d.wallet += SIEGE_BREAK_REWARD
      return { ok: true, info: 'siegeBroken' }
    }
    sector.defense = Math.min(DEFENSE_MAX, sector.defense + 1)
    d.hq.defenseAt = nowOf(d)
    return { ok: true, info: 'defence' }
  })
}

export function attackSector(): Result {
  if (server) return no('serverGame')
  return mutate((d) => {
    const mine = d.sectors.filter((x) => x.owner === 'mine' && x.hq !== 'mine')
    const target = mine[Math.floor(Math.random() * mine.length)]
    if (!target) return no('hqNone')
    target.defense = Math.max(0, target.defense - 1)
    alert(d, 'sector_attack', `${target.id}:${target.defense}`, target.id)
  })
}

export function toggleHot(sectorId: string): Result {
  if (server) return no('serverGame')
  return mutate((d) => {
    const s = d.sectors.find((x) => x.id === sectorId)
    if (s) s.hot = !s.hot
  })
}

// ───────────── bounties, nudges, members ─────────────

export function nudge(memberId: string): Result {
  if (server) return srv('clan_nudge', { p_user: memberId })
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

// Demo: the leader has been away for 30 days; the co-leader takes over by himself.
export function leaderAway(): Result {
  if (server) return no('serverGame')
  return mutate((d) => {
    const leader = d.members.find((m) => m.role === 'leader')
    const co = d.members.find((m) => m.role === 'co_leader')
    if (!leader || !co) return no('notMember')
    leader.role = 'member'
    leader.lastCatchMin = 31 * 24 * 60
    co.role = 'leader'
    alert(d, 'nudge', `autoleader:${co.name}`)
  })
}

export function recruitCatch(): Result {
  if (server) return no('serverGame')
  return mutate((d) => {
    let r = d.recruit.find((x) => x.state === 'caught') ?? d.recruit.find((x) => x.state === 'joined')
    // Live mode has no made-up newcomers: the test bench invites one on demand.
    if (!r && d.live) {
      r = { name: 'Новичок', state: 'joined', daysLeft: 5 }
      d.recruit.push(r)
    }
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

export type CatchSummary = { member: string; species: string; cm: number; coins: number; tax: number; hot: boolean; buff: boolean; record: boolean }

export function simulateCatch(opts: { memberId?: string; species?: string } = {}): Result & { summary?: CatchSummary } {
  if (server) return no('serverGame')
  let summary: CatchSummary | undefined
  const res = mutate((d) => {
    if (!d.settings.enabled) return no('disabled')
    const members = d.members.filter((m) => m.role !== undefined)
    // «Улов случайного игрока»: somebody else of the clan, not the one looking.
    const others = members.filter((m) => m.id !== d.myId)
    const member = members.find((m) => m.id === (opts.memberId ?? '')) ?? others[Math.floor(Math.random() * others.length)] ?? members[0]
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
    credit(d, member.id, taken)
    member.weekMeters += Math.round(10 * (buffOn ? BUFF_METER_FACTOR : 1))
    member.lastCatchMin = 0
    if (buffOn) d.buff.lastBonus += sp.coins * (mult - coinMultiplier(sector.hot, false))
    // The weekly task: what this catch adds to it, by the kind of the task.
    const q = d.quest
    if (!q.claimed && q.progress < q.target) {
      let inc = 0
      const once = (key: string) => {
        if (d.questSeen.includes(key)) return 0
        d.questSeen.push(key)
        return 1
      }
      if (q.kind === 'catches') inc = 1
      else if (q.kind === 'species') inc = once('s:' + sp.key)
      else if (q.kind === 'rare') inc = sp.coins >= RARE_COINS ? 1 : 0
      else if (q.kind === 'big') inc = cm >= (q.param ?? BIG_FISH_CM) ? 1 : 0
      else if (q.kind === 'length') inc = cm / 100
      else if (q.kind === 'members') inc = once('m:' + member.id)
      else if (q.kind === 'days') inc = once('d:' + Math.floor(nowOf(d) / DAY))
      else if (q.kind === 'sectors') inc = once('x:' + sector.id)
      q.sim = (q.sim ?? 0) + inc
      q.progress = Math.min(q.target, q.progress + inc)
      if (inc > 0 && !(q.helpers ?? []).includes(member.id)) q.helpers = [...(q.helpers ?? []), member.id]
    }
    // The hall of fame: a bigger fish of the species.
    const rec = d.hall.find((h) => h.species === sp.key)
    const kg = Math.round(Math.pow(cm / 20, 3) * 0.12 * 10) / 10
    let record = false
    if (!rec || cm > (rec.cm ?? 0)) {
      record = true
      const entry = { species: sp.key, member: member.name, cm, kg, at: nowOf(d), hue: member.hue }
      if (rec) Object.assign(rec, entry)
      else d.hall.push(entry)
    }
    d.clan.xp += 2
    d.clan.level = clanLevel(d.clan.xp)
    summary = { member: member.name, species: sp.key, cm, coins, tax: taken, hot: sector.hot, buff: buffOn, record }
  })
  return res.ok ? { ok: true, summary } : res
}

// The weekly settlement: a share of the chest and the battle goes to the treasury.
export function settleWeek(): Result {
  if (server) return no('serverGame')
  return mutate((d) => {
    const chest = 96 + Math.round(Math.random() * 60)
    const race = 60 + Math.round(Math.random() * 80)
    const share = (n: number) => Math.floor((n * d.settings.chestShare) / 100)
    income(d, 'chest_share', share(chest * 9), null, 'chest')
    income(d, 'race_share', share(race * 9), null, 'race')
    d.quest = nextQuest(d)
    d.questSeen = []
  })
}

// ───────────── the admin ─────────────

function settingsPatch(p: Partial<EconomySettings>): Record<string, unknown> {
  const map: Record<keyof EconomySettings, string> = {
    enabled: 'enabled', rentPerSectorDay: 'rent_per_sector_day', sharedRentFactor: 'shared_rent_factor', buffPrice: 'buff_price',
    buffCooldownHours: 'buff_cooldown_hours', buffMinRsvp: 'buff_min_rsvp', taxMax: 'tax_max', chestShare: 'chest_share',
    recruitReward: 'recruit_reward', hqPlaceCost: 'hq_place_cost', hqMoveCost: 'hq_move_cost', speedupShare: 'speedup_share',
  }
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [map[k as keyof EconomySettings], v]))
}

export function updateSettings(patch: Partial<EconomySettings>): Result {
  if (server) return srv('admin_set_clan_economy', { p: settingsPatch(patch) })
  return mutate((d) => {
    if (d.persona !== 'admin') return no('notAdmin')
    d.settings = { ...d.settings, ...patch }
  })
}

export function reverseEntry(entryId: number): Result {
  if (server) return srv('admin_clan_reverse_entry', { p_entry_id: entryId })
  return mutate((d) => {
    if (d.persona !== 'admin') return no('notAdmin')
    const e = d.treasury.entries.find((x) => x.id === entryId)
    if (!e || e.note.startsWith('reversed')) return no('badEntry')
    d.treasury.balance = Math.max(0, d.treasury.balance - e.amount)
    push(d, e.amount > 0 ? 'spend_goal' : 'refund', -e.amount, null, `reversed:${e.id}`)
    e.note = `reversed:${e.note}`
  })
}

// Live mode: what the clan's real catches say — the task's progress, the records of the hall of fame, who has been fishing lately.
export type RealClan = {
  catches: number
  species: number
  rare: number
  maxCm: number
  lengthM: number
  members: number
  days: number
  sectors: number
  lastCatchMin: Record<string, number | null>
  // How many catches each member made this week (the members who worked for the weekly task).
  byMember: Record<string, number>
  hall: { species: string; member: string; userId: string; cm: number | null; kg: number | null; at: number; photo: string | null; avatarUrl?: string | null; catchId?: number }[]
}

export function applyReal(r: RealClan, hueOf: (id: string) => number): Result {
  return mutate((d) => {
    if (!d.live) return no('notLive')
    const q = d.quest
    // On the server the task's progress is the server's own (get_clan_state): only the records and the last catches here.
    if (server) {
      for (const m of d.members) if (m.id in r.lastCatchMin) m.lastCatchMin = r.lastCatchMin[m.id]
      d.hall = r.hall
        .map((h) => ({ species: h.species, member: h.member, cm: h.cm, kg: h.kg, at: h.at, hue: hueOf(h.userId), photo: h.photo, avatarUrl: h.avatarUrl ?? null, catchId: h.catchId }))
        .sort((a, b) => (b.cm ?? -1) - (a.cm ?? -1))
      return
    }
    const real = { catches: r.catches, species: r.species, rare: r.rare, big: r.maxCm >= (q.param ?? BIG_FISH_CM) ? 1 : 0, length: r.lengthM, members: r.members, days: r.days, sectors: r.sectors }[q.kind]
    q.real = real
    if (!q.claimed) q.progress = Math.min(q.target, Math.floor(real + (q.sim ?? 0)))
    // The members who caught this week, plus any the test bench's catches added.
    const caught = d.members.filter((m) => (r.byMember?.[m.id] ?? 0) > 0).map((m) => m.id)
    q.helpers = [...new Set([...(q.helpers ?? []), ...caught])]
    for (const m of d.members) {
      if (m.id in r.lastCatchMin) m.lastCatchMin = r.lastCatchMin[m.id]
    }
    // The records: the real ones only (the clan's city, read fresh each time), so a record that no longer counts —
    // another city's, or one saved by an older build — does not linger in the saved state.
    d.hall = r.hall
      .map((h) => ({ species: h.species, member: h.member, cm: h.cm, kg: h.kg, at: h.at, hue: hueOf(h.userId), photo: h.photo }))
      .sort((a, b) => (b.cm ?? -1) - (a.cm ?? -1))
  })
}

export const SKIN_IDS = CLAN_SKINS.map((s) => s.id)
export type { MapSector }
