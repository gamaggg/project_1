import type { Metadata, Viewport } from 'next'
import { Manrope, Oswald, Unbounded } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-manrope',
})

const oswald = Oswald({
  subsets: ['latin', 'cyrillic'],
  weight: '700',
  variable: '--font-display',
})

// The welcome screen's headline only — not preloaded on every page, fetched
// when that screen shows it.
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: '900',
  variable: '--font-welcome',
  preload: false,
})

const TITLE = 'RANGE: Cast & Claim Territory'
const DESCRIPTION = 'Каждый улов меняет карту. Захватывай территории, собирай награды, обгоняй соперников.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['рыбалка', 'Батуми', 'Москва', 'территории', 'RANGE', 'береговая рыбалка', 'Грузия'],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'RANGE',
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  // Short label shown under the icon on iOS when someone adds the site to
  // their Home Screen — otherwise iOS falls back to the full <title>, which
  // is too long to fit under the icon. Matches manifest.ts's short_name.
  appleWebApp: {
    // Without `capable`, Next.js never emits apple-mobile-web-app-capable —
    // an iOS "Add to Home Screen" then opens in ordinary Safari chrome
    // (address bar and all) instead of standalone, silently defeating the
    // whole point of the manifest below.
    capable: true,
    title: 'RANGE',
    statusBarStyle: 'black-translucent',
  },
}

// themeColor alone turned out not to be enough on real devices (Safari kept
// its status-bar/toolbar chrome its own default gray instead of picking up
// the page color). viewportFit:'cover' makes the page actually extend under
// the notch/home-indicator safe areas — combined with the safe-area padding
// on .screen/.bottomnav in globals.css, that guarantees the app's own
// background (not <body>'s #DCDAD3 desktop-letterbox gray, and not
// whatever default Safari would otherwise show) fills those strips.
//
// maximumScale:1 stops iOS (Safari and Telegram's in-app view) zooming the
// whole page in when a text field with a font under 16px gets focus — the
// clan chat, comments, clan editor and search fields all are, and the page
// stayed zoomed with its right edge cut off. Only the auth fields used to be
// bumped to 16px for this; one page-wide setting covers every field, present
// and future. The map zooms with its own gestures, unaffected.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FFFFFF',
  viewportFit: 'cover',
}

// The iPhone home-screen app: marked before the first paint, so the CSS that
// stretches it to the full screen (globals.css, .ios-standalone) applies from
// the start rather than after the app loads. navigator.standalone exists only
// on iOS.
const IOS_STANDALONE = `if(navigator.standalone===true)document.documentElement.classList.add('ios-standalone')`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${oswald.variable} ${unbounded.variable}`}
        style={{ fontFamily: 'var(--font-manrope), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        <Script id="ios-standalone" strategy="beforeInteractive">
          {IOS_STANDALONE}
        </Script>
        {/* beforeInteractive so window.Telegram.WebApp exists by the time
            AuthProvider's effect checks for it — harmless no-op outside Telegram. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <QueryProvider>
          <AuthProvider>
            <I18nProvider>{children}</I18nProvider>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  )
}
