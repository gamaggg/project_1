'use client'

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setCurrentLanguage } from '@/lib/i18n/runtime'
import { TRANSLATION_READY, isLang, langFromLocale, translate, type Lang, type TKey, type TVars } from '@/lib/i18n/core'

export { LANGS, type Lang, type TKey } from '@/lib/i18n/core'

const STORAGE_KEY = 'range:lang'

export { tn, tnd, currentLanguage, currentLocale } from '@/lib/i18n/runtime'

type I18n = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TKey, vars?: TVars) => string
}

const I18nContext = createContext<I18n>({
  lang: 'ru',
  setLang: () => {},
  t: (key, vars) => translate('ru', key, vars),
})

export { TRANSLATION_READY }

// An explicit choice is always honoured: «?lang=ka» in the link (remembered
// on the device — how the translation is tried before it is switched on) or
// what was picked in the profile. Without one, the language Telegram reports
// for the person, else the browser's — but only once the translation is ready.
function detectLang(): Lang {
  try {
    const fromLink = new URLSearchParams(window.location.search).get('lang')
    if (isLang(fromLink)) {
      localStorage.setItem(STORAGE_KEY, fromLink)
      return fromLink
    }
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {}
  if (!TRANSLATION_READY) return 'ru'
  const telegram = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  return langFromLocale(telegram ?? navigator.language)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // The server render is always Russian; the real language is applied right
  // after mount, so a first paint in another language never mismatches
  // hydration.
  const [lang, setLangState] = useState<Lang>('ru')

  useEffect(() => {
    // Syncing with the device's saved choice / Telegram's language — external
    // sources that only exist after mount.
    const detected = detectLang()
    setCurrentLanguage(detected)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(detected)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    setCurrentLanguage(next)
    setLangState(next)
    // Fetched data already carries names in the old language (species,
    // sectors' clans…): a fresh load is the simple, certain way to redo it all.
    window.location.reload()
  }, [])

  const value = useMemo<I18n>(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang])
  // keyed by language: a change remounts the app under it, so every plain
  // function that reads the language (tn, formatWhen…) is called afresh.
  return (
    <I18nContext.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </I18nContext.Provider>
  )
}

export function useI18n(): I18n {
  return useContext(I18nContext)
}

export function useT(): I18n['t'] {
  return useContext(I18nContext).t
}
