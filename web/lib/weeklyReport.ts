import { PLATFORM_LABELS_FALLBACK } from '@/lib/weeklyReportLabels'
import { tg } from '@/lib/socialBot'
import type { createAdminClient } from '@/lib/supabase/admin'

// Monday report for the owner: how many posts went out and how many did not, per channel, plus a few numbers of the game.
// The week is Monday 00:00 to Sunday 24:00 Batumi time (UTC+4). Posts planned before 28.11.2026 are not counted (test period).
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

type Admin = ReturnType<typeof createAdminClient>
const TZ_MS = 4 * 3_600_000
const START = Date.parse('2026-11-28T00:00:00+04:00')

// Start (UTC ms) of the Batumi week that ended before `now`.
export function previousWeek(now = Date.now()): { from: number; to: number } {
  const local = new Date(now + TZ_MS)
  const dow = (local.getUTCDay() + 6) % 7 // Monday = 0
  const thisMonday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow) - TZ_MS
  return { from: thisMonday - 7 * 86_400_000, to: thisMonday }
}

const day = (ms: number) => new Date(ms + TZ_MS).toISOString().slice(8, 10) + '.' + new Date(ms + TZ_MS).toISOString().slice(5, 7)

export async function weeklyReportText(admin: Admin, now = Date.now()): Promise<string> {
  const { from, to } = previousWeek(now)
  const lo = Math.max(from, START)
  const { data } = await admin
    .from('social_posts')
    .select('platforms,status')
    .gte('scheduled_at', new Date(lo).toISOString())
    .lt('scheduled_at', new Date(to).toISOString())
  const per: Record<string, { ok: number; no: number; wait: number }> = {}
  for (const r of data ?? []) {
    for (const pl of r.platforms as string[]) {
      const c = (per[pl] ??= { ok: 0, no: 0, wait: 0 })
      if (r.status === 'published' || r.status === 'reminded') c.ok++
      else if (['cancelled', 'expired', 'failed'].includes(r.status)) c.no++
      else c.wait++
    }
  }
  const iso = (ms: number) => new Date(ms).toISOString()
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
  const [catches, players] = await Promise.all([
    count(admin.from('catches').select('id', { count: 'exact', head: true }).gte('caught_at', iso(from)).lt('caught_at', iso(to))),
    count(admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', iso(from)).lt('created_at', iso(to))),
  ])
  const lines = Object.entries(per).map(([pl, c]) => `${PLATFORM_LABELS_FALLBACK[pl] ?? pl}: вышло ${c.ok}, не вышло ${c.no}${c.wait ? `, ждёт ${c.wait}` : ''}`)
  const sum = Object.values(per).reduce((a, c) => ({ ok: a.ok + c.ok, no: a.no + c.no }), { ok: 0, no: 0 })
  return [
    `📊 Неделя ${day(from)} – ${day(to - 86_400_000)}`,
    '',
    lines.length ? lines.join('\n') : 'Постов в эту неделю не было.',
    lines.length ? `\nВсего: вышло ${sum.ok}, не вышло ${sum.no}` : '',
    '',
    `В игре: новых игроков ${players}, уловов ${catches}`,
  ].join('\n').trim()
}

export async function sendWeeklyReport(admin: Admin, chatId: number, now = Date.now()) {
  await tg('sendMessage', { chat_id: chatId, text: await weeklyReportText(admin, now) })
}
