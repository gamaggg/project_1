import { FishZoneApp } from '@/components/app-shell/FishZoneApp'
import { TELEGRAM_BOT_URL } from '@/lib/data/landing.shared'
import { SITE_URL } from '@/lib/site'

// The app draws everything in the browser, so the server-sent page had no
// links at all: a search engine could not get from here to the landing page.
// The links below are sent with the page (hidden on screen, read by screen
// readers and crawlers) together with the structured data about the site.
const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RANGE',
    url: SITE_URL,
    inLanguage: 'ru',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RANGE',
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    sameAs: [TELEGRAM_BOT_URL],
  },
]

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <nav className="sr-only" aria-label="RANGE">
        <a href="/about">Что такое RANGE</a>
        <a href="/about/en" hrefLang="en">About RANGE</a>
        <a href="/about/ka" hrefLang="ka">RANGE-ის შესახებ</a>
        <a href="/privacy">Политика конфиденциальности</a>
      </nav>
      <FishZoneApp />
    </>
  )
}
