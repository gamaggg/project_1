import type { Metadata } from 'next'
import Link from 'next/link'
import { LANGS, type Lang } from '@/lib/i18n/core'
import { PRIVACY_DOCS, PRIVACY_PATHS } from '@/lib/data/privacy'
import { SITE_URL } from '@/lib/site'
import './privacy.css'

export function privacyMetadata(lang: Lang): Metadata {
  const doc = PRIVACY_DOCS[lang]
  return {
    title: `${doc.title} — RANGE`,
    description: doc.metaDescription,
    alternates: {
      canonical: `${SITE_URL}${PRIVACY_PATHS[lang]}`,
      languages: Object.fromEntries(LANGS.map((l) => [l.id, `${SITE_URL}${PRIVACY_PATHS[l.id]}`])),
    },
  }
}

// A plain server-rendered page, not a screen of the app shell: the link in
// BotFather, in the sign-up checkbox and on search results must open without
// loading the game. The text lives in lib/data/privacy.{ru,en,ka}.ts.
export function PrivacyView({ lang }: { lang: Lang }) {
  const doc = PRIVACY_DOCS[lang]
  return (
    <main className="privacy-page" lang={lang}>
      <div className="privacy-top">
        <Link className="privacy-back" href="/" prefetch={false}>
          ← RANGE
        </Link>
        <nav className="privacy-langs" aria-label="Language">
          {LANGS.map((l) =>
            l.id === lang ? (
              <span key={l.id} aria-current="page">
                {l.name}
              </span>
            ) : (
              <a key={l.id} href={PRIVACY_PATHS[l.id]} hrefLang={l.id}>
                {l.name}
              </a>
            )
          )}
        </nav>
      </div>
      <h1>{doc.title}</h1>
      <p className="privacy-updated">{doc.updated}</p>
      <p>{doc.intro}</p>
      {doc.sections.map((s, n) => (
        <section key={s.title}>
          <h2>
            {n + 1}. {s.title}
          </h2>
          {s.blocks.map((b, i) =>
            Array.isArray(b) ? (
              <ul key={i}>
                {b.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{b}</p>
            )
          )}
        </section>
      ))}
    </main>
  )
}
