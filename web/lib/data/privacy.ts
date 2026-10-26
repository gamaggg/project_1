import type { Lang } from '@/lib/i18n/core'
import type { PrivacyDoc } from '@/lib/data/privacy.shared'
import { PRIVACY_RU } from '@/lib/data/privacy.ru'
import { PRIVACY_EN } from '@/lib/data/privacy.en'
import { PRIVACY_KA } from '@/lib/data/privacy.ka'

// The policy in each language; the rules for editing it are in privacy.shared.ts.
export const PRIVACY_DOCS: Record<Lang, PrivacyDoc> = { ru: PRIVACY_RU, en: PRIVACY_EN, ka: PRIVACY_KA }

// Where each language lives: /privacy is Russian, the others sit beside it.
export const PRIVACY_PATHS: Record<Lang, string> = { ru: '/privacy', en: '/privacy/en', ka: '/privacy/ka' }
