// Relative day label matching fishzone-app.html's demo strings ("Сегодня", "Вчера",
// "N дней назад") plus a time-of-day for same-day entries ("Сегодня · 07:45").
export function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000)
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (diffDays <= 0) return `Сегодня · ${time}`
  if (diffDays === 1) return `Вчера · ${time}`
  if (diffDays < 7) return `${diffDays} дн. назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
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
  return [lengthCm ? `${lengthCm} см` : null, weightKg ? `${formatWeightGrams(weightKg)} г` : null].filter(Boolean).join(' · ')
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

export const pluralSectors = (n: number) => pluralRu(n, ['сектор', 'сектора', 'секторов'])
export const pluralCatches = (n: number) => pluralRu(n, ['улов', 'улова', 'уловов'])
export const pluralTerritories = (n: number) => pluralRu(n, ['территория', 'территории', 'территорий'])

const RU_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

// Monday 00:00 of the Batumi/Tbilisi week (UTC+4, no DST) `offsetWeeks` weeks
// from the current one — mirrors get_weekly_leaderboard's own week-truncation
// exactly, via Intl rather than manual UTC+4 math, so it's still correct if
// this ever runs somewhere DST could otherwise bite. Returned as a UTC-based
// Date whose UTC fields equal that Monday's Tbilisi wall-clock date.
export function tbilisiWeekStart(offsetWeeks: number): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year')!.value)
  const m = Number(parts.find((p) => p.type === 'month')!.value)
  const d = Number(parts.find((p) => p.type === 'day')!.value)
  const todayUTC = Date.UTC(y, m - 1, d)
  const daysSinceMonday = (new Date(todayUTC).getUTCDay() + 6) % 7
  return new Date(todayUTC - daysSinceMonday * 86_400_000 + offsetWeeks * 7 * 86_400_000)
}

// "Сентябрь, 2 неделя" — replaces "Топ недели" on the past-week recap screen,
// since that badge implies "current week" and a recap is never the current one.
export function formatWeekOfMonth(offsetWeeks: number): string {
  const monday = tbilisiWeekStart(offsetWeeks)
  const firstOfMonthUTC = Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), 1)
  const weekOfMonth = Math.floor((monday.getTime() - firstOfMonthUTC) / (7 * 86_400_000)) + 1
  return `${RU_MONTHS[monday.getUTCMonth()]}, ${weekOfMonth} неделя`
}
