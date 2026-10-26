import type { Catch } from '@/lib/data/types'
import type { SpeciesCategory } from '@/lib/data/species'
import { currentLocale, tn } from '@/lib/i18n/runtime'

export type SpeciesEntry = {
  key: string
  name: string
  category: SpeciesCategory
  count: number
  photoUrl: string
  /** The newest catch of the species (what a tap opens by default). */
  lastCatchId: number
  lastAt: string
  firstAt: string
  /** The biggest by length, then by weight; null when no catch had either. */
  bestLengthCm: number | null
  bestWeightKg: number | null
  bestCatchId: number
}

// Groups a catches list (already loaded by the caller — ProfileScreen's
// myCatches / UserProfileScreen's useCatchesByUser, both full Catch[] lists,
// not just the count) into one row per distinct species, most-caught first,
// with what the statistics screen (SpeciesListModal) needs per species: first
// and last catch, the record length and weight.
export function speciesBreakdown(catches: Catch[]): SpeciesEntry[] {
  const byKey = new Map<string, SpeciesEntry>()
  for (const c of catches) {
    const e = byKey.get(c.species)
    if (!e) {
      byKey.set(c.species, {
        key: c.species,
        name: c.speciesName,
        category: c.speciesCategory,
        count: 1,
        photoUrl: c.photoUrl,
        lastCatchId: c.id,
        lastAt: c.caughtAt,
        firstAt: c.caughtAt,
        bestLengthCm: c.lengthCm,
        bestWeightKg: c.weightKg,
        bestCatchId: c.id,
      })
      continue
    }
    e.count += 1
    if (c.caughtAt > e.lastAt) {
      e.lastAt = c.caughtAt
      e.lastCatchId = c.id
      e.photoUrl = c.photoUrl
    }
    if (c.caughtAt < e.firstAt) e.firstAt = c.caughtAt
    const longer = (c.lengthCm ?? 0) > (e.bestLengthCm ?? 0)
    const heavier = (c.lengthCm ?? 0) === (e.bestLengthCm ?? 0) && (c.weightKg ?? 0) > (e.bestWeightKg ?? 0)
    if (longer || heavier) e.bestCatchId = c.id
    if ((c.lengthCm ?? 0) > (e.bestLengthCm ?? 0)) e.bestLengthCm = c.lengthCm
    if ((c.weightKg ?? 0) > (e.bestWeightKg ?? 0)) e.bestWeightKg = c.weightKg
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, currentLocale()))
}

// Relative day label matching fishzone-app.html's demo strings ("Сегодня", "Вчера",
// "N дней назад") plus a time-of-day for same-day entries ("Сегодня · 07:45").
export function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000)
  const time = d.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })

  if (diffDays <= 0) return `${tn('fmt.today')} · ${time}`
  if (diffDays === 1) return `${tn('fmt.yesterday')} · ${time}`
  if (diffDays < 7) return tn('fmt.daysAgo', { count: diffDays })
  return d.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
}

// weight_kg is stored in the DB as kilograms (numeric(4,2), see confirm_catch)
// — grams are purely a display/input convention on top of that, so this just
// rescales for presentation; nothing downstream needs to know grams exist.
export function formatWeightGrams(kg: number): string {
  return String(Math.round(kg * 1000))
}

// Size/weight are optional now (see DECISIONS.md — only species is required
// when logging a catch) — joins whichever of the two were given, or ''.
export function formatCatchMeta(lengthCm: number | null, weightKg: number | null): string {
  return [lengthCm ? `${lengthCm} ${tn('fmt.cm')}` : null, weightKg ? `${formatWeightGrams(weightKg)} ${tn('fmt.g')}` : null].filter(Boolean).join(' · ')
}

// "9/2026" — numeric month/year an account was created (see ProfileScreen/
// UserProfileScreen "В RANGE с ..."). No month name, per spec.
export function formatJoinedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getFullYear()}`
}

// "4:32" — minutes:seconds, no leading zero on minutes. Only used for the
// catch-cooldown modal (see confirm_catch's COOLDOWN: exception).
export function formatCooldown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Picks the Russian plural form for a count: 1/21/31 → one, 2-4/22-24 → few,
// 0/5-20/25-30 → many (11-14 are always "many", overriding the last-digit rule).
export function pluralRu(n: number, [one, few, many]: [string, string, string]): string {
  const mod100 = Math.abs(n) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

// The word for a count in the current language (plural.* in the dictionaries):
// «${n} ${pluralSectors(n)}» → «5 секторов» / «5 sectors» / «5 სექტორი».
export const pluralSectors = (n: number) => tn('plural.sector', { count: n })
export const pluralCatches = (n: number) => tn('plural.catch', { count: n })
export const pluralTerritories = (n: number) => tn('plural.territory', { count: n })
export const pluralSpecies = (n: number) => tn('plural.species', { count: n })
export const pluralFollowers = (n: number) => tn('plural.follower', { count: n })
export const pluralFish = (n: number) => tn('plural.fish', { count: n })
export const pluralAnglers = (n: number) => tn('plural.angler', { count: n })
export const pluralDays = (n: number) => tn('plural.day', { count: n })
export const pluralHours = (n: number) => tn('plural.hour', { count: n })
export const pluralMinutes = (n: number) => tn('plural.minute', { count: n })

// "1 день 4 часа" once a day or more remains, "14 часов 5 минут" under a
// day, just "13 минут" under an hour, and "Завершено" past the deadline —
// see ChallengeCountdown, the one caller.
export function formatChallengeCountdown(msRemaining: number): { text: string; done: boolean } {
  if (msRemaining <= 0) return { text: tn('fmt.ended'), done: true }
  const totalMinutes = Math.floor(msRemaining / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days >= 1) {
    // Right at a day boundary hours can be 0 while minutes aren't — "6 дней
    // 0 часов" reads like a stuck timer even though it's correct (6 days and
    // a few minutes), so fall back to minutes for that sliver instead.
    if (hours === 0) return { text: `${days} ${pluralDays(days)} ${minutes} ${pluralMinutes(minutes)}`, done: false }
    return { text: `${days} ${pluralDays(days)} ${hours} ${pluralHours(hours)}`, done: false }
  }
  if (hours >= 1) return { text: `${hours} ${pluralHours(hours)} ${minutes} ${pluralMinutes(minutes)}`, done: false }
  return { text: `${minutes} ${pluralMinutes(minutes)}`, done: false }
}

// Monday 00:00 of the Batumi/Tbilisi week (UTC+4, no DST) `offsetWeeks` weeks
// from the current one — mirrors get_weekly_leaderboard's own week-truncation
// exactly, via Intl rather than manual UTC+4 math, so it's still correct if
// this ever runs somewhere DST could otherwise bite. Returned as a UTC-based
// Date whose UTC fields equal that Monday's Tbilisi wall-clock date.
export function tbilisiWeekStart(offsetWeeks: number, timezone: string = 'Asia/Tbilisi'): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year')!.value)
  const m = Number(parts.find((p) => p.type === 'month')!.value)
  const d = Number(parts.find((p) => p.type === 'day')!.value)
  const todayUTC = Date.UTC(y, m - 1, d)
  const daysSinceMonday = (new Date(todayUTC).getUTCDay() + 6) % 7
  return new Date(todayUTC - daysSinceMonday * 86_400_000 + offsetWeeks * 7 * 86_400_000)
}

// "Сентябрь, 2 неделя" — replaces "Топ недели" on the past-week recap screen,
// since that badge implies "current week" and a recap is never the current one.
export function formatWeekOfMonth(offsetWeeks: number, timezone: string = 'Asia/Tbilisi'): string {
  const monday = tbilisiWeekStart(offsetWeeks, timezone)
  const firstOfMonthUTC = Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), 1)
  const weekOfMonth = Math.floor((monday.getTime() - firstOfMonthUTC) / (7 * 86_400_000)) + 1
  return tn('fmt.weekOfMonth', { month: tn('fmt.months').split('|')[monday.getUTCMonth()], week: weekOfMonth })
}

// Compact relative time for dense rows like comments: «сейчас», «5 мин»,
// «3 ч», «2 д», then a short date — formatWhen's «Сегодня · 14:05» is too
// wide to sit next to a name on one line.
export function formatShortAgo(iso: string): string {
  const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return tn('fmt.now')
  if (diffSec < 3600) return tn('fmt.minShort', { count: Math.floor(diffSec / 60) })
  if (diffSec < 86_400) return tn('fmt.hourShort', { count: Math.floor(diffSec / 3600) })
  if (diffSec < 7 * 86_400) return tn('fmt.dayShort', { count: Math.floor(diffSec / 86_400) })
  return new Date(iso).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
}
