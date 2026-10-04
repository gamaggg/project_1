'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isLang, langFromLocale, translate, type Lang, type TKey, type TVars } from '@/lib/i18n/core'

export { LANGS, type Lang, type TKey } from '@/lib/i18n/core'

const STORAGE_KEY = 'range:lang'

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

// First visit: the language Telegram reports for the person, else the
// browser's. After that, whatever they picked (stored on the device).
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {}
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(detectLang())
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }, [])

  const value = useMemo<I18n>(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  return useContext(I18nContext)
}

export function useT(): I18n['t'] {
  return useContext(I18nContext).t
}
