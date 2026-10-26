import type { Metadata } from 'next'
import Link from 'next/link'
import { LANGS, type Lang } from '@/lib/i18n/core'
import { LANDING_DOCS } from '@/lib/data/landing'
import { LANDING_PATHS, TELEGRAM_BOT_URL } from '@/lib/data/landing.shared'
import { PRIVACY_PATHS } from '@/lib/data/privacy'
import { SITE_URL } from '@/lib/site'
import './landing.css'

const OG_LOCALE: Record<Lang, string> = { ru: 'ru_RU', en: 'en_US', ka: 'ka_GE' }

export function landingMetadata(lang: Lang): Metadata {
  const doc = LANDING_DOCS[lang]
  const url = `${SITE_URL}${LANDING_PATHS[lang]}`
  return {
    title: doc.metaTitle,
    description: doc.metaDescription,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(LANGS.map((l) => [l.id, `${SITE_URL}${LANDING_PATHS[l.id]}`])),
    },
    openGraph: {
      title: doc.metaTitle,
      description: doc.metaDescription,
      url,
      siteName: 'RANGE',
      locale: OG_LOCALE[lang],
      type: 'website',
      images: [{ url: `${SITE_URL}/opengraph-image.png` }],
    },
    twitter: { card: 'summary_large_image', title: doc.metaTitle, description: doc.metaDescription, images: [`${SITE_URL}/opengraph-image.png`] },
  }
}

// A plain server-rendered page, not a screen of the app shell: the app is one
// client-rendered page with nothing for a search engine to read, so this is
// what gets indexed and what a shared link opens. The text lives in
// lib/data/landing.{ru,en,ka}.ts. The structured data (SoftwareApplication and
// FAQPage) repeats the same text for the search results.
export function LandingView({ lang }: { lang: Lang }) {
  const doc = LANDING_DOCS[lang]
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'RANGE',
      url: SITE_URL,
      description: doc.metaDescription,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web, Telegram',
      inLanguage: lang,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: doc.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]

  return (
    <main className="landing" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="landing-hero">
        <div className="landing-bar">
          <span className="landing-brand">RANGE</span>
          <nav className="landing-langs" aria-label="Language">
            {LANGS.map((l) =>
              l.id === lang ? (
                <span key={l.id} aria-current="page">
                  {l.name}
                </span>
              ) : (
                <a key={l.id} href={LANDING_PATHS[l.id]} hrefLang={l.id}>
                  {l.name}
                </a>
              )
            )}
          </nav>
        </div>
        <p className="landing-eyebrow">{doc.eyebrow}</p>
        <h1>{doc.h1}</h1>
        <p className="landing-lead">{doc.lead}</p>
        <div className="landing-cta">
          <a className="landing-btn landing-btn-primary" href={TELEGRAM_BOT_URL}>
            {doc.ctaTelegram}
          </a>
          <Link className="landing-btn landing-btn-ghost" href="/" prefetch={false}>
            {doc.ctaWeb}
          </Link>
        </div>
        <p className="landing-free">{doc.free}</p>
      </header>

      <section className="landing-section" aria-labelledby="steps">
        <h2 id="steps">{doc.stepsTitle}</h2>
        <ol className="landing-steps">
          {doc.steps.map((s, i) => (
            <li key={s.title}>
              <span className="landing-hex" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section" aria-labelledby="features">
        <h2 id="features">{doc.featuresTitle}</h2>
        <ul className="landing-features">
          {doc.features.map((f) => (
            <li key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="cities">
        <h2 id="cities">{doc.citiesTitle}</h2>
        <p className="landing-cities-lead">{doc.citiesLead}</p>
        <ul className="landing-cities">
          {doc.cities.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="faq">
        <h2 id="faq">{doc.faqTitle}</h2>
        <div className="landing-faq">
          {doc.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-closing">
        <h2>{doc.closingTitle}</h2>
        <p>{doc.closingText}</p>
        <a className="landing-btn landing-btn-primary" href={TELEGRAM_BOT_URL}>
          {doc.ctaTelegram}
        </a>
      </section>

      <footer className="landing-footer">
        <Link href="/" prefetch={false}>
          {doc.openApp}
        </Link>
        <a href={PRIVACY_PATHS[lang]}>{doc.privacy}</a>
      </footer>
    </main>
  )
}
