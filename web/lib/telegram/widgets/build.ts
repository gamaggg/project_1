// Which notifications go out as chat widgets, and the data for each (server
// side: send-notifications and the webhook's widget_query answers).
//
// Off unless switched on in the environment, so nothing changes for players
// until the owner says so:
//   TG_WIDGETS        — kinds, comma-separated: sector, race, forecast, rating,
//                       daily, hot, catches (or «all»); empty = off
//   TG_WIDGETS_CHATS  — Telegram chat ids, comma-separated; when set, only these
//                       chats get widgets (a trial on the owner's phone first)

import { createAdminClient } from '@/lib/supabase/admin'
import { CITIES, asCityId, cityForSectorId, type CityId } from '@/lib/data/city'
import { fetchRawForecast, nowInZone, scoreForecast, type ForecastDay } from '@/lib/forecast/bite'
import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import type { AroundHex, BuiltWidget, WidgetKind } from './core'
import { sectorChatData, sectorWidgetHtml } from './sector'
import { lanesFromRace, raceChatData, raceWidgetHtml } from './race'
import { forecastChatData, forecastWidgetHtml } from './forecast'
import { ratingChatData, ratingWidgetHtml, type RatingRow } from './rating'
import { dailyChatData, dailyWidgetHtml } from './daily'
import { hotChatData, hotWidgetHtml, type HotSector } from './hot'
import { catchesChatData, catchesWidgetHtml, type SeriesCatch } from './catches'
import { CATEGORY_GRADIENT, KIND_LABEL, localSpeciesNameLoose } from '@/lib/data/species'
import { formatWeekdayTime } from '@/lib/i18n/format'

type Admin = ReturnType<typeof createAdminClient>

const KIND_OF: Record<string, WidgetKind> = {
  sector_lost: 'sector',
  sector_attacked: 'sector',
  clan_war_started: 'race',
  clan_race_overtaken: 'race',
  clan_race_result: 'race',
  clan_race_finished: 'race',
  bite_forecast: 'forecast',
  sector_forecast: 'forecast',
  rating_overtaken: 'rating',
  weekly_result: 'rating',
  daily_reward_reminder: 'daily',
  hot_sector_week: 'hot',
  follow_catch: 'catches',
  // Not a notification: «Ещё на рыбалке?» from lib/telegram/fishing.ts.
  fishing_reminder: 'catches',
}

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export function widgetKindFor(notificationKind: string, chatId: number | string): WidgetKind | null {
  const kind = KIND_OF[notificationKind]
  if (!kind) return null
  const on = list(process.env.TG_WIDGETS)
  if (!on.includes('all') && !on.includes(kind)) return null
  const chats = list(process.env.TG_WIDGETS_CHATS)
  if (chats.length && !chats.includes(String(chatId))) return null
  return kind
}

const templates = new Map<string, string>()
export function widgetTemplate(kind: WidgetKind, lang: Lang): string {
  const key = `${kind}:${lang}`
  let html = templates.get(key)
  if (!html) {
    const make = { sector: sectorWidgetHtml, race: raceWidgetHtml, forecast: forecastWidgetHtml, rating: ratingWidgetHtml, daily: dailyWidgetHtml, hot: hotWidgetHtml, catches: catchesWidgetHtml }[kind]
    html = make(lang)
    templates.set(key, html)
  }
  return html
}

export type WidgetNotification = {
  kind: string
  catch_id?: number | null
  territory_id: string | null
  user_id: string
  actor_id: string | null
  created_at?: string | null
  payload: Record<string, unknown> | null
}

type Person = { display_name: string | null; territory_color: string | null }

async function people(admin: Admin, ids: string[]): Promise<Map<string, Person>> {
  const { data } = await admin.from('profiles').select('id, display_name, territory_color').in('id', ids)
  return new Map(((data ?? []) as unknown as (Person & { id: string })[]).map((p) => [p.id, p]))
}

function clock(iso: string | null | undefined, city: CityId | null): string {
  if (!iso) return ''
  return hhmm(Date.parse(iso), city ? CITIES[city].timezone : 'UTC')
}

const hhmm = (at: number, timeZone: string) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)

// How far a city's clock is from UTC now, ms (the game's cities have no summer time).
function zoneOffsetMs(timeZone: string): number {
  const now = Date.now()
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]))
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute))
  return Math.round((local - now) / 60_000) * 60_000
}

// The week as get_weekly_leaderboard counts it: Monday 00:00 to Monday 00:00 in the city's time.
function weekRange(timeZone: string, offsetWeeks: number): { start: Date; end: Date; monday: Date } {
  const off = zoneOffsetMs(timeZone)
  const local = new Date(Date.now() + off)
  const todayUTC = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const monday = new Date(todayUTC - ((new Date(todayUTC).getUTCDay() + 6) % 7) * 86_400_000 + offsetWeeks * 7 * 86_400_000)
  const start = new Date(monday.getTime() - off)
  return { start, end: new Date(start.getTime() + 7 * 86_400_000), monday }
}

// «Ноябрь, 3 неделя» (formatWeekOfMonth) in the player's language.
function weekLabel(lang: Lang, monday: Date): string {
  const first = Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), 1)
  const week = Math.floor((monday.getTime() - first) / (7 * 86_400_000)) + 1
  return translate(lang, 'fmt.weekOfMonth', { month: translate(lang, 'fmt.months').split('|')[monday.getUTCMonth()], week })
}

// The week's rating of a city by get_weekly_leaderboard's rule (sectors, then catches, then the older account),
// counted here because that function answers only a signed-in player.
async function weekBoard(admin: Admin, city: CityId, offsetWeeks: number): Promise<{ rows: { userId: string; name: string; sectors: number; catches: number; rank: number }[]; monday: Date }> {
  const { timezone, idPrefix } = CITIES[city]
  const { start, end, monday } = weekRange(timezone, offsetWeeks)
  const loose = admin as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }> }
  const { data: sec } = await loose.rpc('_weekly_sector_counts', { p_week_start: start.toISOString(), p_week_end: end.toISOString(), p_city_prefix: idPrefix })
  const { data: cat } = await admin.from('catches').select('user_id').gte('caught_at', start.toISOString()).lt('caught_at', end.toISOString()).like('territory_id', `${idPrefix}%`).limit(50_000)
  const sectors = new Map<string, number>()
  for (const r of (sec ?? []) as { uid: string; cnt: number }[]) sectors.set(r.uid, Number(r.cnt))
  const catches = new Map<string, number>()
  for (const r of (cat ?? []) as { user_id: string }[]) catches.set(r.user_id, (catches.get(r.user_id) ?? 0) + 1)
  const ids = [...new Set([...sectors.keys(), ...catches.keys()])]
  if (!ids.length) return { rows: [], monday }
  const { data: profs } = await admin.from('profiles').select('id, display_name, created_at').in('id', ids)
  const rows = ((profs ?? []) as { id: string; display_name: string | null; created_at: string }[])
    .map((p) => ({ userId: p.id, name: p.display_name ?? '', sectors: sectors.get(p.id) ?? 0, catches: catches.get(p.id) ?? 0, created: Date.parse(p.created_at) }))
    .sort((a, b) => b.sectors - a.sectors || b.catches - a.catches || a.created - b.created)
    .map((r, i) => ({ userId: r.userId, name: r.name, sectors: r.sectors, catches: r.catches, rank: i + 1 }))
  return { rows, monday }
}

// A run of one angler's catches around a moment, as «Активность» groups them: catches less than 3 hours apart.
async function catchSeries(admin: Admin, userId: string, around: string, lang: Lang): Promise<{ items: SeriesCatch[]; sectorId: string | null; first: string; last: string } | null> {
  const t = Date.parse(around)
  const { data } = await admin
    .from('catches')
    .select('id, territory_id, species, length_cm, weight_kg, caught_at')
    .eq('user_id', userId)
    .gte('caught_at', new Date(t - 12 * 3_600_000).toISOString())
    .lte('caught_at', new Date(Date.now() + 60_000).toISOString())
    .order('caught_at', { ascending: false })
    .limit(30)
  const all = (data ?? []) as { id: number; territory_id: string | null; species: string | null; length_cm: number | null; weight_kg: number | null; caught_at: string }[]
  if (!all.length) return null
  // Walk back from the newest: a gap of 3 hours ends the run.
  const run = [all[0]]
  for (let i = 1; i < all.length && Date.parse(run[run.length - 1].caught_at) - Date.parse(all[i].caught_at) < 3 * 3_600_000; i++) run.push(all[i])
  const { data: sp } = await admin.from('species').select('name, category').in('name', [...new Set(run.map((c) => c.species ?? ''))])
  const cat = new Map(((sp ?? []) as { name: string; category: string }[]).map((s) => [s.name, s.category]))
  const tz = CITIES[cityForSectorId(run[0].territory_id ?? '') ?? 'batumi'].timezone
  const items: SeriesCatch[] = run.map((c) => ({
    species: c.species ? localSpeciesNameLoose(c.species) : '',
    meta: [c.length_cm ? `${c.length_cm} ${translate(lang, 'fmt.cm')}` : '', c.weight_kg ? `${Math.round(Number(c.weight_kg) * 1000)} ${translate(lang, 'fmt.g')}` : ''].filter(Boolean).join(' · '),
    time: hhmm(Date.parse(c.caught_at), tz),
    category: (cat.get(c.species ?? '') ?? 'marine') in CATEGORY_GRADIENT ? (cat.get(c.species ?? '') as SeriesCatch['category']) ?? 'marine' : 'marine',
  }))
  return { items, sectorId: run[0].territory_id, first: hhmm(Date.parse(run[run.length - 1].caught_at), tz), last: hhmm(Date.parse(run[0].caught_at), tz) }
}

// The series widget's data (follow_catch, «Ещё на рыбалке?»): who, the run, «Сегодня · 08:30–10:06».
export async function catchSeriesData(admin: Admin, userId: string, around: string, lang: Lang, catchId?: number): Promise<string | null> {
  const run = await catchSeries(admin, userId, around, lang)
  if (!run) return null
  const { data: who } = await admin.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  let kind: string | null = null
  let claimed = false
  if (run.sectorId) {
    const { data: t } = await admin.from('territories').select('kind, owner_id').eq('id', run.sectorId).maybeSingle()
    const row = t as { kind: keyof typeof KIND_LABEL; owner_id: string | null } | null
    kind = row?.kind ? translate(lang, `kind.${row.kind}` as TKey) : null
    claimed = row?.owner_id === userId
  }
  const today = translate(lang, 'fmt.today')
  return catchesChatData({
    who: (who as { display_name: string | null } | null)?.display_name ?? translate(lang, 'common.angler'),
    sectorId: run.sectorId,
    kind,
    claimed,
    when: run.items.length > 1 ? `${today} · ${run.first}–${run.last}` : `${today} · ${run.last}`,
    items: run.items,
    catchId,
  })
}

// The map round some sectors, for a widget scene: every sector near them at its real place, in
// px from the middle of `centre` at the widget's hexagon size (`radius` px). The grid is regular,
// so the hexagon's size in metres is the distance to the nearest neighbour / √3 (corners are in the
// map files, not in the database). Colours as the map paints them: the player's own sectors in their
// colour, others' in the holder's colour (the "someone else" blue if none), free ones grey (0).
async function mapAround(
  admin: Admin,
  centre: string[],
  playerId: string,
  radius: number,
  box: { left: number; right: number; top: number; bottom: number },
): Promise<{ hexes: AroundHex[]; at: Map<string, [number, number]> }> {
  const empty = { hexes: [], at: new Map<string, [number, number]>() }
  const { data: cs } = await admin.from('territories').select('id, lat, lng').in('id', centre)
  const mids = (cs ?? []) as { id: string; lat: number; lng: number }[]
  if (!mids.length) return empty
  const lat0 = mids.reduce((a, c) => a + c.lat, 0) / mids.length
  const lng0 = mids.reduce((a, c) => a + c.lng, 0) / mids.length
  const { data: near } = await admin
    .from('territories')
    .select('id, lat, lng, owner_id')
    .eq('is_deleted', false)
    .gte('lat', lat0 - 0.02)
    .lte('lat', lat0 + 0.02)
    .gte('lng', lng0 - 0.026)
    .lte('lng', lng0 + 0.026)
    .limit(400)
  const rows = (near ?? []) as { id: string; lat: number; lng: number; owner_id: string | null }[]
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111_320
  const m = (r: { lat: number; lng: number }): [number, number] => [(r.lng - lng0) * kx, -(r.lat - lat0) * 110_540]
  const first = m(mids[0])
  let step = Infinity
  for (const r of rows) {
    const [x, y] = m(r)
    const d = Math.hypot(x - first[0], y - first[1])
    if (d > 1 && d < step) step = d
  }
  const scale = radius / (Number.isFinite(step) ? step / Math.sqrt(3) : 344)
  const at = new Map<string, [number, number]>()
  const placed = rows
    .map((r) => {
      const [x, y] = m(r)
      return { r, px: Math.round(x * scale), py: Math.round(y * scale) }
    })
    .filter(({ px, py }) => px >= box.left && px <= box.right && py >= box.top && py <= box.bottom)
    .sort((a, b) => Math.hypot(a.px, a.py) - Math.hypot(b.px, b.py))
  for (const p of placed) if (centre.includes(p.r.id)) at.set(p.r.id, [p.px, p.py])
  const others = placed.filter((p) => !centre.includes(p.r.id)).slice(0, 14)
  const owners = [...new Set(others.map((p) => p.r.owner_id).filter((x): x is string => !!x)), playerId]
  const who = await people(admin, owners)
  const mine = who.get(playerId)?.territory_color
  const hexes: AroundHex[] = others.map(({ r, px, py }) => [
    px,
    py,
    !r.owner_id ? 0 : r.owner_id === playerId ? (mine ?? '#2FA84F') : (who.get(r.owner_id)?.territory_color ?? '#3E7BFA'),
    r.id,
  ])
  return { hexes, at }
}

// The race of a city right now, as lanes (get_clan_race works for the service role; its «my_*» fields stay empty).
export async function cityRace(admin: Admin, city: CityId, myClanId: number | null): Promise<string | null> {
  const { data, error } = await admin.rpc('get_clan_race', { p_city: city })
  if (error || !data) return null
  const r = data as Record<string, unknown>
  return raceChatData({ weekEnd: String(r.week_end ?? ''), myClanId, clans: lanesFromRace(r.clans) })
}

// A forecast per point is counted once per run (one evening's messages share it).
const forecastCache = new Map<string, Promise<ForecastDay[]>>()
function daysAt(lat: number, lng: number, tz: string, sea: [number, number] | null): Promise<ForecastDay[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${sea ? 's' : ''}`
  let p = forecastCache.get(key)
  if (!p) {
    p = fetchRawForecast({ lat, lng }, tz, sea ? { lat: sea[0], lng: sea[1] } : null).then((raw) => scoreForecast(raw, null, nowInZone(tz, Date.now())))
    forecastCache.set(key, p)
    p.catch(() => forecastCache.delete(key))
  }
  return p
}

function dayLabel(lang: Lang, date: string, tz: string): string {
  const today = nowInZone(tz, Date.now()).slice(0, 10)
  const tomorrow = nowInZone(tz, Date.now() + 86_400_000).slice(0, 10)
  const at = new Date(`${date}T12:00:00`)
  const dm = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(at)
  const name = date === today ? translate(lang, 'forecast.today') : date === tomorrow ? translate(lang, 'forecast.tomorrow') : new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(at)
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} · ${dm}`
}

// The widget for one notification, or null (then the plain message goes out).
export async function buildWidget(admin: Admin, n: WidgetNotification, lang: Lang, chatId: number | string): Promise<BuiltWidget | null> {
  const kind = widgetKindFor(n.kind, chatId)
  if (!kind) return null
  const p = n.payload ?? {}

  if (kind === 'sector') {
    if (!n.territory_id) return null
    const { data: t } = await admin.from('territories').select('owner_id, defense').eq('id', n.territory_id).maybeSingle()
    const sectorNow = t as { owner_id: string | null; defense: number | null } | null
    const who = await people(admin, [n.user_id, ...(n.actor_id ? [n.actor_id] : []), ...(sectorNow?.owner_id ? [sectorNow.owner_id] : [])])
    const me = who.get(n.user_id)
    const by = n.actor_id ? who.get(n.actor_id) : undefined
    return {
      kind,
      html: widgetTemplate(kind, lang),
      allowQueries: true,
      chatData: sectorChatData({
        kind: n.kind === 'sector_lost' ? 'lost' : 'attacked',
        sectorId: n.territory_id,
        by: { name: by?.display_name ?? null, color: by?.territory_color ?? null },
        me: { name: me?.display_name ?? null, color: me?.territory_color ?? null },
        defense: Number(p.defense ?? 0),
        when: clock(n.created_at, cityForSectorId(n.territory_id)),
        now: sectorNow?.owner_id
          ? { mine: sectorNow.owner_id === n.user_id, name: who.get(sectorNow.owner_id)?.display_name ?? null, defense: sectorNow.defense ?? 0 }
          : null,
      }),
    }
  }

  if (kind === 'race') {
    const clanId = Number(p.clan_id)
    if (!clanId) return null
    // clans is not in the generated types.
    const loose = admin as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: number) => { maybeSingle: () => Promise<{ data: unknown }> } } } }
    const { data: clan } = await loose.from('clans').select('city').eq('id', clanId).maybeSingle()
    const city = clan ? asCityId((clan as { city: string }).city) : null
    if (!city) return null
    const chatData = await cityRace(admin, city, clanId)
    return chatData ? { kind, html: widgetTemplate(kind, lang), allowQueries: true, chatData } : null
  }

  if (kind === 'rating') {
    const lastWeek = n.kind === 'weekly_result'
    let city: CityId | null = typeof p.city === 'string' ? asCityId(p.city) : null
    if (!city) {
      const { data: me } = await admin.from('profiles').select('city').eq('id', n.user_id).maybeSingle()
      city = asCityId((me as { city: string | null } | null)?.city)
    }
    const { rows, monday } = await weekBoard(admin, city, lastWeek ? -1 : 0)
    const mine = rows.find((r) => r.userId === n.user_id)
    if (!rows.length) return null
    const toRow = (r: (typeof rows)[number]): RatingRow => ({ rank: r.rank, name: r.name, sectors: r.sectors, catches: r.catches, me: r.userId === n.user_id })
    const top = rows.slice(0, 3).map(toRow)
    // This week: the one now just ahead, the player, the one behind. Last week: the next places and the player's own.
    let rest = lastWeek ? rows.slice(3, 5) : mine ? rows.slice(Math.max(3, mine.rank - 2), mine.rank + 1) : []
    if (lastWeek && mine && mine.rank > 5) rest = [rows[3], mine]
    return { kind, html: widgetTemplate(kind, lang), allowQueries: false, chatData: ratingChatData({ lastWeek, weekLabel: weekLabel(lang, monday), top, rows: rest.map(toRow) }) }
  }

  if (kind === 'daily') {
    const loose = admin as unknown as { rpc: (f: string) => Promise<{ data: unknown }> }
    const { data: amounts } = await loose.rpc('_daily_reward_amounts')
    const list = Array.isArray(amounts) ? (amounts as number[]) : [10, 15, 20, 25, 30, 35, 40, 50, 60, 100]
    return { kind, html: widgetTemplate(kind, lang), allowQueries: false, chatData: dailyChatData(Number(p.day ?? 1), list, false) }
  }

  if (kind === 'hot') {
    const ids = ((p.sectors as string[] | undefined) ?? []).slice(0, 2)
    if (!ids.length) return null
    const { data: ts } = await admin.from('territories').select('id, owner_id').in('id', ids)
    const owners = new Map(((ts ?? []) as { id: string; owner_id: string | null }[]).map((t) => [t.id, t.owner_id]))
    const ownerIds = [...owners.values()].filter((x): x is string => !!x)
    const who = ownerIds.length ? await people(admin, ownerIds) : new Map<string, Person>()
    const sectors: HotSector[] = ids.map((id) => {
      const owner = owners.get(id) ?? null
      const person = owner ? who.get(owner) : undefined
      return { id, holder: !owner ? 'free' : owner === n.user_id ? 'mine' : 'other', name: person?.display_name ?? null, color: person?.territory_color ?? null }
    })
    const city = cityForSectorId(ids[0]) ?? 'batumi'
    const until = typeof p.until === 'string' ? formatWeekdayTime(p.until, lang, CITIES[city].timezone) : ''
    // Only where the two stand to each other; the sectors around are not drawn (owner's choice 17.11).
    const map = await mapAround(admin, ids, n.user_id, 40, { left: -200, right: 200, top: -120, bottom: 120 }).catch(() => null)
    const placed = sectors.map((s) => ({ ...s, at: map?.at.get(s.id) }))
    return { kind, html: widgetTemplate(kind, lang), allowQueries: false, chatData: hotChatData(placed, until) }
  }

  if (kind === 'catches') {
    if (!n.actor_id || !n.created_at) return null
    const chatData = await catchSeriesData(admin, n.actor_id, n.created_at, lang, n.catch_id ?? undefined)
    return chatData ? { kind, html: widgetTemplate(kind, lang), allowQueries: true, chatData } : null
  }

  // forecast
  const sectorId = n.kind === 'sector_forecast' ? String(p.territory_id ?? n.territory_id ?? '') : ''
  const city = sectorId ? cityForSectorId(sectorId) : asCityId(p.city)
  if (!city) return null
  const info = CITIES[city]
  let point: [number, number] = info.center
  let sea = info.seaPoint
  if (sectorId) {
    const { data: t } = await admin.from('territories').select('lat, lng, kind').eq('id', sectorId).maybeSingle()
    const row = t as { lat: number; lng: number; kind: string } | null
    if (row) {
      point = [row.lat, row.lng]
      sea = row.kind === 'sea' ? point : null
    }
  }
  const days = await daysAt(point[0], point[1], info.timezone, sea)
  const date = typeof p.date === 'string' ? p.date : null
  const day = (date && days.find((d) => d.date === date)) || days[1]
  if (!day) return null
  const kicker = sectorId || translate(lang, `city.${city}Name` as TKey)
  return { kind, html: widgetTemplate(kind, lang), allowQueries: false, chatData: forecastChatData(day, lang, kicker, dayLabel(lang, day.date, info.timezone)) }
}
