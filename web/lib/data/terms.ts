import type { Lang } from '@/lib/i18n/core'
import type { PrivacyDoc } from '@/lib/data/privacy.shared'
import { ru } from '@/lib/i18n/ru'
import { en } from '@/lib/i18n/en'
import { ka } from '@/lib/i18n/ka'

// The public page with the terms of use (/terms, /terms/en, /terms/ka). The text
// is not copied: it is the same `terms` block the app shows inside («Условия
// использования»), turned into the shape the privacy page already renders, so
// the two can never say different things.
// Why it exists: Google and TikTok app reviews ask for a standalone terms URL.

const DICTS: Record<Lang, { terms: Record<string, string> }> = {
  ru: ru as unknown as { terms: Record<string, string> },
  en: en as unknown as { terms: Record<string, string> },
  ka: ka as unknown as { terms: Record<string, string> },
}

const META: Record<Lang, string> = {
  ru: 'Правила использования RANGE: возраст, аккаунт, сектора и уловы, монеты, контент и ответственность.',
  en: 'Rules for using RANGE: age, account, sectors and catches, coins, content and liability.',
  ka: 'RANGE-ის გამოყენების წესები: ასაკი, ანგარიში, სექტორები და დაჭერები, მონეტები, კონტენტი და პასუხისმგებლობა.',
}

function build(lang: Lang): PrivacyDoc {
  const t = DICTS[lang].terms
  const sections: PrivacyDoc['sections'] = []
  for (let n = 1; t[`s${n}t`]; n++) {
    const blocks: string[] = []
    for (let p = 1; t[`s${n}p${p}`]; p++) blocks.push(t[`s${n}p${p}`])
    // The page numbers the headings itself, the app strings already carry «1. ».
    sections.push({ title: t[`s${n}t`].replace(/^\d+\.\s*/, ''), blocks })
  }
  return { lang, title: t.title, metaDescription: META[lang], updated: t.updated, intro: '', sections }
}

export const TERMS_DOCS: Record<Lang, PrivacyDoc> = { ru: build('ru'), en: build('en'), ka: build('ka') }

export const TERMS_PATHS: Record<Lang, string> = { ru: '/terms', en: '/terms/en', ka: '/terms/ka' }
