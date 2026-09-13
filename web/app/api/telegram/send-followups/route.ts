import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const DELAY_MINUTES = 30

const FOLLOWUP_TEXT = `Как работает RANGE?

🗺️ Каждый берег, озеро и участок реки на карте — сектор. Пока свободный — или уже чей-то.

🎣 Поймал рыбу — сразу фотографируй её в приложении, прямо на месте улова. Сектор в ту же секунду становится твоим.

🏆 Раз в неделю подводим итоги: кто наловил больше — тот наверху рейтинга.

⚔️ Территория держится только до следующего чужого улова — сектор всегда можно перехватить.

🏅 За уловы и территории открываются достижения — есть на что охотиться, кроме рыбы.

👀 Подписывайся на других рыбаков и следи за их уловами и захватами в реальном времени.`

// Polled by a Vercel Cron job (see vercel.json) — sends the "how it works"
// follow-up to anyone who pressed /start (see webhook/route.ts, which
// queues the row this reads) at least DELAY_MINUTES ago and hasn't gotten
// it yet. Runs more often than once every 30 minutes so a given chat's
// follow-up goes out within one polling interval of its due time, not up to
// a full period late.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - DELAY_MINUTES * 60 * 1000).toISOString()
  const { data: due, error } = await admin
    .from('telegram_bot_starts')
    .select('chat_id')
    .is('followup_sent_at', null)
    .lte('started_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const { chat_id } of due) {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text: FOLLOWUP_TEXT,
        reply_markup: {
          inline_keyboard: [[{ text: '🎣 Открыть RANGE', web_app: { url: SITE_URL } }]],
        },
      }),
    })
    // Marked sent even on a delivery failure (e.g. the person blocked the
    // bot) — Telegram won't accept a retry for that chat either, so leaving
    // followup_sent_at null would just re-attempt and re-fail every poll.
    if (res.ok || res.status === 403) {
      await admin.from('telegram_bot_starts').update({ followup_sent_at: new Date().toISOString() }).eq('chat_id', chat_id)
      sent++
    }
  }

  return NextResponse.json({ sent })
}
