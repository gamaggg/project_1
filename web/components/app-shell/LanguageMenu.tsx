'use client'

import { useEffect, useRef, useState } from 'react'
import { LANGS, useI18n, type Lang } from '@/lib/i18n'

// A round flag drawn in SVG (emoji flags don't render on Windows / Telegram
// Desktop there). English is the Union Jack, Georgian the five-cross flag.
export function LangFlag({ lang, size = 24 }: { lang: Lang; size?: number }) {
  return (
    <span className="lang-flag" style={{ width: size, height: size }} aria-hidden>
      {lang === 'ru' && (
        <svg viewBox="0 0 30 30" preserveAspectRatio="xMidYMid slice">
          <rect width="30" height="10" fill="#fff" />
          <rect y="10" width="30" height="10" fill="#1C57A5" />
          <rect y="20" width="30" height="10" fill="#E03A3E" />
        </svg>
      )}
      {lang === 'en' && (
        <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice">
          <clipPath id="flag-uk-s">
            <path d="M0,0 v30 h60 v-30 z" />
          </clipPath>
          <clipPath id="flag-uk-t">
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
          <g clipPath="url(#flag-uk-s)">
            <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
            <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-uk-t)" stroke="#C8102E" strokeWidth="4" />
            <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
            <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
          </g>
        </svg>
      )}
      {lang === 'ka' && (
        <svg viewBox="0 0 90 60" preserveAspectRatio="xMidYMid slice">
          <rect width="90" height="60" fill="#fff" />
          <g fill="#E8112D">
            <rect x="40" width="10" height="60" />
            <rect y="25" width="90" height="10" />
            {[
              [20, 12.5],
              [70, 12.5],
              [20, 47.5],
              [70, 47.5],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <rect x={x - 2} y={y - 6} width="4" height="12" />
                <rect x={x - 6} y={y - 2} width="12" height="4" />
              </g>
            ))}
          </g>
        </svg>
      )}
    </span>
  )
}

// The first screen's language choice: a small frosted button with the current
// flag, opening a list — flag and the language's own name for each. Picking
// one reloads into it (nothing to lose before signing up, so no question first).
export function LanguageMenu() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(next: Lang) {
    setOpen(false)
    if (next !== lang) window.setTimeout(() => setLang(next), 160)
  }

  return (
    <div className="lang-menu" ref={rootRef}>
      <button type="button" className="lang-menu-btn tap-scale" aria-haspopup="listbox" aria-expanded={open} aria-label={t('common.language')} onClick={() => setOpen((o) => !o)}>
        <LangFlag lang={lang} size={22} />
        <span>{lang.toUpperCase()}</span>
        <svg className="lang-menu-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="lang-menu-list" role="listbox" aria-label={t('common.language')}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" role="option" aria-selected={l.id === lang} lang={l.id} className={`lang-menu-opt${l.id === lang ? ' on' : ''}`} onClick={() => pick(l.id)}>
              <LangFlag lang={l.id} size={26} />
              <span>{l.name}</span>
              {l.id === lang && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
