import type { Metadata } from 'next'
import Link from 'next/link'
import { LANGS, type Lang } from '@/lib/i18n/core'
import { partnersDoc } from '@/lib/data/partners'
import { PARTNER_CITY_LANGS, PARTNER_PRICES, partnersPath, type PartnerCity } from '@/lib/data/partners.shared'
import { LANDING_PATHS, TELEGRAM_BOT_URL } from '@/lib/data/landing.shared'
import { SITE_URL } from '@/lib/site'
import { PartnersDemo } from './PartnersDemo'
import { PartnersForm } from './PartnersForm'
import '../about/landing.css'
import './partners.css'

const price = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')

export function partnersMetadata(lang: Lang, city: PartnerCity): Metadata {
  const doc = partnersDoc(lang, city)
  const url = `${SITE_URL}${partnersPath(city, lang)}`
  return {
    title: doc.metaTitle,
    description: doc.metaDescription,
    // Sent to shop owners by link; not for search results.
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      title: doc.metaTitle,
      description: doc.metaDescription,
      url,
      siteName: 'RANGE',
      type: 'website',
      images: [{ url: `${SITE_URL}/opengraph-image.png` }],
    },
  }
}

export function PartnersView({ lang, city }: { lang: Lang; city: PartnerCity }) {
  const doc = partnersDoc(lang, city)
  const prices = PARTNER_PRICES[city]
  const sum = prices.pin + prices.promo + prices.week
  const total = prices.bundle ?? Math.round((sum * (100 - (prices.off ?? 0))) / 100)
  const offPct = Math.round(((sum - total) / sum) * 100)
  const money = (n: number) => `${price(n)}\u00A0${prices.symbol}`

  return (
    <main className="landing pt" lang={lang}>
      <header className="landing-hero">
        <div className="landing-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pt-logo" src="/brand/logo_2.svg" alt="RANGE" />
          <nav className="pt-langs" aria-label="Language">
            {LANGS.filter((l) => PARTNER_CITY_LANGS[city].includes(l.id)).map((l) =>
              l.id === lang ? (
                <span key={l.id} aria-current="page">
                  {l.name}
                </span>
              ) : (
                <a key={l.id} href={partnersPath(city, l.id)} hrefLang={l.id}>
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
          <a className="landing-btn landing-btn-primary" href="#demo">
            {doc.ctaDemo}
          </a>
          <a className="landing-btn landing-btn-ghost" href="#contact">
            {doc.ctaForm}
          </a>
        </div>
        <p className="landing-free">{doc.pilot}</p>
      </header>

      <section className="pt-stats" aria-label="RANGE">
        <ul>
          {doc.stats.map((s) => (
            <li key={s.label}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
        <p>{doc.statsNote}</p>
      </section>

      <section className="landing-section" id="demo" aria-labelledby="demo-t">
        <h2 id="demo-t">{doc.demo.title}</h2>
        <p className="landing-cities-lead">{doc.demo.lead}</p>
        <PartnersDemo doc={doc} city={city} />
      </section>

      <section className="landing-section" aria-labelledby="plans-t">
        <h2 id="plans-t">{doc.plansTitle}</h2>
        <p className="landing-cities-lead">{doc.plansLead}</p>
        <ul className="pt-plans">
          {doc.plans.map((p) => (
            <li key={p.id}>
              <span className="pt-pilot">{doc.pilotBadge}</span>
              <h3>{p.name}</h3>
              <p className="pt-tag">{p.tagline}</p>
              <ul>
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="pt-price">
                <b>{money(prices[p.id])}</b> {doc.perMonth}
              </p>
              <p className="pt-price-note">{p.priceNote}</p>
            </li>
          ))}
        </ul>
        <div className="pt-bundle">
          <span className="pt-bundle-tag">−{offPct}%</span>
          <div className="pt-bundle-text">
            <b>{doc.bundle}</b>
            <span>{doc.bundleNote}</span>
          </div>
          <div className="pt-bundle-price">
            <s>{money(sum)}</s>
            <i aria-hidden="true">→</i>
            <b>{money(total)}</b>
            <span>{doc.perMonth}</span>
            <em>
              {doc.bundleSave} {money(sum - total)}
            </em>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="why-t">
        <h2 id="why-t">{doc.whyTitle}</h2>
        <ul className="landing-features">
          {doc.why.map((w) => (
            <li key={w.title}>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="steps-t">
        <h2 id="steps-t">{doc.stepsTitle}</h2>
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

      <section className="pt-contact" id="contact" aria-labelledby="contact-t">
        <h2 id="contact-t">{doc.formTitle}</h2>
        <p>{doc.formLead}</p>
        <PartnersForm doc={doc} />
      </section>

      <section className="pt-app" aria-labelledby="app-t">
        <div>
          <h2 id="app-t">{doc.appTitle}</h2>
          <p>{doc.appText}</p>
        </div>
        <div className="pt-app-btns">
          <a className="landing-btn landing-btn-primary" href={TELEGRAM_BOT_URL}>
            {doc.appTelegram}
          </a>
          <Link className="landing-btn pt-btn-light" href="/" prefetch={false}>
            {doc.appWeb}
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <Link href="/" prefetch={false}>
          {doc.footerApp}
        </Link>
        <a href={LANDING_PATHS[lang]}>{doc.footerAbout}</a>
      </footer>
    </main>
  )
}
