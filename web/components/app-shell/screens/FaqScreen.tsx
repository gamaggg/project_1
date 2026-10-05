'use client'

import { useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { faqFor, type FaqAnswer } from '@/lib/data/faq'
import { useI18n } from '@/lib/i18n'

function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, 'е')
}

function Answer({ a }: { a: FaqAnswer }) {
  return (
    <div className="faq-answer">
      {a.map((block, i) =>
        typeof block === 'string' ? (
          <p key={i}>{block}</p>
        ) : (
          <ul key={i}>
            {block.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}

// «Вопросы и ответы» (lib/data/faq.ts): the game's rules as questions, by
// topic, one open at a time; the search box looks through questions and
// answers alike.
export function FaqScreen({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const q = norm(query.trim())
  const sections = faqFor(lang)
    .map((s) => ({
      ...s,
      items: q ? s.items.filter((it) => norm(it.q).includes(q) || norm(it.a.flat().join(' ')).includes(q)) : s.items,
    }))
    .filter((s) => s.items.length > 0)

  return (
    <div className="screen-inner">
      <div className="header-row">
        <BackButton onClick={onBack} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{t('faq.title')}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="faq-search">
        <input type="search" placeholder={t('faq.search')} value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
      </div>
      {sections.length === 0 && <div className="faq-empty">{t('faq.empty')}</div>}
      {sections.map((s) => (
        <section key={s.title} className="faq-section">
          <h2 className="faq-section-title">{s.title}</h2>
          <div className="faq-list">
            {s.items.map((it) => {
              const id = `${s.title}|${it.q}`
              const isOpen = open === id || !!q
              return (
                <div key={id} className={`faq-item${isOpen ? ' open' : ''}`}>
                  <button className="faq-q" aria-expanded={isOpen} onClick={() => setOpen(open === id ? null : id)}>
                    <span>{it.q}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && <Answer a={it.a} />}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
