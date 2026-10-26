import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { isEmptyTelegramAccount } from '@/lib/telegram/accounts'
import { miniAppUrlForPayload } from '@/lib/telegram/startParamCodec'
import { stopFishingDay } from '@/lib/telegram/fishing'
import { withErrorReport } from '@/lib/serverErrors'
import { TRANSLATION_READY, langFromLocale, translate, type Lang, type TKey, type TVars } from '@/lib/i18n/core'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// The bot answers in the language Telegram reports for the person (Russian
// until the translation is switched on — TRANSLATION_READY).
type From = { language_code?: string } | undefined
const langOf = (from: From): Lang => (TRANSLATION_READY ? langFromLocale(from?.language_code) : 'ru')
const say = (lang: Lang, key: TKey, vars?: TVars) => translate(lang, key, vars)

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
async function linkAccount(token: string, message: { chat: { id: number }; from?: { id: number; language_code?: string } }) {
  const lang = langOf(message.from)
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
    await sendText(chatId, say(lang, 'bot.linkExpired'))
    return
  }

  // telegram_id has to stay unique per person: the Mini App bridge signs
  // people in by it, so letting one Telegram point at two accounts would
  // make "who is this" ambiguous at login.
  const { data: taken } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('telegram_id', telegramId)
    .neq('id', row.user_id)
    .maybeSingle()

  if (taken) {
    // Most often the other account is the one the Mini App made by itself
    // the first time this person opened it signed out (see
    // /api/auth/telegram) — before they signed in to their real, email
    // account. The token proves they own the account asking, and /start
    // proves they own this Telegram, so an empty auto-made account (never
    // caught anything, in no clan) just hands the link over. One with real
    // play stays put — that needs a person to sort out.
    if (!(await isEmptyTelegramAccount(admin, taken.id))) {
      await sendText(
        chatId,
        say(lang, 'bot.taken', { name: taken.display_name ? say(lang, 'bot.nameSuffix', { name: taken.display_name }) : '' }),
      )
      return
    }
    const { error: releaseError } = await admin.from('profiles').update({ telegram_id: null, tg_notifications_enabled: false }).eq('id', taken.id)
    if (releaseError) {
      await sendText(chatId, say(lang, 'bot.connectFailed'))
      return
    }
  }

  // Asking for notifications from the profile is a choice like the switch:
  // tg_choice_at keeps them from being switched back on by default later.
  const { error } = await admin
    .from('profiles')
    .update({ telegram_id: telegramId, tg_notifications_enabled: true, tg_unreachable_at: null, tg_choice_at: new Date().toISOString() })
    .eq('id', row.user_id)

  if (error) {
    // Put a released link back, so the empty account still opens in the Mini App.
    if (taken) await admin.from('profiles').update({ telegram_id: telegramId }).eq('id', taken.id)
    await sendText(chatId, say(lang, 'bot.connectFailed'))
    return
  }

  await admin.from('telegram_link_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
  await sendText(chatId, say(lang, 'bot.linked'))
}

// "/stop": game notifications off, remembered as the person's choice so
// they're never switched back on by default (see profiles.tg_choice_at).
// The first message to anyone whose notifications were turned on for them
// points here (see send-notifications). Announcements aren't covered — they
// go to every chat that pressed /start (admin_post_announcement).
async function stopNotifications(message: { chat: { id: number }; from?: { id: number; language_code?: string } }) {
  const lang = langOf(message.from)
  const telegramId = message.from?.id ?? message.chat.id
  // Someone who pressed /start but never signed up has no profile to switch
  // off — this stops the onboarding chain for their chat (onboarding_due).
  await createAdminClient().from('telegram_bot_starts').update({ stopped_at: new Date().toISOString() }).eq('chat_id', message.chat.id)
  const { data, error } = await createAdminClient()
    .from('profiles')
    .update({ tg_notifications_enabled: false, tg_choice_at: new Date().toISOString() })
    .eq('telegram_id', telegramId)
    .select('id')
  await sendText(
    message.chat.id,
    error
      ? say(lang, 'bot.stopFailed')
      : data.length
        ? say(lang, 'bot.stopped')
        : say(lang, 'bot.notLinked'),
  )
}

// Telegram POSTs every update here once the webhook is registered (see
// scripts/setTelegramWebhook.sh) — handled are /stop (see stopNotifications)
// and /start, answered with a welcome message plus a `web_app` button that opens the
// Mini App directly (same mechanism as BotFather's Menu Button, just
// triggered from a chat message instead). The secret-token header (set at
// registration time, see setWebhook's `secret_token` param) is Telegram's
// documented way to let a webhook verify a POST actually came from them —
// without it anyone who finds this URL could send messages as our bot.
async function handlePOST(req: Request) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const update = await req.json()

  // «Я уже закончил» under a «Ещё на рыбалке?» reminder (see
  // lib/telegram/fishing.ts): quiet until tomorrow.
  const callback = update.callback_query
  if (callback?.data === 'fishing_stop') {
    const linked = await stopFishingDay(callback.from?.id).catch(() => false)
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callback.id, text: say(langOf(callback.from), linked ? 'bot.fishingStopOk' : 'bot.fishingStopNo') }),
    })
    return NextResponse.json({ ok: true })
  }

  const message = update.message

  // A super admin's reply to a forwarded support request (see
  // /api/support/notify): it becomes the answer in the player's «Активность».
  const repliedTo = message?.reply_to_message?.message_id
  if (repliedTo) {
    const admin = createAdminClient()
    const { data: link } = await admin
      .from('support_telegram_messages')
      .select('ticket_id')
      .eq('chat_id', message.chat.id)
      .eq('message_id', repliedTo)
      .maybeSingle()
    if (link) {
      const text = typeof message.text === 'string' ? message.text.trim() : ''
      let answer: string
      if (!text) {
        answer = 'Пока можно отвечать только текстом.'
      } else {
        const { error } = await admin.rpc('answer_support_ticket', { p_ticket_id: link.ticket_id, p_admin_telegram: message.from?.id, p_body: text })
        answer = error ? `Не получилось отправить ответ: ${error.message}` : `✅ Ответ на обращение #${link.ticket_id} отправлен игроку`
      }
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: message.chat.id, text: answer, reply_to_message_id: message.message_id }),
      })
      return NextResponse.json({ ok: true })
    }
  }
  if (typeof message?.text === 'string' && /^\/stop(@\w+)?$/i.test(message.text.trim())) {
    await stopNotifications(message)
    return NextResponse.json({ ok: true })
  }
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

    // "/start r_<query>": someone opened a share link inside Telegram (lib/telegram/startParam.ts).
    // The button opens the Mini App at the address the plain web link would have had, so the
    // invite (?ref=) and the shared screen reach the app instead of being lost on the way.
    const appUrl = miniAppUrlForPayload(payload, SITE_URL)

    await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        photo: `${SITE_URL}/telegram/welcome.png`,
        caption: say(langOf(message.from), 'bot.welcome'),
        reply_markup: {
          inline_keyboard: [[{ text: say(langOf(message.from), 'bot.openBtn'), web_app: { url: appUrl } }]],
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

export const POST = withErrorReport('telegram/webhook', handlePOST)
