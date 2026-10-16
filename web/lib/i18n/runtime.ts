import { translate, type Lang, type TKey, type TVars } from '@/lib/i18n/core'

// The language right now, for code that isn't a component (formatters, toasts,
// data helpers, server routes): tn('slots.title') reads it. Not a 'use client'
// module on purpose, so server code can import it too (there it stays Russian
// until a route passes a person's language explicitly). The client provider
// sets it together with its own state and remounts the app under it when the
// language changes, so nothing shows a stale language.
let currentLang: Lang = 'ru'

export function setCurrentLanguage(lang: Lang) {
  currentLang = lang
}

export function currentLanguage(): Lang {
  return currentLang
}

export function tn(key: TKey, vars?: TVars): string {
  return translate(currentLang, key, vars)
}

// A key built at run time («species.' + key») — a missing one reads as the key.
export function tnd(key: string, vars?: TVars): string {
  return translate(currentLang, key as TKey, vars)
}

// An object of labels that reads the current language every time a key is
// accessed: labels('kind', ['sea', 'river']) → { sea: tn('kind.sea'), … }.
// For the constant «Record<Id, string>» tables the screens index into.
export function labels<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>
  for (const k of keys) Object.defineProperty(out, k, { enumerable: true, get: () => tnd(`${prefix}.${k}`) })
  return out
}

// BCP-47 locale for Intl / toLocale*String in the current language.
export function currentLocale(): string {
  return currentLang === 'ka' ? 'ka-GE' : currentLang === 'en' ? 'en-GB' : 'ru-RU'
}
