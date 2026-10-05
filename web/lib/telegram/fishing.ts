import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { pluralCatches } from '@/lib/format'

// «Я на рыбалке» in the bot (fishing_sessions): players asked for something
// that keeps reminding them to photograph the catch while they fish, like a
// taxi's lock-screen status. A web app can't put anything on the lock
// screen, so the bot does what it can: a pinned message with a camera
// button, a quiet reminder every 1.5 hours (the previous one deleted, so the
// chat doesn't fill up), and at the end — 8 hours, or «Закончить» in the app
// or the bot — the pin comes off and the message becomes a summary.
// Run right after a player starts or stops (POST /api/telegram/fishing, for
// just them) and every 5 minutes by pg_cron for everyone.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const REMIND_EVERY_MS = 90 * 60 * 1000
const TZ: Record<string, string> = { batumi: 'Asia/Tbilisi', moscow: 'Europe/Moscow' }

type Session = {
  id: number
  user_id: string
  started_at: string
  ends_at: string
  ended_at: string | null
  chat_id: number | null
  message_id: number | null
  reminder_message_id: number | null
  reminded_at: string | null
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

function buttons() {
  return {
    inline_keyboard: [
      [{ text: '📷 Сфоткать улов', web_app: { url: `${SITE_URL}/?camera=1` } }],
      [{ text: 'Закончить рыбалку', callback_data: 'fishing_stop' }],
    ],
  }
}

function duration(fromIso: string, toMs: number): string {
  const min = Math.max(1, Math.round((toMs - new Date(fromIso).getTime()) / 60000))
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? (m > 0 ? `${h} ч ${m} мин` : `${h} ч`) : `${m} мин`
}

export async function processFishingSessions(filter: { userId?: string } = {}) {
  const admin = createAdminClient()
  let q = admin
    .from('fishing_sessions')
    .select('id, user_id, started_at, ends_at, ended_at, chat_id, message_id, reminder_message_id, reminded_at')
    .is('closed_at', null)
    .order('started_at')
    .limit(200)
  if (filter.userId) q = q.eq('user_id', filter.userId)
  const { data, error } = await q
  if (error) throw error
  const now = Date.now()
  let started = 0
  let reminded = 0
  let closed = 0

  for (const s of (data ?? []) as Session[]) {
    const catchesSince = async () => {
      const { count } = await admin
        .from('catches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', s.user_id)
        .gte('caught_at', s.started_at)
      return count ?? 0
    }

    // Over: the pin comes off, the message becomes a summary.
    const endedAt = s.ended_at ?? (new Date(s.ends_at).getTime() <= now ? s.ends_at : null)
    if (endedAt) {
      if (s.chat_id && s.message_id) {
        const n = await catchesSince()
        if (s.reminder_message_id) await tg('deleteMessage', { chat_id: s.chat_id, message_id: s.reminder_message_id })
        await tg('unpinChatMessage', { chat_id: s.chat_id, message_id: s.message_id })
        await tg('editMessageText', {
          chat_id: s.chat_id,
          message_id: s.message_id,
          text: `🎣 Рыбалка закончилась · ${duration(s.started_at, new Date(endedAt).getTime())} · ${n > 0 ? `${n} ${pluralCatches(n)}` : 'без уловов'}`,
        })
      }
      await admin.from('fishing_sessions').update({ ended_at: endedAt, closed_at: new Date().toISOString() }).eq('id', s.id)
      closed++
      continue
    }

    // Just started: the pinned message. message_id 0 = no Telegram to send
    // to (not linked, or the bot is blocked) — never tried again.
    if (s.message_id === null) {
      const { data: p } = await admin.from('profiles').select('telegram_id, tg_unreachable_at, city').eq('id', s.user_id).single()
      if (!p?.telegram_id || p.tg_unreachable_at) {
        await admin.from('fishing_sessions').update({ message_id: 0 }).eq('id', s.id)
        continue
      }
      const until = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ[p.city ?? 'batumi'] ?? TZ.batumi }).format(
        new Date(s.ends_at)
      )
      const sent = await tg('sendMessage', {
        chat_id: p.telegram_id,
        text: `🎣 Ты на рыбалке до ${until}.\n\nПоймал — сразу сфоткай улов в RANGE: сектор станет твоим, а за рыбу придут монеты. Напомню раз в полтора часа.`,
        disable_notification: true,
        reply_markup: buttons(),
      })
      if (!sent.ok || !sent.result?.message_id) {
        if (sent.status === 403) {
          await admin.from('profiles').update({ tg_unreachable_at: new Date().toISOString(), tg_notifications_enabled: false }).eq('id', s.user_id)
        }
        await admin.from('fishing_sessions').update({ message_id: 0 }).eq('id', s.id)
        continue
      }
      await tg('pinChatMessage', { chat_id: p.telegram_id, message_id: sent.result.message_id, disable_notification: true })
      await admin
        .from('fishing_sessions')
        .update({ chat_id: p.telegram_id, message_id: sent.result.message_id, reminded_at: new Date().toISOString() })
        .eq('id', s.id)
      started++
      continue
    }

    // Under way: a quiet reminder every 1.5 hours, replacing the last one.
    if (s.chat_id && s.message_id && (!s.reminded_at || now - new Date(s.reminded_at).getTime() >= REMIND_EVERY_MS)) {
      const n = await catchesSince()
      if (s.reminder_message_id) await tg('deleteMessage', { chat_id: s.chat_id, message_id: s.reminder_message_id })
      const sent = await tg('sendMessage', {
        chat_id: s.chat_id,
        text: `🎣 Ты на рыбалке уже ${duration(s.started_at, now)}${n > 0 ? ` · ${n} ${pluralCatches(n)}` : ''}. Не забудь сфоткать улов!`,
        disable_notification: true,
        reply_markup: buttons(),
      })
      await admin
        .from('fishing_sessions')
        .update({ reminder_message_id: sent.result?.message_id ?? null, reminded_at: new Date().toISOString() })
        .eq('id', s.id)
      reminded++
    }
  }
  return { sessions: data?.length ?? 0, started, reminded, closed }
}
