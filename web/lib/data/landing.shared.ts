import type { Lang } from '@/lib/i18n/core'

// The public landing page (/about, /about/en, /about/ka): what RANGE is, in
// words a search engine and a first-time visitor can read without loading the
// game (the app itself is one client-rendered page, so it has nothing to index).
// The three texts (landing.{ru,en,ka}.ts) say the same thing. Every claim was
// checked against the app on 26.10.2026 — change the page together with the
// feature it describes. Georgian is for a native speaker to read.

export type LandingDoc = {
  lang: Lang
  metaTitle: string
  metaDescription: string
  eyebrow: string
  h1: string
  lead: string
  ctaTelegram: string
  ctaWeb: string
  free: string
  stepsTitle: string
  steps: { title: string; text: string }[]
  featuresTitle: string
  features: { title: string; text: string }[]
  citiesTitle: string
  citiesLead: string
  cities: string[]
  faqTitle: string
  faq: { q: string; a: string }[]
  closingTitle: string
  closingText: string
  privacy: string
  openApp: string
}

export const LANDING_PATHS: Record<Lang, string> = { ru: '/about', en: '/about/en', ka: '/about/ka' }

export const TELEGRAM_BOT_URL = 'https://t.me/catchrangebot'
