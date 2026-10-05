import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { pluralCatches } from '@/lib/format'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// The onboarding chain — Telegram nudges until the first catch (see
// onboarding_due for who gets which step and when: 10:00–21:00 city time,
// at most one a day, each step once, stopping at the first catch or /stop).
// Polled by pg_cron every 15 minutes (switched on in the release migration).

type Due = { chat_id: number; user_id: string | null; step: string; city: string | null; name: string | null; data: Record<string, unknown> | null }

const CITY_IN: Record<string, string> = { batumi: 'Батуми', moscow: 'Москве' }

function text(d: Due): string {
  const city = CITY_IN[d.city ?? 'batumi'] ?? 'Батуми'
  const hi = d.name ? `${d.name}, ` : ''
  const data = d.data ?? {}
  switch (d.step) {
    case 'new_2h': {
      const free = Number(data.free ?? 0)
      const sector = data.sector ? String(data.sector) : null
      const n = Number(data.sector_catches ?? 0)
      return [
        `🎣 ${hi}на карте в ${city} сейчас ${free} свободных секторов — любой станет твоим с первым уловом.`,
        sector ? `Самое живое место недели — сектор ${sector}: ${n} ${pluralCatches(n)} за 7 дней.` : null,
        'Сфотографируй рыбу на месте — и сектор твой.',
      ]
        .filter(Boolean)
        .join('\n\n')
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

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
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
