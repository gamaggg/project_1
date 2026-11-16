// The bot's side of TelegramWidget.request() (Bot API 10.4 widget_query): a chat
// widget asks for the live state when it appears, the webhook answers here with
// answerWidgetQuery within Telegram's 15 seconds. The asker is Telegram's own
// `from` (the webhook already checks Telegram's secret header); what a widget
// sends is only a hint of what to look up, never trusted for who is asking.
//   «s:<sector>»  → the sector now: {m:1} it is yours again, or {m:0,n,d} who holds it and the defense
//   «r:<clan id>» → the clan battle of that clan's city, as the race widget reads it (asker must be in the clan)
//   «c:<catch id>» → the run of catches that catch belongs to, now (a friend's catches the asker was told about)

import { createAdminClient } from '@/lib/supabase/admin'
import { asCityId } from '@/lib/data/city'
import { catchSeriesData, cityRace } from '@/lib/telegram/widgets/build'
import { isLang } from '@/lib/i18n/core'
import { clipBytes } from '@/lib/telegram/widgets/core'

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

type WidgetQuery = { id: string; from?: { id: number }; data?: string }

async function lookUp(q: WidgetQuery): Promise<string | null> {
  const telegramId = q.from?.id
  const data = typeof q.data === 'string' ? q.data : ''
  if (!telegramId || !data) return null
  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle()
  const meId = (me as { id: string } | null)?.id
  if (!meId) return null

  if (data.startsWith('s:')) {
    const sectorId = data.slice(2, 24)
    const { data: t } = await admin.from('territories').select('owner_id, defense').eq('id', sectorId).maybeSingle()
    const row = t as { owner_id: string | null; defense: number | null } | null
    if (!row) return null
    if (row.owner_id === meId) return JSON.stringify({ m: 1, d: row.defense ?? 0 })
    if (!row.owner_id) return null
    const { data: owner } = await admin.from('profiles').select('display_name').eq('id', row.owner_id).maybeSingle()
    return JSON.stringify({ m: 0, n: clipBytes((owner as { display_name: string | null } | null)?.display_name ?? '', 60), d: row.defense ?? 0 })
  }

  if (data.startsWith('r:')) {
    const clanId = Number(data.slice(2))
    if (!clanId) return null
    // clan_members / clans are not in the generated types.
    const loose = admin as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { is: (c: string, v: null) => { maybeSingle: () => Promise<{ data: unknown }> } } } } }
    }
    const { data: member } = await loose.from('clan_members').select('clan_id, clans(city)').eq('user_id', meId).eq('clan_id', clanId).is('left_at', null).maybeSingle()
    const clans = (member as { clans: { city: string } | { city: string }[] | null } | null)?.clans
    const city = Array.isArray(clans) ? clans[0]?.city : clans?.city
    if (!city) return null
    return cityRace(admin, asCityId(city), clanId)
  }
  if (data.startsWith('c:')) {
    const catchId = Number(data.slice(2))
    if (!catchId) return null
    const { data: c } = await admin.from('catches').select('user_id, caught_at').eq('id', catchId).maybeSingle()
    const row = c as { user_id: string; caught_at: string } | null
    if (!row) return null
    const { data: lp } = await admin.from('profiles').select('language').eq('id', meId).maybeSingle()
    const lang = (lp as { language: string | null } | null)?.language
    // The run from that catch on, so the widget shows the ones that came after its message too.
    return catchSeriesData(admin, row.user_id, new Date(Math.max(Date.parse(row.caught_at), Date.now() - 6 * 3_600_000)).toISOString(), isLang(lang) ? lang : 'ru', catchId)
  }
  return null
}

export async function answerWidgetQuery(q: WidgetQuery): Promise<void> {
  const result = await lookUp(q).catch(() => null)
  await fetch(`${TELEGRAM_API}/answerWidgetQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    // The widget gets {result} — «null» when there is nothing to show.
    body: JSON.stringify({ widget_query_id: q.id, data: result && new TextEncoder().encode(result).length <= 1024 ? result : 'null' }),
  }).catch(() => undefined)
}
