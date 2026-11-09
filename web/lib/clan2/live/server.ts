'use client'

import { createClient } from '@/lib/supabase/client'
import { monthKeyOf, questReward } from '@/lib/clan2/rules'
import type { AlertKind, BuffState, ClanAlert, DemoState, ProjectId, ProjectLevel, QuestKind, TreasuryEntry, TreasuryKind } from '@/lib/clan2/types'

// The clan update on the server (supabase-drafts/clan-update-06-11, 01–10): one read of the whole clan
// (get_clan_state) poured into the same DemoState the screens already draw, and the actions as calls of the server's
// functions. Until those functions are in the database the read fails with «function not found» and the live mode
// stays the browser-only preview it was (demoStore), so this code can ship before the migrations.

type Json = Record<string, unknown>
const t = (v: unknown): number => (typeof v === 'string' ? Date.parse(v) : typeof v === 'number' ? v : NaN)
const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : d)

export type ServerRead = { ok: true; data: Json; alerts: Json[]; coins: number | null } | { ok: false; missing: boolean }

// The whole clan, and the clan's notifications of this player (the moments, the bell, the journal's events), and the
// player's real coins: the wallet of the deposit sheet is read here again, so it never drifts from the profile.
export async function readServerClan(clanId: number, userId: string): Promise<ServerRead> {
  const supabase = createClient()
  // The generated types do not know the functions of the drafts yet.
  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Json) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>
  const [state, notes, me] = await Promise.all([
    rpc('get_clan_state', { p_clan_id: clanId }),
    supabase.from('notifications').select('id,kind,created_at,payload,territory_id').eq('user_id', userId).like('kind', 'clan_%').order('created_at', { ascending: false }).limit(60),
    supabase.from('profiles').select('coins').eq('id', userId).maybeSingle(),
  ])
  if (state.error) return { ok: false, missing: state.error.code === 'PGRST202' || /function .* does not exist|Could not find the function/i.test(state.error.message) }
  const coins = !me.error && me.data && typeof me.data.coins === 'number' ? me.data.coins : null
  return { ok: true, data: (state.data ?? {}) as Json, alerts: ((notes.data ?? []) as unknown as Json[]), coins }
}

// The server's journal kinds in the preview's words; the zero lines (a setting, a finished build) are not money.
function entryKind(kind: string, amount: number): TreasuryKind | null {
  switch (kind) {
    case 'donation':
      return 'deposit'
    case 'refund_buff':
    case 'loot':
      return 'refund'
    case 'reversal':
      return amount >= 0 ? 'refund' : 'spend_goal'
    case 'built':
    case 'setting':
      return null
    default:
      return kind as TreasuryKind
  }
}

const ALERT_OF: Record<string, AlertKind> = {
  clan_hq_attacked: 'sector_attack',
  clan_hq_siege: 'hq_siege',
  clan_hq_saved: 'hq_saved',
  clan_hq_fell: 'hq_fallen',
  clan_buff_planned: 'buff',
  clan_nudge: 'nudge',
  clan_quest_done: 'quest_done',
  clan_project_done: 'project_done',
  clan_item_bought: 'project_done',
  clan_recruit_paid: 'recruit',
}

// Pours the server's clan into the state the screens draw. What only the preview has (the test bench's clock, the tours
// seen, the map's preview sectors, the hall of fame from real catches) stays as it is.
export function applyServerClan(d: DemoState, s: Json, notes: Json[]): void {
  const econ = (s.economy ?? {}) as Json
  d.settings = {
    ...d.settings,
    enabled: s.enabled === true,
    rentPerSectorDay: num(econ.rent_per_sector_day, d.settings.rentPerSectorDay),
    sharedRentFactor: num(econ.shared_rent_factor, d.settings.sharedRentFactor),
    buffPrice: num(econ.buff_price, d.settings.buffPrice),
    buffCooldownHours: num(econ.buff_cooldown_hours, d.settings.buffCooldownHours),
    buffMinRsvp: num(econ.buff_min_rsvp, d.settings.buffMinRsvp),
    taxMax: num(econ.tax_max, d.settings.taxMax),
    chestShare: num(econ.chest_share, d.settings.chestShare),
    recruitReward: num(econ.recruit_reward, d.settings.recruitReward),
    hqPlaceCost: num(econ.hq_place_cost, d.settings.hqPlaceCost),
    hqMoveCost: num(econ.hq_move_cost, d.settings.hqMoveCost),
    speedupShare: num(econ.speedup_share, d.settings.speedupShare),
  }
  d.clockOffsetMs = 0

  // The treasury and its journal (the server keeps the last 50 lines).
  const log = (Array.isArray(s.log) ? s.log : []) as Json[]
  const entries: TreasuryEntry[] = []
  for (const l of [...log].reverse()) {
    const amount = num(l.amount)
    const kind = entryKind(String(l.kind), amount)
    if (!kind) continue
    entries.push({ id: num(l.id), at: t(l.at), kind, amount, actor: (l.user_id as string | null) ?? null, note: String(l.label ?? '') })
  }
  d.treasury = { balance: num(s.balance), taxRate: num(s.tax_rate), goalId: (s.goal_id as string | null) ?? null, entries }

  // The buildings and the build.
  const projects = (s.projects ?? {}) as Json
  for (const id of Object.keys(d.projects) as ProjectId[]) d.projects[id] = Math.min(3, Math.max(0, num(projects[id]))) as ProjectLevel
  const b = s.build as Json | null
  d.build = b ? { id: b.project as ProjectId, toLevel: num(b.to_level) as 1 | 2 | 3, startedAt: t(b.started_at), endsAt: t(b.ends_at) } : null

  // The headquarters, its siege and ruins.
  const hq = s.hq as Json | null
  const siege = hq?.siege as Json | null | undefined
  const ruins = s.ruins as Json | null
  d.hq = {
    sectorId: (hq?.territory_id as string | undefined) ?? null,
    placedAt: hq ? t(hq.placed_at) : null,
    lastMoveAt: hq?.moved_at ? t(hq.moved_at) : hq ? t(hq.placed_at) : null,
    siege: siege ? { by: String(siege.attacker_id ?? ''), startedAt: t(siege.started_at), endsAt: t(siege.ends_at) } : null,
    defenseAt: d.hq.defenseAt,
    ruins: ruins ? { sectorId: String(ruins.territory_id), by: String(ruins.by_clan_id ?? ''), loot: num(ruins.loot), fellAt: t(ruins.fell_at), until: t(ruins.until) } : null,
  }

  // «Выход»: the phase follows from its times and the cooldown.
  d.buff = buffOf(s.buff as Json | null, d.settings.buffCooldownHours, d.buff.lastBonus)
  d.buffId = s.buff ? num((s.buff as Json).id) : null

  // The weekly task.
  const q = s.quest as Json | null
  if (q) {
    const kind = q.kind as QuestKind
    const claimed = !!q.claimed_at
    d.quest = {
      kind,
      target: num(q.target),
      progress: Math.min(num(q.target), Math.floor(num(q.progress))),
      reward: claimed ? num(q.reward) : questReward(kind, d.projects.board),
      endsAt: t(q.week_start) + 7 * 86_400_000,
      claimed,
      claimedBy: null,
      claimedAt: claimed ? t(q.claimed_at) : null,
      helpers: Array.isArray(q.helpers) ? (q.helpers as string[]) : [],
      param: kind === 'big' ? 60 : undefined,
      real: num(q.progress),
      sim: 0,
    }
  }

  // The shop.
  d.owned = Array.isArray(s.items) ? (s.items as string[]) : []
  const eq = (s.equipped ?? {}) as Json
  d.equippedSkin = (eq.clan_skin as string | null) ?? null
  d.equipped = { boat: (eq.boat as string | null) ?? null, frame: (eq.frame as string | null) ?? null }
  for (const sec of d.sectors) if (sec.owner === 'mine') sec.skin = d.equippedSkin

  // What every member put in this month.
  d.deposits = { month: monthKeyOf(Date.now()), byMember: Object.fromEntries(Object.entries((s.month_givers ?? {}) as Json).map(([k, v]) => [k, num(v)])) }

  // The clan's notifications of this player, as the alerts the bell, the journal and the moments read.
  const alerts: ClanAlert[] = []
  for (const n of notes) {
    const kind = ALERT_OF[String(n.kind)]
    if (!kind) continue
    const p = (n.payload ?? {}) as Json
    const text =
      n.kind === 'clan_hq_attacked'
        ? `hq:${num(p.defense)}`
        : n.kind === 'clan_hq_fell'
          ? `fell:${num(p.loot)}`
          : n.kind === 'clan_project_done'
            ? `${String(p.project ?? '')}:${num(p.level)}`
            : n.kind === 'clan_item_bought'
              ? String(p.item ?? '')
              : n.kind === 'clan_recruit_paid'
                ? 'paid:'
                : String(p.kind ?? '')
    alerts.push({ id: num(n.id), at: t(n.created_at), kind, text, sectorId: (p.territory_id as string | undefined) ?? (n.territory_id as string | undefined), read: true })
  }
  d.alerts = alerts
}

function buffOf(b: Json | null, cooldownHours: number, lastBonus: number): BuffState {
  const idle: BuffState = { phase: 'idle', startsAt: null, endsAt: null, cooldownUntil: null, rsvp: [], startedBy: null, lastBonus }
  if (!b) return idle
  const startsAt = t(b.starts_at)
  const endsAt = t(b.ends_at)
  const cooldownUntil = endsAt + cooldownHours * 3_600_000
  const now = Date.now()
  const phase = now < startsAt ? 'planned' : now < endsAt ? 'active' : now < cooldownUntil ? 'cooldown' : 'idle'
  if (phase === 'idle') return idle
  return { phase, startsAt, endsAt, cooldownUntil, rsvp: Array.isArray(b.rsvp) ? (b.rsvp as string[]) : [], startedBy: (b.created_by as string | null) ?? null, lastBonus }
}

// The server's refusals (CLAN:no_funds…) in the preview's reasons, so the same messages show.
const REASON: Record<string, string> = {
  no_funds: 'notEnough',
  not_manager: 'notManager',
  not_member: 'notMember',
  treasury_off: 'disabled',
  level_low: 'levelLow',
  owned: 'owned',
  not_owned: 'notOwned',
  build_busy: 'buildBusy',
  build_none: 'buildNone',
  no_hq_build: 'noHqBuild',
  max_level: 'maxLevel',
  hq_ruins: 'hqRuins',
  hq_not_ours: 'hqNotMine',
  hq_taken: 'hqTaken',
  hq_cooldown: 'hqCooldown',
  buff_busy: 'buffBusy',
  buff_cooldown: 'buffCooldown',
  buff_gone: 'buffNone',
  quest_open: 'questOpen',
  quest_claimed: 'questOpen',
  nudge_once: 'nudgeOnce',
  bad_rate: 'badRate',
  bad_goal: 'noGoal',
  bad_entry: 'badEntry',
  bad_amount: 'minDeposit',
}
export function reasonOf(message: string): string {
  const m = /CLAN:([a-z_]+)/.exec(message)
  if (m) return REASON[m[1]] ?? m[1]
  if (/not enough coins/i.test(message)) return 'wallet'
  if (/not allowed/i.test(message)) return 'notAdmin'
  return 'network'
}

export async function callServer(fn: string, args: Json): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createClient()
  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Json) => Promise<{ error: { message: string } | null }>
  const { error } = await rpc(fn, args)
  return error ? { ok: false, reason: reasonOf(error.message) } : { ok: true }
}
