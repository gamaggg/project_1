import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

async function sendText(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

// Attaches this chat to the account that generated the token. Every failure
// path answers in the chat: the person is sitting in Telegram waiting for
// something to happen, and silence reads as a broken button.
async function linkAccount(token: string, message: { chat: { id: number }; from?: { id: number } }) {
  const chatId = message.chat.id
  const telegramId = message.from?.id ?? chatId
  const admin = createAdminClient()

  // Pressing /start at all means this chat can receive messages from now on
  // — worth recording even if the link itself turns out to be stale.
  await admin.from('telegram_bot_starts').upsert({ chat_id: chatId }, { onConflict: 'chat_id', ignoreDuplicates: true })

  const { data: row } = await admin
    .from('telegram_link_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    await sendText(chatId, 'Ссылка больше не действует. Открой профиль в RANGE и нажми «Подключить Telegram» ещё раз.')
    return
  }

  // telegram_id has to stay unique per person: the Mini App bridge signs
  // people in by it, so letting one Telegram point at two accounts would
  // make "who is this" ambiguous at login.
  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .neq('id', row.user_id)
    .maybeSingle()

  if (taken) {
    await sendText(chatId, 'Этот Telegram уже привязан к другому аккаунту RANGE.')
    return
  }

  const { error } = await admin
    .from('profiles')
    .update({ telegram_id: telegramId, tg_notifications_enabled: true, tg_unreachable_at: null })
    .eq('id', row.user_id)

  if (error) {
    await sendText(chatId, 'Не получилось подключить уведомления. Попробуй ещё раз из профиля.')
    return
  }

  await admin.from('telegram_link_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
  await sendText(chatId, 'Готово. Теперь я напишу, когда у тебя отнимут сектор.')
}

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
    // "/start link_<token>" comes from the "Подключить Telegram" button in
    // the profile (see create_telegram_link_token) — the only way to attach a
    // chat to an account that signed up by email, since unlike the Mini App
    // bridge nothing here tells us who they are in the app.
    const payload = message.text.slice('/start'.length).trim()
    if (payload.startsWith('link_')) {
      await linkAccount(payload.slice('link_'.length), message)
      return NextResponse.json({ ok: true })
    }

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
