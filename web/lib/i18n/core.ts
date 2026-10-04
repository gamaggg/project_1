import { ru } from '@/lib/i18n/ru'
import { en } from '@/lib/i18n/en'
import { ka } from '@/lib/i18n/ka'

export type Lang = 'ru' | 'en' | 'ka'

export const LANGS: { id: Lang; name: string }[] = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
  { id: 'ka', name: 'ქართული' },
]

// A plural entry: the form is picked by Intl.PluralRules for the language —
// Russian needs one/few/many (1 улов, 2 улова, 5 уловов), English and
// Georgian only one/other.
export type PluralForms = { one: string; few?: string; many?: string; other: string }

// en and ka must have exactly the keys ru has, with any string (or plural)
// in place of ru's — so a key added to ru and forgotten in a translation is
// a type error, not a blank on screen.
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends PluralForms ? PluralForms : Shape<T[K]> }
export type Dict = Shape<typeof ru>

type Leaf = string | PluralForms
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]
export type TKey = Paths<Dict>

export type TVars = Record<string, string | number>

const DICTS: Record<Lang, Dict> = { ru, en, ka }

export function isLang(value: unknown): value is Lang {
  return value === 'ru' || value === 'en' || value === 'ka'
}

// Telegram's language_code / navigator.language → one of ours. Anything that
// isn't English or Georgian reads Russian: the audience is Russian-speaking
// unless it says otherwise.
export function langFromLocale(locale: string | null | undefined): Lang {
  const code = (locale ?? '').toLowerCase().slice(0, 2)
  if (code === 'ka') return 'ka'
  if (code === 'en') return 'en'
  return 'ru'
}

function lookup(dict: Dict, key: string): Leaf | undefined {
  let node: unknown = dict
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' || (node && typeof node === 'object' && 'other' in node) ? (node as Leaf) : undefined
}

const pluralRules = new Map<Lang, Intl.PluralRules>()
function pluralForm(lang: Lang, forms: PluralForms, count: number): string {
  let rules = pluralRules.get(lang)
  if (!rules) {
    rules = new Intl.PluralRules(lang)
    pluralRules.set(lang, rules)
  }
  const category = rules.select(count) as keyof PluralForms
  return forms[category] ?? forms.other
}

// t('slots.spinsLeft', { count: 2 }) — `{name}` placeholders are filled from
// vars; a plural entry needs vars.count. A key missing in the language
// falls back to Russian, then to the key itself.
export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  const leaf = lookup(DICTS[lang], key) ?? lookup(DICTS.ru, key)
  if (leaf === undefined) return key
  const text = typeof leaf === 'string' ? leaf : pluralForm(lang, leaf, Number(vars?.count ?? 0))
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}
