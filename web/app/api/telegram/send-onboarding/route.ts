import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/cronAuth'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { pluralCatches } from '@/lib/format'
import { withErrorReport } from '@/lib/serverErrors'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// The onboarding chain — Telegram nudges until the first catch (see
// onboarding_due for who gets which step and when: 10:00–21:00 city time,
// at most one a day, each step once, stopping at the first catch or /stop).
// Polled by pg_cron every 15 minutes (switched on in the release migration).

type Due = { chat_id: number; user_id: string | null; step: string; city: string | null; name: string | null; data: Record<string, unknown> | null }

const CITY_IN: Record<string, string> = { batumi: 'Батуми', moscow: 'Москве и МО', spb: 'Петербурге', sochi: 'Сочи', tbilisi: 'Тбилиси' }

function text(d: Due): string {
  const city = CITY_IN[d.city ?? 'batumi'] ?? 'Батуми'
  const hi = d.name ? `${d.name}, ` : ''
  const data = d.data ?? {}
  switch (d.step) {
    case 'new_2h':
    case 'new_day3': {
      const free = Number(data.free ?? 0)
      const sector = data.sector ? String(data.sector) : null
      const n = Number(data.sector_catches ?? 0)
      // «Задание новичка»: the first catch within 7 days of signing up pays triple and brings a shield.
      const until = data.until ? String(data.until) : null
      return [
        d.step === 'new_day3'
          ? `🎣 ${hi}до ${until ?? 'конца недели'} первый улов приносит втрое больше монет и щит в запас. Осталось 4 дня.`
          : `🎣 ${hi}на карте в ${city} сейчас ${free} свободных секторов — любой станет твоим с первым уловом.`,
        d.step === 'new_day3' ? `Свободных секторов в ${city}: ${free}.` : null,
        sector ? `Самое живое место недели — сектор ${sector}: ${n} ${pluralCatches(n)} за 7 дней.` : null,
        d.step === 'new_2h' && until ? `Задание новичка: поймай первую рыбу до ${until} — монеты за неё втрое и щит в запас.` : null,
        'Сфотографируй рыбу на месте — и сектор твой.',
      ]
        .filter(Boolean)
        .join('\n\n')
    }
    case 'new_day6': {
      const until = data.until ? String(data.until) : null
      return `⏳ ${hi}последний день задания новичка${until ? ` — до ${until}` : ''}.\n\nПервый улов сейчас = сектор на карте, монеты за рыбу втрое и щит в запас. Потом бонус сгорит.`
    }
    case 'new_friday':
      return 'Завтра суббота — главный рыбацкий день 🎣\n\nПоймай первую рыбу на выходных: сектор сразу станет твоим, а за улов придут монеты.'
    case 'new_day7':
    case 'old_friday': {
      const n = Number(data.catches ?? 0)
      const best = data.best_species && data.best_cm ? `, самая крупная — ${data.best_species} ${data.best_cm} см` : ''
      const lead = d.step === 'old_friday' ? 'Выходные близко 🎣' : `Неделя в ${city} 🎣`
      return `${lead}\n\nЗа 7 дней в ${city} — ${n} ${pluralCatches(n)}${best}. Твой первый улов ещё впереди: сфотографируй его, и сектор твой.`
    }
    case 'new_day14':
      return 'Первый улов = твой сектор на карте и монеты 🎣\n\nНа монеты в магазине — рамки, фоны и скины секторов. Выходи на воду и займи свой.'
    case 'start_day1':
      return 'Регистрация в RANGE занимает минуту: открой приложение, выбери город — и лови 🎣\n\nПервый улов = твой сектор на карте.'
    case 'start_day4':
      return 'Рыбаки уже делят Батуми и Москву на сектора 🎣\n\nЗайми свой: регистрация за минуту, первый улов — и сектор твой.'
    default:
      return ''
  }
}

async function handleGET(req: Request) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('onboarding_due', { p_limit: 100 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const due = (data ?? []) as Due[]

  let sent = 0
  let blocked = 0
  for (const d of due) {
    const body = text(d)
    if (!body) continue
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: d.chat_id,
        text: body,
        reply_markup: { inline_keyboard: [[{ text: '🎣 Открыть RANGE', web_app: { url: SITE_URL } }]] },
      }),
    })
    if (res.status === 429) break // rate limited: the rest go next poll
    // Recorded even when undeliverable, so a step is never retried forever.
    await admin.from('onboarding_messages').upsert({ chat_id: d.chat_id, step: d.step, user_id: d.user_id }, { onConflict: 'chat_id,step', ignoreDuplicates: true })
    if (res.ok) {
      sent++
    } else if (res.status === 403) {
      // Blocked the bot: no message will reach this chat again.
      blocked++
      if (d.user_id) {
        await admin.from('profiles').update({ tg_unreachable_at: new Date().toISOString(), tg_notifications_enabled: false }).eq('id', d.user_id)
      } else {
        await admin.from('telegram_bot_starts').update({ stopped_at: new Date().toISOString() }).eq('chat_id', d.chat_id)
      }
    }
  }
  return NextResponse.json({ due: due.length, sent, blocked })
}

export const GET = withErrorReport('telegram/send-onboarding', handleGET)
