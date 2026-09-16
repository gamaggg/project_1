import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
// Same reasoning as send-broadcasts: Telegram allows ~30 messages/second
// bot-wide, and this is polled every minute, so a batch this size stays far
// under the limit while keeping each invocation short.
const BATCH_SIZE = 30
// A row that keeps failing for a reason that isn't "blocked" (a network
// blip, a transient 5xx from Telegram) is retried a couple of times and then
// left alone rather than re-attempted every minute forever.
const MAX_ATTEMPTS = 3

type ActorRef = { display_name: string | null }
type NotificationRef = {
  kind: string
  territory_id: string | null
  user_id: string
  actor: ActorRef | ActorRef[] | null
}

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

// Text is deliberately flat and factual — these repeat, and a message that
// performs drama every time a sector changes hands wears out fast. The
// button is where the pull lives.
function renderMessage(notification: NotificationRef): { text: string; buttonLabel: string; url: string } | null {
  const actorName = first(notification.actor)?.display_name ?? 'Другой рыбак'
  switch (notification.kind) {
    case 'sector_lost':
      if (!notification.territory_id) return null
      return {
        text: `${actorName} забрал твой сектор ${notification.territory_id}`,
        buttonLabel: 'Открыть сектор',
        url: `${SITE_URL}/?territory=${encodeURIComponent(notification.territory_id)}`,
      }
    default:
      // Kind that isn't meant for Telegram (or isn't wired up yet) — the
      // queueing trigger already filters these out, so reaching here means
      // the two lists drifted apart; drop the row rather than send nothing
      // in a loop.
      return null
  }
}

// Polled every minute by a Supabase pg_cron job (same arrangement as
// send-broadcasts/send-followups — Vercel Cron can't run per-minute on the
// Hobby plan). Only picks up rows whose deliver_after has passed, which is
// what holds messages raised overnight until 08:00 local (see
// notification_deliver_after).
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: due, error } = await admin
    .from('telegram_outbox')
    .select(
      'id, chat_id, attempts, notifications!inner(kind, territory_id, user_id, actor:profiles!notifications_actor_id_fkey(display_name))'
    )
    .is('sent_at', null)
    .lte('deliver_after', new Date().toISOString())
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  let blocked = 0

  for (const row of due) {
    const notification = first(row.notifications as NotificationRef | NotificationRef[])
    const message = notification ? renderMessage(notification) : null
    if (!message) {
      await admin.from('telegram_outbox').update({ sent_at: new Date().toISOString(), last_error: 'nothing to render' }).eq('id', row.id)
      continue
    }

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: row.chat_id,
        text: message.text,
        reply_markup: {
          inline_keyboard: [[{ text: message.buttonLabel, web_app: { url: message.url } }]],
        },
      }),
    })

    if (res.ok) {
      await admin.from('telegram_outbox').update({ sent_at: new Date().toISOString() }).eq('id', row.id)
      sent++
      continue
    }

    const body = await res.text()

    // The person blocked the bot or deleted their account: no message will
    // ever reach this chat again. Switch their notifications off at the
    // source so nothing else gets queued for them, instead of discovering it
    // one failed send at a time.
    if (res.status === 403) {
      await admin
        .from('profiles')
        .update({ tg_unreachable_at: new Date().toISOString(), tg_notifications_enabled: false })
        .eq('id', notification!.user_id)
      await admin.from('telegram_outbox').update({ sent_at: new Date().toISOString(), last_error: body.slice(0, 500) }).eq('id', row.id)
      blocked++
      continue
    }

    // Rate limited — deliberately NOT marked sent, and pushed past the
    // retry_after Telegram asked for so the next poll doesn't immediately
    // hit the same wall.
    if (res.status === 429) {
      const retryAfter = Number(JSON.parse(body)?.parameters?.retry_after ?? 60)
      await admin
        .from('telegram_outbox')
        .update({
          deliver_after: new Date(Date.now() + retryAfter * 1000).toISOString(),
          last_error: body.slice(0, 500),
        })
        .eq('id', row.id)
      continue
    }

    const attempts = (row.attempts ?? 0) + 1
    await admin
      .from('telegram_outbox')
      .update({
        attempts,
        last_error: body.slice(0, 500),
        // Out of retries: mark it done so it stops being picked up, with
        // last_error left behind as the record of why it never arrived.
        ...(attempts >= MAX_ATTEMPTS ? { sent_at: new Date().toISOString() } : {}),
      })
      .eq('id', row.id)
  }

  return NextResponse.json({ sent, blocked })
}
