import type { Lang } from '@/lib/i18n/core'
import type { LandingDoc } from '@/lib/data/landing.shared'
import { LANDING_RU } from '@/lib/data/landing.ru'
import { LANDING_EN } from '@/lib/data/landing.en'
import { LANDING_KA } from '@/lib/data/landing.ka'

export const LANDING_DOCS: Record<Lang, LandingDoc> = { ru: LANDING_RU, en: LANDING_EN, ka: LANDING_KA }
