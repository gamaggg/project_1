import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
// Telegram allows roughly 30 messages/second across the whole bot — this
// batch size, polled every minute (see migration
// add_telegram_broadcast_queue's cron.schedule), stays far under that with
// room to spare, and keeps each invocation quick instead of racing Vercel's
// function duration limit on a big announcement.
const BATCH_SIZE = 30

// Polled every minute by a Supabase pg_cron job (see the 'telegram-send-broadcasts'
// job — same pattern as send-followups/route.ts, just queue-per-recipient
// instead of one row per bot-starter). Queued by admin_post_announcement
// when a super admin checks "Отправить в Telegram" in PostAnnouncementModal
// — see queries.ts's useAdminPostAnnouncement.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: due, error } = await admin
    .from('telegram_broadcast_queue')
    .select('id, chat_id, announcements(body, button_label, button_url, photo_url)')
    .is('sent_at', null)
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const row of due) {
    const announcement = Array.isArray(row.announcements) ? row.announcements[0] : row.announcements
    if (!announcement) {
      // The announcement itself was deleted after being queued — nothing
      // left to send, just clear it so it stops showing up as due.
      await admin.from('telegram_broadcast_queue').update({ sent_at: new Date().toISOString() }).eq('id', row.id)
      continue
    }
    const replyMarkup =
      announcement.button_label && announcement.button_url
        ? { inline_keyboard: [[{ text: announcement.button_label, url: announcement.button_url }]] }
        : undefined
    // A photo goes out as sendPhoto+caption (same shape as the welcome/
    // follow-up messages) instead of sendMessage+text — Telegram doesn't
    // let one call carry both a text message and a separate image.
    const res = announcement.photo_url
      ? await fetch(`${TELEGRAM_API}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: row.chat_id,
            photo: announcement.photo_url,
            caption: announcement.body,
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
        })
      : await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: row.chat_id,
            text: announcement.body,
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
        })
    // Marked sent even on a delivery failure (e.g. the person blocked the
    // bot) — same reasoning as send-followups: Telegram won't accept a
    // retry for that chat_id either, so leaving sent_at null would just
    // re-attempt and re-fail every poll forever.
    if (res.ok || res.status === 403) {
      await admin.from('telegram_broadcast_queue').update({ sent_at: new Date().toISOString() }).eq('id', row.id)
      sent++
    }
  }

  return NextResponse.json({ sent })
}
