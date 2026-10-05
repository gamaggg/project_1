import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { pluralCatches } from '@/lib/format'

// «Ещё на рыбалке?» (fishing_sessions — one row per player per fishing day).
// Players asked for a reminder to photograph the catch while they fish: a
// third of fishing days have a single catch logged (05.10: 13 of 37), and
// a button to turn the reminder on would be forgotten just like the catch.
// So the day starts by itself with the first catch (by the player's city
// time); if 1.5 hours pass without another, the bot quietly asks «Ещё на
// рыбалке?» with «📷 Сфоткать улов» and «Я уже закончил». At most 2 a day,
// only 9:00–21:59 local, only with Telegram notifications on; «Я уже
// закончил» means quiet until tomorrow. Run by pg_cron every 5 minutes
// (GET /api/telegram/fishing).

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const TZ: Record<string, string> = { batumi: 'Asia/Tbilisi', moscow: 'Europe/Moscow' }
const QUIET_AFTER_MS = 90 * 60 * 1000
const GIVE_UP_AFTER_MS = 6 * 60 * 60 * 1000
const MAX_A_DAY = 2

type Session = {
  id: number
  user_id: string
  started_at: string
  ended_at: string | null
  chat_id: number | null
  reminder_message_id: number | null
  reminded_at: string | null
  reminders: number
}

async function tg(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; result?: { message_id?: number } }> {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, result: json?.result }
}

const localDate = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const localHour = (d: Date, tz: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(d))
const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d)

// dryRun: nothing written or sent — just who would get a reminder now (a
// safe check against the live database).
export async function runFishingReminders({ dryRun = false }: { dryRun?: boolean } = {}) {
  const admin = createAdminClient()
  const now = new Date()
  const wouldRemind: { user: string; city: string | null; last: string; today: number }[] = []
  const { data: catches, error } = await admin
    .from('catches')
    .select('user_id, caught_at')
    .gte('caught_at', new Date(now.getTime() - 20 * 3600 * 1000).toISOString())
    .order('caught_at')
  if (error) throw error
  const byUser = new Map<string, string[]>()
  for (const c of catches ?? []) byUser.set(c.user_id, [...(byUser.get(c.user_id) ?? []), c.caught_at])
  if (byUser.size === 0) return { players: 0, started: 0, reminded: 0, wouldRemind }

  const ids = [...byUser.keys()]
  const [{ data: profiles }, { data: sessionRows }] = await Promise.all([
    admin.from('profiles').select('id, telegram_id, tg_notifications_enabled, tg_unreachable_at, city, is_blocked').in('id', ids),
    admin
      .from('fishing_sessions')
      .select('id, user_id, started_at, ended_at, chat_id, reminder_message_id, reminded_at, reminders')
      .in('user_id', ids)
      .gte('started_at', new Date(now.getTime() - 36 * 3600 * 1000).toISOString()),
  ])
  const sessions = (sessionRows ?? []) as Session[]
  let started = 0
  let reminded = 0

  for (const p of profiles ?? []) {
    const tz = TZ[p.city ?? 'batumi'] ?? TZ.batumi
    const today = localDate(now, tz)
    const todays = (byUser.get(p.id) ?? []).filter((at) => localDate(new Date(at), tz) === today)
    if (todays.length === 0) continue

    // The day's first catch opens its fishing day (closing yesterday's, if
    // it was still open — one open day per player).
    let s = sessions.find((x) => x.user_id === p.id && localDate(new Date(x.started_at), tz) === today)
    if (!s && dryRun) {
      s = { id: 0, user_id: p.id, started_at: todays[0], ended_at: null, chat_id: null, reminder_message_id: null, reminded_at: null, reminders: 0 }
    }
    if (!s) {
      await admin.from('fishing_sessions').update({ ended_at: now.toISOString() }).eq('user_id', p.id).is('ended_at', null)
      const { data: created } = await admin
        .from('fishing_sessions')
        .insert({ user_id: p.id, started_at: todays[0] })
        .select('id, user_id, started_at, ended_at, chat_id, reminder_message_id, reminded_at, reminders')
        .single()
      if (!created) continue
      s = created as Session
      started++
    }
    if (s.ended_at) continue // «Я уже закончил»

    const last = new Date(todays[todays.length - 1])
    const gap = now.getTime() - last.getTime()
    const hour = localHour(now, tz)
    if (gap < QUIET_AFTER_MS || gap > GIVE_UP_AFTER_MS || hour < 9 || hour >= 22) continue
    if (s.reminders >= MAX_A_DAY || (s.reminded_at && new Date(s.reminded_at) > last)) continue
    if (!p.telegram_id || !p.tg_notifications_enabled || p.tg_unreachable_at || p.is_blocked) continue
    if (dryRun) {
      wouldRemind.push({ user: p.id, city: p.city, last: last.toISOString(), today: todays.length })
      continue
    }

    if (s.chat_id && s.reminder_message_id) await tg('deleteMessage', { chat_id: s.chat_id, message_id: s.reminder_message_id })
    const n = todays.length
    const sent = await tg('sendMessage', {
      chat_id: p.telegram_id,
      text: `🎣 Ещё на рыбалке? Последний улов — в ${localTime(last, tz)}${n > 1 ? `, сегодня уже ${n} ${pluralCatches(n)}` : ''}.\n\nПоймаешь ещё — сразу сфоткай в RANGE, и сектор будет твоим.`,
      disable_notification: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: '📷 Сфоткать улов', web_app: { url: `${SITE_URL}/?camera=1` } }],
          [{ text: 'Я уже закончил', callback_data: 'fishing_stop' }],
        ],
      },
    })
    if (sent.status === 403) {
      await admin.from('profiles').update({ tg_unreachable_at: now.toISOString(), tg_notifications_enabled: false }).eq('id', p.id)
      continue
    }
    await admin
      .from('fishing_sessions')
      .update({ chat_id: p.telegram_id, reminder_message_id: sent.result?.message_id ?? null, reminded_at: now.toISOString(), reminders: s.reminders + 1 })
      .eq('id', s.id)
    reminded++
  }
  return { players: ids.length, started, reminded, wouldRemind }
}

// «Я уже закончил» under a reminder: quiet until tomorrow, and the reminder
// turns into a short wrap-up. False when the Telegram account isn't linked.
export async function stopFishingDay(telegramId: number): Promise<boolean> {
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle()
  if (!p) return false
  const { data: s } = await admin
    .from('fishing_sessions')
    .select('id, started_at, chat_id, reminder_message_id')
    .eq('user_id', p.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!s) return true
  await admin.from('fishing_sessions').update({ ended_at: new Date().toISOString(), closed_at: new Date().toISOString() }).eq('id', s.id)
  if (s.chat_id && s.reminder_message_id) {
    const { count } = await admin.from('catches').select('id', { count: 'exact', head: true }).eq('user_id', p.id).gte('caught_at', s.started_at)
    const n = count ?? 0
    await tg('editMessageText', {
      chat_id: s.chat_id,
      message_id: s.reminder_message_id,
      text: `🎣 Рыбалка на сегодня закончена${n > 0 ? ` · ${n} ${pluralCatches(n)}` : ''}. Хорошего отдыха!`,
    })
  }
  return true
}
