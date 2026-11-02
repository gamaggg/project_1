import type { Lang } from '@/lib/i18n/core'

// The sales pages for shops (/partners/batumi, /partners/moscow, each with /en and, for Batumi, /ka): what a local
// fishing shop gets from RANGE and what it costs. Sent by link to shop owners,
// so it is not in the sitemap and asks search engines to skip it.
// The three texts (partners.{ru,en,ka}.ts) are the Batumi page; partners.moscow.ts only
// replaces what differs for Moscow. Georgian is for a native speaker to read.

export type PartnerCity = 'batumi' | 'moscow'

// One page per city, the same page in the city's languages: Batumi in Russian, English and
// Georgian, Moscow in Russian and English (/partners/<city>, /partners/<city>/en, /partners/<city>/ka).
export const PARTNER_CITY_LANGS: Record<PartnerCity, Lang[]> = { batumi: ['ru', 'en', 'ka'], moscow: ['ru', 'en'] }

export const partnersPath = (city: PartnerCity, lang: Lang) => `/partners/${city}${lang === 'ru' ? '' : `/${lang}`}`

// Where a shop owner's message goes. Filled in by the owner before the link is
// sent out; an empty value hides that way of reaching us.
export const PARTNER_CONTACTS = {
  telegram: 'atl_d',
  phone: '+995 595 509 668',
}

// Figures from the database on 31.10.2026 (380 registered, not blocked; 186 of them in Batumi and 194 in Moscow
// and the region, so «180+» is true on both pages; 991 catches, 657 of them by players without admins; 5 cities).
// Rounded down with a plus. Update before a new wave of outreach.
export const PARTNER_STATS = { players: '380+', city: '180+', catches: '650+', cities: '5' }

// Monthly prices in the city's currency; the first 10 days are free. Two plans (decided 02.11.2026): Старт is the
// pin and the promo code, Партнёр is Старт plus one week a month as the sponsor of the weekly prize.
// Moscow is Batumi's price at about 30 ₽ per ₾, rounded.
export const PARTNER_PRICES: Record<PartnerCity, { start: number; partner: number; symbol: string }> = {
  batumi: { start: 59, partner: 99, symbol: '₾' },
  moscow: { start: 1790, partner: 2990, symbol: '₽' },
}

// Real photos of the shop (files in public/partners/<city>/), when there are any; until then the card shows drawings.
export const PARTNER_PHOTOS: Record<PartnerCity, string[]> = {
  // Fishing Yard, 24 Shalva Inasaridze St: the entrance with the sign, the hall, the reel cabinet.
  batumi: ['/partners/batumi/shop-1.jpg', '/partners/batumi/shop-2.jpg', '/partners/batumi/shop-3.jpg'],
  // The Moscow card: the neon sign, a goods stand, the rods.
  moscow: ['/partners/moscow/shop-1.jpg', '/partners/moscow/shop-2.jpg', '/partners/moscow/shop-3.jpg'],
}

export type PlanId = 'start' | 'partner'

// What differs on the Moscow page; everything else is the Batumi text.
export type PartnersCityText = {
  cityName: string
  metaTitle: string
  metaDescription: string
  eyebrow: string
  lead: string
  pilot: string
  cityStatLabel: string
  address: string
  shopDist: string
  prize: string
  prizeCost: string
  board: { name: string; result: string }[]
}

export type PartnersDoc = {
  lang: Lang
  cityName: string
  metaTitle: string
  metaDescription: string
  eyebrow: string
  h1: string
  lead: string
  ctaDemo: string
  ctaForm: string
  pilot: string
  stats: { value: string; label: string }[]
  statsNote: string
  appTitle: string
  appText: string
  appEyebrow: string
  // The three things the phones show, in words next to them.
  appPoints: { title: string; text: string }[]
  // What the three phones show, left to right: a sector, the map, a catch.
  appShots: [string, string, string]
  appTelegram: string
  appWeb: string
  whyTitle: string
  why: { title: string; text: string }[]
  demo: {
    title: string
    lead: string
    badge: string
    hint: string
    tabs: Record<PlanId, { name: string; sub: string }>
    shop: { name: string; kind: string; hours: string; dist: string; route: string }
    promo: { title: string; code: string; discount: string; text: string; show: string; shown: string; valid: string }
    week: { title: string; prize: string; prizeLabel: string; rule: string; board: { name: string; result: string }[] }
  }
  sheet: {
    photos: string
    photoNote: string
    route: string
    call: string
    callDemo: string
    copy: string
    copied: string
    addressLabel: string
    address: string
    productsTitle: string
    products: string[]
    sponsor: string
    weekEnds: string
    close: string
    demoNote: string
  }
  plansTitle: string
  plansLead: string
  plans: { id: PlanId; name: string; tagline: string; bullets: string[]; priceNote: string }[]
  perMonth: string
  // How the sponsor's week goes; `{cost}` in the note is replaced with prizeCost.
  weekPlan: { title: string; lead: string; steps: { title: string; text: string }[]; note: string }
  prizeCost: string
  pilotBadge: string
  stepsTitle: string
  steps: { title: string; text: string }[]
  formTitle: string
  formLead: string
  fShop: string
  fContact: string
  fContactHint: string
  fInterest: string
  fComment: string
  fSubmit: string
  fSent: string
  fSentTitle: string
  fSending: string
  fFailed: string
  fRequired: string
  orWrite: string
  contactTelegram: string
  contactPhone: string
  footerApp: string
  footerAbout: string
}
