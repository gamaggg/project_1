import { tn, tnd } from '@/lib/i18n/runtime'

// «Итоги недели клана»: the Monday message to every member of a clan (notification clan_week_digest, made by
// clan_week_digest_tick in supabase-drafts/clan-update-06-11/06_clan_week_digest.sql). The bot sends it as plain text
// (app/api/telegram/send-notifications/route.ts); the showcase page shows the same text. Flat and factual like the
// game's other messages: what came into the treasury, who gave most, what was built, the clan on the water. A line
// with nothing to say is left out.

export type ClanWeekDigest = {
  clanName: string
  income: number
  spent: number
  top: { name: string; coins: number }[]
  built: { project: string; level: number }[]
  sectors: number
  catches: number
  fishers: number
}

const num = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ')

export function readClanWeekDigest(payload: Record<string, unknown> | null): ClanWeekDigest | null {
  const p = payload ?? {}
  const clanName = typeof p.clan_name === 'string' ? p.clan_name : ''
  if (!clanName) return null
  const list = <T,>(v: unknown, map: (x: Record<string, unknown>) => T | null): T[] => (Array.isArray(v) ? v.map((x) => map((x ?? {}) as Record<string, unknown>)).filter((x): x is T => x !== null) : [])
  return {
    clanName,
    income: Number(p.income ?? 0) || 0,
    spent: Number(p.spent ?? 0) || 0,
    top: list(p.top, (x) => (typeof x.name === 'string' && Number(x.coins) > 0 ? { name: x.name, coins: Number(x.coins) } : null)),
    built: list(p.built, (x) => (typeof x.project === 'string' && Number(x.level) > 0 ? { project: x.project, level: Number(x.level) } : null)),
    sectors: Number(p.sectors ?? 0) || 0,
    catches: Number(p.catches ?? 0) || 0,
    fishers: Number(p.fishers ?? 0) || 0,
  }
}

export function clanWeekDigestText(d: ClanWeekDigest): string {
  const lines = [tn('clan2.tg.weekTitle', { clan: d.clanName })]
  if (d.income > 0 || d.spent > 0)
    lines.push(d.spent > 0 ? tn('clan2.tg.weekMoneySpent', { income: num(d.income), spent: num(d.spent) }) : tn('clan2.tg.weekMoney', { income: num(d.income) }))
  if (d.top.length) lines.push(tn('clan2.tg.weekTop', { list: d.top.map((x) => `${x.name} — ${num(x.coins)}`).join(', ') }))
  if (d.built.length) lines.push(tn('clan2.tg.weekBuilt', { list: d.built.map((x) => tn('clan2.journal.projectLevel', { name: tnd(`clan2.project.${x.project}.name`), n: x.level })).join(', ') }))
  lines.push(tn('clan2.tg.weekWater', { sectors: d.sectors, catches: d.catches, fishers: d.fishers }))
  return lines.join('\n')
}
