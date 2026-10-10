import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { pluralSectors, pluralCatches, pluralRu } from '@/lib/format'
import { withErrorReport } from '@/lib/serverErrors'

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

// Goes once, under the first message to someone whose notifications were
// switched on for them — they'd pressed /start in the bot but never chose
// (profiles.tg_auto_enabled_at): what these messages are and how to stop them.
const AUTO_ON_NOTICE = 'Теперь RANGE пишет сюда о важном в игре. Выключить — команда /stop или «Уведомления в Telegram» в профиле.'

type ActorRef = { display_name: string | null; public_id: string | null }
type OwnerRef = { tg_auto_enabled_at: string | null; tg_auto_notice_at: string | null }
type NotificationRef = {
  kind: string
  territory_id: string | null
  catch_id: number | null
  user_id: string
  actor: ActorRef | ActorRef[] | null
  owner: OwnerRef | OwnerRef[] | null
  payload: Record<string, unknown> | null
}
type Message = { text: string; buttonLabel: string; url: string }

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

// Text is deliberately flat and factual — these repeat, and a message that
// performs drama every time a sector changes hands wears out fast. The
// button is where the pull lives.
function renderMessage(notification: NotificationRef): Message | null {
  const actor = first(notification.actor)
  const actorName = actor?.display_name ?? 'Другой рыбак'
  switch (notification.kind) {
    case 'sector_lost':
      if (!notification.territory_id) return null
      return {
        text: `${actorName} забрал твой сектор ${notification.territory_id}`,
        buttonLabel: 'Открыть сектор',
        url: `${SITE_URL}/?territory=${encodeURIComponent(notification.territory_id)}`,
      }
    case 'new_follower':
      if (!actor?.public_id) return null
      return {
        text: `${actorName} подписался на тебя`,
        buttonLabel: 'Открыть профиль',
        url: `${SITE_URL}/?user=${encodeURIComponent(actor.public_id)}`,
      }
    case 'catch_liked':
      if (!notification.catch_id) return null
      return {
        text: `${actorName} лайкнул твой улов`,
        buttonLabel: 'Посмотреть улов',
        url: `${SITE_URL}/?catch=${notification.catch_id}`,
      }
    case 'follow_catch':
      if (!notification.catch_id) return null
      return {
        text: notification.territory_id ? `${actorName} поймал рыбу на секторе ${notification.territory_id}` : `${actorName} поймал рыбу`,
        buttonLabel: 'Посмотреть улов',
        url: `${SITE_URL}/?catch=${notification.catch_id}`,
      }
    case 'catch_comment':
    case 'comment_reply': {
      if (!notification.catch_id) return null
      const text = notification.payload?.text as string | undefined
      const commentId = notification.payload?.comment_id as number | undefined
      const lead = notification.kind === 'catch_comment' ? `${actorName} прокомментировал твой улов` : `${actorName} ответил на твой комментарий`
      return {
        text: text ? `${lead}: «${text}»` : lead,
        buttonLabel: 'Открыть комментарии',
        url: `${SITE_URL}/?catch=${notification.catch_id}${commentId ? `&comment=${commentId}` : ''}`,
      }
    }
    case 'system_alert': {
      const text = notification.payload?.text as string | undefined
      if (!text) return null
      return { text: `⚠️ RANGE — тревога\n${text}`, buttonLabel: 'Открыть RANGE', url: SITE_URL }
    }
    case 'clan_invite':
    case 'clan_join_request':
    case 'clan_join_accepted':
    case 'clan_kicked':
    case 'clan_disbanded': {
      const clanName = notification.payload?.clan_name as string | undefined
      const clanId = notification.payload?.clan_id as number | undefined
      if (!clanName || !clanId) return null
      const text =
        notification.kind === 'clan_invite'
          ? `${actorName} зовёт тебя в клан «${clanName}»`
          : notification.kind === 'clan_join_request'
            ? `${actorName} хочет вступить в твой клан «${clanName}»`
            : notification.kind === 'clan_join_accepted'
              ? `Тебя приняли в клан «${clanName}»`
              : notification.kind === 'clan_disbanded'
                ? `Клан «${clanName}» распущен модератором`
                : `Тебя исключили из клана «${clanName}»`
      const gone = notification.kind === 'clan_kicked' || notification.kind === 'clan_disbanded'
      return {
        text,
        buttonLabel: gone ? 'Открыть RANGE' : 'Открыть клан',
        url: gone ? SITE_URL : `${SITE_URL}/?clan=${clanId}`,
      }
    }
    case 'referral_joined':
      return {
        text: `${actorName} зарегистрировался по твоей ссылке. Когда сделает первый улов — тебе +100 монет`,
        buttonLabel: 'Открыть RANGE',
        url: SITE_URL,
      }
    case 'referral_reward':
      return {
        text: `${actorName} сделал первый улов — тебе +100 монет за приглашение`,
        buttonLabel: notification.catch_id ? 'Посмотреть улов' : 'Открыть RANGE',
        url: notification.catch_id ? `${SITE_URL}/?catch=${notification.catch_id}` : SITE_URL,
      }
    case 'clan_chat_mention': {
      const clanName = notification.payload?.clan_name as string | undefined
      const clanId = notification.payload?.clan_id as number | undefined
      const text = notification.payload?.text as string | undefined
      if (!clanName || !clanId) return null
      const lead = `${actorName} упомянул тебя в чате клана «${clanName}»`
      return { text: text ? `${lead}: «${text}»` : lead, buttonLabel: 'Открыть чат', url: `${SITE_URL}/?clanchat=${clanId}` }
    }
    case 'clan_chest_reward': {
      const clanName = notification.payload?.clan_name as string | undefined
      const clanId = notification.payload?.clan_id as number | undefined
      const tier = notification.payload?.tier as number | undefined
      const coins = notification.payload?.coins as number | undefined
      if (!clanName || !clanId || !tier) return null
      return {
        text: `Сундук ${['I', 'II', 'III', 'IV', 'V'][tier - 1] ?? tier} клана «${clanName}» открыт${coins ? ` — +${coins} монет` : ''}`,
        buttonLabel: 'Открыть клан',
        url: `${SITE_URL}/?clan=${clanId}`,
      }
    }
    case 'clan_race_result':
    case 'clan_race_overtaken':
    case 'clan_race_finished': {
      const clanName = notification.payload?.clan_name as string | undefined
      const place = (notification.payload?.place ?? notification.payload?.rank) as number | undefined
      if (!clanName) return null
      const coins = notification.payload?.coins as number | undefined
      const ahead = notification.payload?.ahead as string | undefined
      const text =
        notification.kind === 'clan_race_result'
          ? `Итоги битвы кланов: «${clanName}» — ${place ?? '?'}-е место${notification.payload?.finished ? ', доплыли до финиша' : ''}${coins ? `. +${coins} монет` : ''}`
          : notification.kind === 'clan_race_overtaken'
            ? `«${clanName}» обогнали в битве кланов — теперь ${place ?? '?'}-е место${ahead ? `, впереди «${ahead}»` : ''}`
            : `Лодка клана «${clanName}» доплыла до финиша в битве кланов!`
      return { text, buttonLabel: 'Открыть битву кланов', url: `${SITE_URL}/?race=1` }
    }
    case 'moderation': {
      const coinsRemoved = notification.payload?.coinsRemoved as number | undefined
      const coinsSuffix = coinsRemoved ? ` — списано ${coinsRemoved} монет` : ''
      return notification.territory_id
        ? {
            text: `Улов на территории ${notification.territory_id} удалён модератором${coinsSuffix}`,
            buttonLabel: 'Открыть сектор',
            url: `${SITE_URL}/?territory=${encodeURIComponent(notification.territory_id)}`,
          }
        : { text: `Один из твоих уловов удалён модератором${coinsSuffix}`, buttonLabel: 'Открыть RANGE', url: SITE_URL }
    }
    case 'award_granted': {
      const title = notification.payload?.title as string | undefined
      const coins = notification.payload?.coins as number | undefined
      if (!title) return null
      return { text: `Новая награда: ${title}${coins ? ` — +${coins} монет` : ''}`, buttonLabel: 'Открыть профиль', url: SITE_URL }
    }
    case 'weekly_result': {
      const rank = notification.payload?.rank as number | undefined
      const sectors = (notification.payload?.sectors as number | undefined) ?? 0
      const catches = (notification.payload?.catches as number | undefined) ?? 0
      if (!rank) return null
      return {
        text: `Итоги недели: ${rank} место — ${sectors} ${pluralSectors(sectors)}, ${catches} ${pluralCatches(catches)}`,
        buttonLabel: 'Смотреть итоги',
        url: `${SITE_URL}/?lastweek=1`,
      }
    }
    case 'challenge_completed': {
      const title = notification.payload?.title as string | undefined
      const coins = notification.payload?.coins as number | undefined
      if (!title) return null
      return {
        text: `Выполнен челлендж: ${title}${coins ? ` — +${coins} монет` : ''}`,
        buttonLabel: 'Открыть челленджи',
        url: `${SITE_URL}/?challenges=1`,
      }
    }
    case 'challenges_week_done': {
      const coins = notification.payload?.coins as number | undefined
      return {
        text: `Все челленджи недели выполнены!${coins ? ` +${coins} монет` : ''}`,
        buttonLabel: 'Открыть челленджи',
        url: `${SITE_URL}/?challenges=1`,
      }
    }
    case 'challenge_deadline_soon': {
      const hours = (notification.payload?.hours as number | undefined) ?? 48
      return {
        text: `Челленджи недели закончатся через ${hours} часов — не все ещё выполнены. Успей забрать монеты, пока неделя не закрылась`,
        buttonLabel: 'Открыть челленджи',
        url: `${SITE_URL}/?challenges=1`,
      }
    }
    case 'hot_sector_week': {
      const sectors = (notification.payload?.sectors as string[] | undefined) ?? []
      if (!sectors.length) return null
      const city = sectors[0].startsWith('M') ? 'Москве' : 'Батуми'
      return {
        text: `🔥 Горячие сектора недели в ${city}: ${sectors.join(' и ')}.\n\nДо конца воскресенья — ×2 монеты за улов (с «Двойными монетами» — ×3) и ×3 в Казну. Щиты на них не ставятся. Кто удержит сектор до конца недели, получит +100 монет и медаль — если за неделю на нём поймают хоть одну рыбу.`,
        buttonLabel: 'Открыть сектор',
        url: `${SITE_URL}/?territory=${encodeURIComponent(sectors[0])}`,
      }
    }
    case 'hot_sector_won': {
      const coins = (notification.payload?.coins as number | undefined) ?? 100
      if (!notification.territory_id) return null
      return { text: `🔥 Ты удержал горячий сектор ${notification.territory_id} до конца недели — +${coins} монет и медаль`, buttonLabel: 'Открыть профиль', url: SITE_URL }
    }
    case 'legend_gained': {
      const n = (notification.payload?.catches as number | undefined) ?? 0
      if (!notification.territory_id) return null
      return {
        text: `🏆 Ты стал легендой сектора ${notification.territory_id}: больше всех уловов здесь за 90 дней — ${n} ${pluralCatches(n)}`,
        buttonLabel: 'Открыть сектор',
        url: `${SITE_URL}/?territory=${encodeURIComponent(notification.territory_id)}`,
      }
    }
    case 'legend_lost':
      if (!notification.territory_id) return null
      return {
        text: `${actorName} обошёл тебя на секторе ${notification.territory_id} — теперь легенда он. Верни титул!`,
        buttonLabel: 'Открыть сектор',
        url: `${SITE_URL}/?territory=${encodeURIComponent(notification.territory_id)}`,
      }
    case 'admin_gift': {
      // A super admin's gift (admin_gift): their message if they wrote one,
      // then what was given.
      const coins = Number(notification.payload?.coins ?? 0)
      const spins = Number(notification.payload?.spins ?? 0)
      const note = typeof notification.payload?.note === 'string' ? notification.payload.note : ''
      const amounts = [
        coins > 0 ? `+${coins} ${pluralRu(coins, ['монета', 'монеты', 'монет'])}` : null,
        spins > 0 ? `${spins} ${pluralRu(spins, ['бонусный прокрут', 'бонусных прокрута', 'бонусных прокрутов'])}` : null,
      ]
        .filter(Boolean)
        .join(' и ')
      if (!amounts) return null
      return {
        text: note ? `🎁 ${note}\n\nПодарок от RANGE: ${amounts}` : `🎁 Подарок от RANGE: ${amounts}`,
        buttonLabel: 'Открыть RANGE',
        url: SITE_URL,
      }
    }
    case 'support_reply': {
      // A nudge into the support chat, not the answer itself (decided 06.10).
      const ticketId = notification.payload?.ticket_id as number | undefined
      return {
        text: '💬 Новое сообщение в чате с поддержкой RANGE',
        buttonLabel: 'Перейти',
        url: ticketId ? `${SITE_URL}/?support=${ticketId}` : SITE_URL,
      }
    }
    case 'sector_attacked': {
      if (!notification.territory_id) return null
      const defense = Number(notification.payload?.defense ?? 0)
      return {
        text:
          defense > 0
            ? `⚔️ ${actorName} атакует твой сектор ${notification.territory_id} — защита ${defense} из 3. Поймай там рыбу, чтобы укрепить защиту.`
            : `⚔️ ${actorName} снял защиту твоего сектора ${notification.territory_id} — следующий чужой улов заберёт его. Поймай там рыбу, чтобы удержать.`,
        buttonLabel: 'Открыть сектор',
        url: `${SITE_URL}/?territory=${encodeURIComponent(notification.territory_id)}`,
      }
    }
    case 'bite_forecast': {
      const score = notification.payload?.score as number | undefined
      const city = notification.payload?.city === 'moscow' ? 'Москве' : 'Батуми'
      const from = notification.payload?.from as string | undefined
      const to = notification.payload?.to as string | undefined
      if (!score) return null
      return {
        text: `🎣 Завтра в ${city} ${score >= 5 ? 'отличный' : 'хороший'} клёв — ${score}/5.${from && to ? ` Лучшее время ${from}–${to}.` : ''}`,
        buttonLabel: 'Открыть прогноз',
        url: SITE_URL,
      }
    }
    case 'geo_bonus': {
      // «Где это?»'s quest done: a catch in the day's panorama sector.
      const coins = Number(notification.payload?.coins ?? 50)
      return {
        text: `🎯 Задание «Где это?» выполнено: улов в секторе ${notification.territory_id ?? ''} — +${coins} ${pluralRu(coins, ['монета', 'монеты', 'монет'])}`,
        buttonLabel: 'Открыть RANGE',
        url: `${SITE_URL}/?geo=1`,
      }
    }
    case 'daily_reward_reminder': {
      const day = notification.payload?.day as number | undefined
      const coins = notification.payload?.coins as number | undefined
      return {
        text: `🎁 Ежедневная награда ждёт${day ? `: день ${day} из 10` : ''}${coins ? ` — +${coins} монет` : ''}. Забери до полуночи, чтобы не прервать серию.`,
        buttonLabel: 'Забрать награду',
        url: SITE_URL,
      }
    }
    default:
      // Kind that isn't wired up yet — the queueing trigger already filters
      // these out, so reaching here means the two lists drifted apart; drop
      // the row rather than send nothing in a loop.
      return null
  }
}

// Polled every minute by a Supabase pg_cron job (same arrangement as
// send-broadcasts/send-followups — Vercel Cron can't run per-minute on the
// Hobby plan). Only picks up rows whose deliver_after has passed, which is
// what holds messages raised overnight until 08:00 local (see
// notification_deliver_after) — every kind, including follow_catch, is sent
// as its own message as soon as that allows, one row in means one message
// out. (A run of catches by the same angler is already one row: the queueing
// trigger skips a follow_catch within 3 hours of the previous one.)
async function handleGET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: due, error } = await admin
    .from('telegram_outbox')
    .select(
      'id, chat_id, attempts, notifications!inner(kind, territory_id, catch_id, user_id, payload, actor:profiles!notifications_actor_id_fkey(display_name, public_id), owner:profiles!notifications_user_id_fkey(tg_auto_enabled_at, tg_auto_notice_at))'
    )
    .is('sent_at', null)
    .lte('deliver_after', new Date().toISOString())
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  let blocked = 0
  // One batch can hold several rows for the same person — the notice goes
  // under the first of them only.
  const noticed = new Set<string>()

  for (const row of due) {
    const notification = first(row.notifications as NotificationRef | NotificationRef[])
    if (!notification) {
      await admin.from('telegram_outbox').update({ sent_at: new Date().toISOString(), last_error: 'notification missing' }).eq('id', row.id)
      continue
    }

    const message = renderMessage(notification)

    if (!message) {
      await admin.from('telegram_outbox').update({ sent_at: new Date().toISOString(), last_error: 'nothing to render' }).eq('id', row.id)
      continue
    }

    const owner = first(notification.owner)
    const explain = !!owner?.tg_auto_enabled_at && !owner.tg_auto_notice_at && !noticed.has(notification.user_id)

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: row.chat_id,
        text: explain ? `${message.text}\n\n${AUTO_ON_NOTICE}` : message.text,
        reply_markup: {
          inline_keyboard: [[{ text: message.buttonLabel, web_app: { url: message.url } }]],
        },
      }),
    })

    if (res.ok) {
      await admin.from('telegram_outbox').update({ sent_at: new Date().toISOString() }).eq('id', row.id)
      if (explain) {
        noticed.add(notification.user_id)
        await admin.from('profiles').update({ tg_auto_notice_at: new Date().toISOString() }).eq('id', notification.user_id)
      }
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
        .eq('id', notification.user_id)
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
    const givingUp = attempts >= MAX_ATTEMPTS
    await admin
      .from('telegram_outbox')
      .update({
        attempts,
        last_error: body.slice(0, 500),
        // Out of retries: mark it done so it stops being picked up, with
        // last_error left behind as the record of why it never arrived.
        ...(givingUp ? { sent_at: new Date().toISOString() } : {}),
      })
      .eq('id', row.id)
  }

  return NextResponse.json({ sent, blocked })
}

export const GET = withErrorReport('telegram/send-notifications', handleGET)
