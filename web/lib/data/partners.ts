import type { Lang } from '@/lib/i18n/core'
import type { PartnerCity, PartnersDoc } from '@/lib/data/partners.shared'
import { PARTNERS_RU } from '@/lib/data/partners.ru'
import { PARTNERS_EN } from '@/lib/data/partners.en'
import { PARTNERS_KA } from '@/lib/data/partners.ka'
import { PARTNERS_MOSCOW } from '@/lib/data/partners.moscow'

const BATUMI: Record<Lang, PartnersDoc> = { ru: PARTNERS_RU, en: PARTNERS_EN, ka: PARTNERS_KA }

// The Batumi text, with the lines that differ replaced for Moscow.
export function partnersDoc(lang: Lang, city: PartnerCity): PartnersDoc {
  const base = BATUMI[lang]
  const o = city === 'moscow' ? PARTNERS_MOSCOW[lang] : undefined
  if (!o) return base
  return {
    ...base,
    cityName: o.cityName,
    metaTitle: o.metaTitle,
    metaDescription: o.metaDescription,
    eyebrow: o.eyebrow,
    lead: o.lead,
    pilot: o.pilot,
    sheet: { ...base.sheet, address: o.address },
    stats: base.stats.map((s, i) => (i === 1 ? { ...s, label: o.cityStatLabel } : s)),
    demo: {
      ...base.demo,
      shop: { ...base.demo.shop, dist: o.shopDist },
      week: { ...base.demo.week, prize: o.prize, board: o.board },
    },
  }
}
