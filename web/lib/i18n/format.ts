import type { Lang } from '@/lib/i18n/core'

// «вс 23:59» / «Sun 23:59» / «კვ 23:59» — a moment within the coming week.
// `timeZone`: the city the moment belongs to (a Moscow hot sector ends at
// Sunday 23:59 Moscow time, not «пн 00:59» on a phone in Batumi).
export function formatWeekdayTime(iso: string, lang: Lang, timeZone?: string): string {
  return new Intl.DateTimeFormat(lang, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date(iso))
}
