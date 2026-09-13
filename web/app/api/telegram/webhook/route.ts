import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

const WELCOME_CAPTION = `Добро пожаловать в RANGE 🎣

Здесь каждый улов меняет карту. Захватывай береговые сектора, следи за соперниками и поднимайся в рейтинге недели.

Нажми «Открыть RANGE», чтобы начать.`

// Telegram POSTs every update here once the webhook is registered (see
// scripts/setTelegramWebhook.sh) — the only one handled is a /start command,
// answered with a welcome message plus a `web_app` button that opens the
// Mini App directly (same mechanism as BotFather's Menu Button, just
// triggered from a chat message instead). The secret-token header (set at
// registration time, see setWebhook's `secret_token` param) is Telegram's
// documented way to let a webhook verify a POST actually came from them —
// without it anyone who finds this URL could send messages as our bot.
export async function POST(req: Request) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const update = await req.json()
  const message = update.message
  if (typeof message?.text === 'string' && message.text.startsWith('/start')) {
    await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        photo: `${SITE_URL}/telegram/welcome.png`,
        caption: WELCOME_CAPTION,
        reply_markup: {
          inline_keyboard: [[{ text: '🎣 Открыть RANGE', web_app: { url: SITE_URL } }]],
        },
      }),
    })

    // Queues the "how it works" follow-up (see send-followups/route.ts,
    // polled every 10 minutes by a Supabase pg_cron job — see migration
    // schedule_telegram_followups_via_pg_cron) for 30 minutes from now.
    // ignoreDuplicates
    // makes this a no-op on chat_id's primary-key conflict — only a
    // person's very first /start ever starts this timer; reopening the bot
    // later shouldn't re-queue a message they may have already gotten (or
    // are still within the 30-minute window for).
    await createAdminClient()
      .from('telegram_bot_starts')
      .upsert({ chat_id: message.chat.id }, { onConflict: 'chat_id', ignoreDuplicates: true })
  }

  // Telegram retries a webhook that doesn't return 200 — always ack, even
  // for update types we don't handle, so an unrelated message type doesn't
  // queue up retries.
  return NextResponse.json({ ok: true })
}
