import type { Lang } from '@/lib/i18n/core'

// «вс 23:59» / «Sun 23:59» / «კვ 23:59» — a moment within the coming week.
export function formatWeekdayTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}
