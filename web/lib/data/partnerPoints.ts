import type { CityId } from '@/lib/data/city'
import { CITIES } from '@/lib/data/city'
import { tbilisiWeekStart } from '@/lib/format'

// Partner points on the map (supabase-drafts/partner-points-13-11): a shop, a sauna, a boat rental… that bought a
// plan on /partners. The super admin adds them in the app (Профиль → «Точки партнёров»); players see a pin on the map
// and a card with photos, route, call, website, address and the promo code. The «Партнёр» plan adds the weekly prize,
// shown in the city's weekly rating in the weeks picked for it. A point leaves the map by itself when its days run out.

export type PartnerPlan = 'start' | 'partner'

// What a player sees (partner_points_live).
export type PartnerPoint = {
  id: number
  city: CityId
  plan: PartnerPlan
  name: string
  kind: string | null
  description: string | null
  hours: string | null
  address: string | null
  lat: number
  lng: number
  phone: string | null
  website: string | null
  photos: string[]
  promoCode: string | null
  promoDiscount: string | null
  promoTerms: string | null
  prizeTitle: string | null
  prizeFrom: string | null
  // Mondays 'YYYY-MM-DD', in the city's time.
  prizeWeeks: string[]
  endsAt: string
  // A ready icon (PARTNER_ICONS id) or the partner's own SVG markup; null = the shop.
  icon: string | null
}

// The whole row, for the super admin's screen.
export type PartnerPointAdmin = PartnerPoint & {
  startsAt: string
  paused: boolean
  createdAt: string
}

export type PartnerPrize = { pointId: number; name: string; prizeTitle: string; prizeFrom: string; lat: number; lng: number; address: string | null }

// What the editor sends to admin_partner_point_save: the row's fields plus the first day and the number of days.
export type PartnerPointInput = {
  city: CityId
  plan: PartnerPlan
  name: string
  kind: string
  description: string
  hours: string
  address: string
  lat: number
  lng: number
  phone: string
  website: string
  photos: string[]
  promo_code: string
  promo_discount: string
  promo_terms: string
  prize_title: string
  prize_from: string
  prize_weeks: string[]
  start: string
  days: number
  paused: boolean
  icon: string
}

export const MAX_PARTNER_PHOTOS = 6

// The ready icons for a pin (white line drawings on the orange drop, 24×24). The ids are fixed in the database check.
export const PARTNER_ICONS: { id: string; label: string; svg: string }[] = [
  { id: 'shop', label: 'Магазин', svg: '<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0"/><path d="M5.5 12v7.5h13V12"/><path d="M10 19.5v-4.5h4v4.5"/>' },
  { id: 'fish', label: 'Рыба', svg: '<path d="M3 12c3-4.5 9-5.5 13-2.5l4-3v11l-4-3c-4 3-10 2-13-2.5z"/><path d="M8 11.5h.01"/>' },
  { id: 'boat', label: 'Лодки', svg: '<path d="M3 15h18l-2.5 4.5h-13z"/><path d="M12 15V4l6 9h-6"/>' },
  { id: 'sauna', label: 'Баня', svg: '<path d="M5 20h14"/><path d="M8 16c-1.2-1.5 1.2-2.5 0-4s1.2-2.5 0-4"/><path d="M12 16c-1.2-1.5 1.2-2.5 0-4s1.2-2.5 0-4"/><path d="M16 16c-1.2-1.5 1.2-2.5 0-4s1.2-2.5 0-4"/>' },
  { id: 'cafe', label: 'Кафе', svg: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3.5v3M12 3.5v3"/>' },
  { id: 'camp', label: 'База', svg: '<path d="M3 20h18"/><path d="M5 20 12 6l7 14"/><path d="M12 20l-2.5-5h5z"/>' },
]
export const MAX_ICON_SVG = 20000

export const presetIconSvg = (id: string, size = 18) => {
  const icon = PARTNER_ICONS.find((i) => i.id === id) ?? PARTNER_ICONS[0]
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon.svg}</svg>`
}
export const isCustomIcon = (icon: string | null | undefined): icon is string => !!icon && icon.startsWith('<svg')

// The partner's own SVG as an image address. Shown only through <img>, where scripts inside an SVG never run.
export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

// An uploaded .svg file, cleaned for storing: no XML prolog, comments or doctype; no scripts, <foreignObject>,
// on…= handlers or javascript: links; a viewBox (from width/height if missing) so it scales into the pin.
// Returns the markup, or an error in words.
export function cleanSvg(text: string): { svg: string } | { error: string } {
  let s = text.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').trim()
  if (!/^<svg[\s>]/i.test(s)) return { error: 'Это не SVG-файл' }
  s = s
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, '$1#')
    .replace(/\s{2,}/g, ' ')
  const open = s.match(/^<svg[^>]*>/i)?.[0] ?? ''
  if (!/viewBox\s*=/i.test(open)) {
    const w = open.match(/\swidth\s*=\s*["']?([\d.]+)/i)?.[1]
    const h = open.match(/\sheight\s*=\s*["']?([\d.]+)/i)?.[1]
    if (!w || !h) return { error: 'В SVG нет viewBox и размеров: пересохрани файл из редактора' }
    s = s.replace(/^<svg/i, `<svg viewBox="0 0 ${w} ${h}"`)
  }
  if (!/xmlns\s*=/i.test(open)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  if (s.length > MAX_ICON_SVG) return { error: `SVG слишком большой (${Math.round(s.length / 1000)} КБ, можно до 20 КБ). Упрости файл или сожми его, например, в SVGOMG` }
  if (/<script|javascript:|<foreignobject|\son[a-z]+\s*=/i.test(s)) return { error: 'В SVG остались скрипты, загрузи другой файл' }
  return { svg: s }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const CROWN_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z" fill="#fff"/></svg>'

// A partner's pin as HTML (a Leaflet divIcon on the map, and the admin's preview). A ready icon: an orange drop with the
// icon in white. The partner's own SVG: that picture alone takes the place of the drop (owner, 14.11), its bottom edge on
// the point. Either way: the discount in a green badge, a gold crown in its prize week, the name under it unless `far`.
// Everything typed by the admin is escaped; the own SVG goes only through <img>, where its scripts never run.
export function partnerPinHtml(p: Pick<PartnerPoint, 'name' | 'icon' | 'promoCode' | 'promoDiscount'> & { id?: number }, opts: { far?: boolean; crown?: boolean } = {}): string {
  const own = isCustomIcon(p.icon)
  const body = own
    ? `<img class="pp-mk-own" src="${esc(svgDataUrl(p.icon!))}" alt="" draggable="false"/>`
    : `<div class="pp-mk-pin">${presetIconSvg(p.icon ?? 'shop')}</div>`
  return (
    `<div class="pp-mk${own ? ' pp-mk-custom' : ''}${opts.far ? ' pp-mk-far' : ''}"${p.id ? ` data-pp="${Number(p.id)}"` : ''} role="button" aria-label="${esc(p.name)}">` +
    body +
    (p.promoDiscount?.trim() ? `<span class="pp-mk-badge pp-mk-promo">${esc(p.promoDiscount.trim())}</span>` : '') +
    (opts.crown ? `<span class="pp-mk-badge pp-mk-week">${CROWN_SVG}</span>` : '') +
    `<span class="pp-mk-name">${esc(p.name)}</span>` +
    '</div>'
  )
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

// Monday of the week `offset` weeks from this one, in the city's time, as 'YYYY-MM-DD' (the same week the
// weekly rating counts: get_weekly_leaderboard with the city's time zone).
export function cityMonday(city: CityId, offset = 0): string {
  return ymd(tbilisiWeekStart(offset, CITIES[city].timezone))
}

// Today in the city's time, 'YYYY-MM-DD'.
export function cityToday(city: CityId): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CITIES[city].timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// '2026-11-16' + 6 → '2026-11-22'.
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return ymd(d)
}

// Whole days from `a` to `b` (both 'YYYY-MM-DD').
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

// The point gives the weekly prize this week (in its city's time).
export function sponsorsThisWeek(p: Pick<PartnerPoint, 'plan' | 'prizeTitle' | 'prizeWeeks' | 'city'>): boolean {
  return p.plan === 'partner' && !!p.prizeTitle && p.prizeWeeks.includes(cityMonday(p.city))
}

// tel: wants digits and a leading plus only.
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

// «41.63247, 41.60682», «41.63247 41.60682», a Google Maps link with @lat,lng or ?q=lat,lng → [lat, lng].
export function parseCoords(text: string): [number, number] | null {
  const s = text.trim()
  const at = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/) ?? s.match(/[?&](?:q|ll|query|destination|daddr)=(-?\d{1,3}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i)
  const m = at ?? s.match(/^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1].replace(',', '.'))
  const lng = Number(m[2].replace(',', '.'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

// A website typed without the scheme gets https://.
export function normalizeWebsite(text: string): string {
  const s = text.trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

// The database's PARTNER:* errors in words for the admin.
export function partnerErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  if (msg.includes('PARTNER:not_authorized')) return 'Это может только суперадмин'
  if (msg.includes('PARTNER:not_found')) return 'Точка не найдена, обнови список'
  if (msg.includes('PARTNER:bad_city')) return 'Выбери город'
  if (msg.includes('PARTNER:bad_days')) return 'Срок показа: от 1 до 366 дней'
  if (msg.includes('PARTNER:bad_coords')) return 'Укажи координаты точки'
  if (msg.includes('PARTNER:prize_needs_title')) return 'Для приза недели напиши, что за приз'
  if (msg.includes('PARTNER:prize_week_taken')) return 'В одной из выбранных недель в этом городе уже есть приз другого партнёра'
  if (msg.includes('check constraint') || msg.includes('violates')) return 'Какое-то поле слишком длинное или заполнено неверно'
  return 'Не получилось сохранить, попробуй ещё раз'
}
