import type { Metadata, Viewport } from 'next'
import { Manrope, Oswald } from 'next/font/google'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
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

export const metadata: Metadata = {
  title: 'RANGE — Батуми',
  description: 'Береговая рыбалка в Батуми: карта территорий, уловы, активность.',
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
    <html lang="ru">
      <body
        className={`${manrope.variable} ${oswald.variable}`}
        style={{ fontFamily: 'var(--font-manrope), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
