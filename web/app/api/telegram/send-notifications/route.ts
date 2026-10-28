import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/cronAuth'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { pluralSectors, pluralCatches } from '@/lib/format'
import { setCurrentLanguage, tn } from '@/lib/i18n/runtime'
import { isLang, type Lang } from '@/lib/i18n/core'
import { localAwardTitle, localChallengeName } from '@/lib/data/dbText'
import { withErrorReport } from '@/lib/serverErrors'
import { asCityId, cityForSectorId, type CityId } from '@/lib/data/city'

// «in the city» as the notification texts name it (tg.in…).
const IN_CITY = { batumi: 'tg.inBatumi', moscow: 'tg.inMoscow', spb: 'tg.inSpb', sochi: 'tg.inSochi', tbilisi: 'tg.inTbilisi' } as const satisfies Record<CityId, string>

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
// (tg.autoOn in the dictionary.)

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
// extraButtons: plain link buttons under the main one (an alert's «write to this player» links).
type Message = { text: string; buttonLabel: string; url: string; extraButtons?: { text: string; url: string }[] }

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

// Text is deliberately flat and factual — these repeat, and a message that
// performs drama every time a sector changes hands wears out fast. The
// button is where the pull lives.
function renderMessage(notification: NotificationRef): Message | null {
  const actor = first(notification.actor)
  const actorName = actor?.display_name ?? tn('tg.otherAngler')
  const sector = (id: string) => ({ buttonLabel: tn('tg.btnSector'), url: `${SITE_URL}/?territory=${encodeURIComponent(id)}` })
  const catchBtn = (): { buttonLabel: string; url: string } => ({ buttonLabel: tn('tg.btnCatch'), url: `${SITE_URL}/?catch=${notification.catch_id}` })
  const rangeBtn = { buttonLabel: tn('tg.btnRange'), url: SITE_URL }
  const coinsDash = (coins: number | undefined) => (coins ? tn('tg.coinsDash', { coins }) : '')
  switch (notification.kind) {
    case 'sector_lost':
      if (!notification.territory_id) return null
      return { text: tn('tg.sectorLost', { actor: actorName, id: notification.territory_id }), ...sector(notification.territory_id) }
    case 'new_follower':
      if (!actor?.public_id) return null
      return {
        text: tn('tg.newFollower', { actor: actorName }),
        buttonLabel: tn('tg.btnProfile'),
        url: `${SITE_URL}/?user=${encodeURIComponent(actor.public_id)}`,
      }
    case 'catch_liked':
      if (!notification.catch_id) return null
      return { text: tn('tg.catchLiked', { actor: actorName }), ...catchBtn() }
    case 'follow_catch':
      if (!notification.catch_id) return null
      return {
        text: notification.territory_id ? tn('tg.followCatchAt', { actor: actorName, id: notification.territory_id }) : tn('tg.followCatch', { actor: actorName }),
        ...catchBtn(),
      }
    case 'catch_comment':
    case 'comment_reply': {
      if (!notification.catch_id) return null
      const text = notification.payload?.text as string | undefined
      const commentId = notification.payload?.comment_id as number | undefined
      const lead = notification.kind === 'catch_comment' ? tn('tg.commentLead', { actor: actorName }) : tn('tg.replyLead', { actor: actorName })
      return {
        text: text ? tn('tg.withText', { lead, text }) : lead,
        buttonLabel: tn('tg.btnComments'),
        url: `${SITE_URL}/?catch=${notification.catch_id}${commentId ? `&comment=${commentId}` : ''}`,
      }
    }
    case 'system_alert': {
      // For the super admins: stays in Russian, whoever's language is set.
      const text = notification.payload?.text as string | undefined
      if (!text) return null
      // Who it hit (system_health_tick puts up to three players in the payload): a button
      // that opens a chat with each one who has Telegram linked.
      const players = (notification.payload?.players as { name?: string; tg_id?: number | null }[] | undefined) ?? []
      const extraButtons = players
        .filter((p) => typeof p.tg_id === 'number')
        .slice(0, 3)
        .map((p) => ({ text: `Написать: ${p.name ?? 'игрок'}`.slice(0, 60), url: `tg://user?id=${p.tg_id}` }))
      return { text: `⚠️ RANGE — тревога\n${text}`, buttonLabel: 'Открыть RANGE', url: SITE_URL, extraButtons }
    }
    case 'clan_invite':
    case 'clan_join_request':
    case 'clan_join_accepted':
    case 'clan_kicked':
    case 'clan_disbanded': {
      const clanName = notification.payload?.clan_name as string | undefined
      const clanId = notification.payload?.clan_id as number | undefined
      if (!clanName || !clanId) return null
      const vars = { actor: actorName, clan: clanName }
      const text =
        notification.kind === 'clan_invite'
          ? tn('tg.clanInvite', vars)
          : notification.kind === 'clan_join_request'
            ? tn('tg.clanRequest', vars)
            : notification.kind === 'clan_join_accepted'
              ? tn('tg.clanAccepted', vars)
              : notification.kind === 'clan_disbanded'
                ? tn('tg.clanDisbanded', vars)
                : tn('tg.clanKicked', vars)
      const gone = notification.kind === 'clan_kicked' || notification.kind === 'clan_disbanded'
      return {
        text,
        buttonLabel: gone ? tn('tg.btnRange') : tn('tg.btnClan'),
        url: gone ? SITE_URL : `${SITE_URL}/?clan=${clanId}`,
      }
    }
    case 'referral_joined':
      return { text: tn('tg.referralJoined', { actor: actorName }), ...rangeBtn }
    case 'referral_reward':
      return {
        text: tn('tg.referralReward', { actor: actorName }),
        buttonLabel: notification.catch_id ? tn('tg.btnCatch') : tn('tg.btnRange'),
        url: notification.catch_id ? `${SITE_URL}/?catch=${notification.catch_id}` : SITE_URL,
      }
    case 'clan_chat_mention': {
      const clanName = notification.payload?.clan_name as string | undefined
      const clanId = notification.payload?.clan_id as number | undefined
      const text = notification.payload?.text as string | undefined
      if (!clanName || !clanId) return null
      const lead = tn('tg.chatMention', { actor: actorName, clan: clanName })
      return { text: text ? tn('tg.withText', { lead, text }) : lead, buttonLabel: tn('tg.btnChat'), url: `${SITE_URL}/?clanchat=${clanId}` }
    }
    case 'clan_chest_reward': {
      const clanName = notification.payload?.clan_name as string | undefined
      const clanId = notification.payload?.clan_id as number | undefined
      const tier = notification.payload?.tier as number | undefined
      const coins = notification.payload?.coins as number | undefined
      if (!clanName || !clanId || !tier) return null
      return {
        text: tn('tg.chestOpened', { roman: ['I', 'II', 'III', 'IV', 'V'][tier - 1] ?? tier, clan: clanName, coins: coinsDash(coins) }),
        buttonLabel: tn('tg.btnClan'),
        url: `${SITE_URL}/?clan=${clanId}`,
      }
    }
    case 'clan_war_started':
    case 'clan_war_reminder': {
      const clanName = notification.payload?.clan_name as string | undefined
      if (!clanName) return null
      const text =
        notification.kind === 'clan_war_started'
          ? tn('tg.warStarted', { clan: clanName })
          : notification.payload?.slot === 'last'
            ? tn('tg.warReminderLast', { clan: clanName })
            : tn('tg.warReminderStart', { clan: clanName })
      return { text, buttonLabel: tn('tg.btnRace'), url: `${SITE_URL}/?race=1` }
    }
    case 'clan_race_result':
    case 'clan_race_overtaken':
    case 'clan_race_finished': {
      const clanName = notification.payload?.clan_name as string | undefined
      const place = (notification.payload?.place ?? notification.payload?.rank) as number | undefined
      if (!clanName) return null
      const coins = notification.payload?.coins as number | undefined
      const ahead = notification.payload?.ahead as string | undefined
      const placeText = tn('race.place', { rank: place ?? '?' })
      const text =
        notification.kind === 'clan_race_result'
          ? tn('tg.raceResult', {
              clan: clanName,
              place: placeText,
              finished: notification.payload?.finished ? tn('tg.raceFinishedSuffix') : '',
              coins: coins ? tn('tg.raceCoinsSuffix', { coins }) : '',
            })
          : notification.kind === 'clan_race_overtaken'
            ? tn('tg.raceOvertaken', { clan: clanName, place: placeText, ahead: ahead ? tn('tg.raceAhead', { name: ahead }) : '' })
            : tn('tg.raceBoatFinished', { clan: clanName })
      return { text, buttonLabel: tn('tg.btnRace'), url: `${SITE_URL}/?race=1` }
    }
    case 'moderation': {
      const coinsRemoved = notification.payload?.coinsRemoved as number | undefined
      const suffix = coinsRemoved ? tn('tg.modSuffix', { n: coinsRemoved }) : ''
      return notification.territory_id
        ? { text: tn('tg.modAt', { id: notification.territory_id, suffix }), ...sector(notification.territory_id) }
        : { text: tn('tg.modOne', { suffix }), ...rangeBtn }
    }
    case 'award_granted': {
      const title = notification.payload?.title as string | undefined
      const coins = notification.payload?.coins as number | undefined
      if (!title) return null
      return { text: tn('tg.award', { title: localAwardTitle(title), coins: coinsDash(coins) }), buttonLabel: tn('tg.btnProfile'), url: SITE_URL }
    }
    case 'weekly_result': {
      const rank = notification.payload?.rank as number | undefined
      const sectors = (notification.payload?.sectors as number | undefined) ?? 0
      const catches = (notification.payload?.catches as number | undefined) ?? 0
      if (!rank) return null
      return {
        text: tn('tg.weekly', { rank, sectors: `${sectors} ${pluralSectors(sectors)}`, catches: `${catches} ${pluralCatches(catches)}` }),
        buttonLabel: tn('tg.btnRecap'),
        url: `${SITE_URL}/?lastweek=1`,
      }
    }
    case 'challenge_completed': {
      const title = notification.payload?.title as string | undefined
      const coins = notification.payload?.coins as number | undefined
      if (!title) return null
      return {
        text: tn('tg.challengeDone', { title: localChallengeName(title), coins: coinsDash(coins) }),
        buttonLabel: tn('tg.btnChallenges'),
        url: `${SITE_URL}/?challenges=1`,
      }
    }
    case 'challenges_week_done': {
      const coins = notification.payload?.coins as number | undefined
      return {
        text: tn('tg.challengesAll', { coins: coins ? tn('tg.coinsSpace', { coins }) : '' }),
        buttonLabel: tn('tg.btnChallenges'),
        url: `${SITE_URL}/?challenges=1`,
      }
    }
    case 'challenge_deadline_soon': {
      const hours = (notification.payload?.hours as number | undefined) ?? 48
      return { text: tn('tg.challengeDeadline', { hours }), buttonLabel: tn('tg.btnChallenges'), url: `${SITE_URL}/?challenges=1` }
    }
    case 'hot_sector_week': {
      const sectors = (notification.payload?.sectors as string[] | undefined) ?? []
      if (!sectors.length) return null
      const city = tn(IN_CITY[cityForSectorId(sectors[0])])
      return { text: tn('tg.hotWeek', { city, sectors: sectors.join(tn('tg.and')) }), ...sector(sectors[0]) }
    }
    case 'hot_sector_won': {
      const coins = (notification.payload?.coins as number | undefined) ?? 100
      if (!notification.territory_id) return null
      return { text: tn('tg.hotWon', { id: notification.territory_id, coins }), buttonLabel: tn('tg.btnProfile'), url: SITE_URL }
    }
    case 'legend_gained': {
      const n = (notification.payload?.catches as number | undefined) ?? 0
      if (!notification.territory_id) return null
      return { text: tn('tg.legendGained', { id: notification.territory_id, catches: `${n} ${pluralCatches(n)}` }), ...sector(notification.territory_id) }
    }
    case 'legend_lost':
      if (!notification.territory_id) return null
      return { text: tn('tg.legendLost', { actor: actorName, id: notification.territory_id }), ...sector(notification.territory_id) }
    case 'admin_gift': {
      // A super admin's gift (admin_gift): their message if they wrote one,
      // then what was given.
      const coins = Number(notification.payload?.coins ?? 0)
      const spins = Number(notification.payload?.spins ?? 0)
      const note = typeof notification.payload?.note === 'string' ? notification.payload.note : ''
      const amounts = [coins > 0 ? `+${tn('common.coins', { count: coins })}` : null, spins > 0 ? tn('tg.bonusSpins', { count: spins }) : null].filter(Boolean).join(tn('tg.and'))
      if (!amounts) return null
      return { text: note ? tn('tg.giftWithNote', { note, amounts }) : tn('tg.gift', { amounts }), ...rangeBtn }
    }
    case 'support_reply': {
      // A nudge into the support chat, not the answer itself (decided 06.10).
      const ticketId = notification.payload?.ticket_id as number | undefined
      return { text: tn('tg.supportReply'), buttonLabel: tn('tg.btnGo'), url: ticketId ? `${SITE_URL}/?support=${ticketId}` : SITE_URL }
    }
    case 'sector_attacked': {
      if (!notification.territory_id) return null
      const defense = Number(notification.payload?.defense ?? 0)
      return {
        text: tn(defense > 0 ? 'tg.attacked' : 'tg.attackedDown', { actor: actorName, id: notification.territory_id, defense }),
        ...sector(notification.territory_id),
      }
    }
    case 'bite_forecast': {
      const score = notification.payload?.score as number | undefined
      const city = tn(IN_CITY[asCityId(notification.payload?.city)])
      const from = notification.payload?.from as string | undefined
      const to = notification.payload?.to as string | undefined
      if (!score) return null
      return {
        text: tn('tg.forecast', {
          city,
          quality: score >= 5 ? tn('tg.forecastGreat') : tn('tg.forecastGood'),
          score,
          best: from && to ? tn('tg.forecastBest', { from, to }) : '',
        }),
        buttonLabel: tn('tg.btnForecast'),
        url: SITE_URL,
      }
    }
    case 'geo_bonus': {
      // «Где это?»'s quest done: a catch in the day's panorama sector.
      const coins = Number(notification.payload?.coins ?? 50)
      return {
        text: tn('tg.geoBonus', { id: notification.territory_id ?? '', coins: tn('common.coins', { count: coins }) }),
        buttonLabel: tn('tg.btnRange'),
        url: `${SITE_URL}/?geo=1`,
      }
    }
    case 'catch_edited': {
      // Super admins: a player changed the numbers of their catch (edit_my_catch).
      // Stays in Russian — the super admin reads Russian.
      if (!notification.catch_id) return null
      const changes = Array.isArray(notification.payload?.changes) ? (notification.payload.changes as string[]).join('; ') : ''
      const species = notification.payload?.species as string | undefined
      return {
        text: `✏️ ${actorName} изменил улов${species ? ` (${species})` : ''}${notification.territory_id ? ` на секторе ${notification.territory_id}` : ''}${changes ? `: ${changes}` : ''}`,
        buttonLabel: 'Посмотреть улов',
        url: `${SITE_URL}/?catch=${notification.catch_id}`,
      }
    }
    case 'daily_reward_reminder': {
      const day = notification.payload?.day as number | undefined
      const coins = notification.payload?.coins as number | undefined
      return {
        text: tn('tg.dailyReminder', { day: day ? tn('tg.dailyDay', { day }) : '', coins: coinsDash(coins) }),
        buttonLabel: tn('tg.btnReward'),
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
  if (!isCronRequest(req)) {
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

  // Each person's language (profiles.language, set when they pick one in the
  // app; empty means Russian). Read apart from the main query so a database
  // without the column yet just sends Russian, as before.
  const langs = new Map<string, Lang>()
  const userIds = [...new Set(due.map((r) => first(r.notifications as NotificationRef | NotificationRef[])?.user_id).filter((id): id is string => !!id))]
  const { data: langRows } = await admin.from('profiles').select('id, language').in('id', userIds)
  for (const r of (langRows ?? []) as unknown as { id: string; language: string | null }[]) if (isLang(r.language)) langs.set(r.id, r.language)

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

    // renderMessage is synchronous, so setting the language right before it is safe.
    setCurrentLanguage(langs.get(notification.user_id) ?? 'ru')
    const message = renderMessage(notification)

    if (!message) {
      setCurrentLanguage('ru')
      await admin.from('telegram_outbox').update({ sent_at: new Date().toISOString(), last_error: 'nothing to render' }).eq('id', row.id)
      continue
    }

    const owner = first(notification.owner)
    const explain = !!owner?.tg_auto_enabled_at && !owner.tg_auto_notice_at && !noticed.has(notification.user_id)
    const text = explain ? `${message.text}\n\n${tn('tg.autoOn')}` : message.text
    // Back to Russian before the first await, so nothing else in this server
    // process ever sees a language set for one message.
    setCurrentLanguage('ru')

    const send = (extra: { text: string; url: string }[]) =>
      fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: row.chat_id,
          text,
          reply_markup: {
            inline_keyboard: [[{ text: message.buttonLabel, web_app: { url: message.url } }], ...extra.map((b) => [{ text: b.text, url: b.url }])],
          },
        }),
      })
    let res = await send(message.extraButtons ?? [])
    // A tg://user link can be refused (the person's privacy settings); the alert itself must still arrive.
    if (res.status === 400 && message.extraButtons?.length) res = await send([])

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

  setCurrentLanguage('ru')
  return NextResponse.json({ sent, blocked })
}

export const GET = withErrorReport('telegram/send-notifications', handleGET)
