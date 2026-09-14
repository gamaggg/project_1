import type { Metadata, Viewport } from 'next'
import { Manrope, Oswald } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
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
export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${oswald.variable}`}
        style={{ fontFamily: 'var(--font-manrope), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        {/* beforeInteractive so window.Telegram.WebApp exists by the time
            AuthProvider's effect checks for it — harmless no-op outside Telegram. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  )
}
