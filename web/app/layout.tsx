import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: 'FishZone — Батуми',
  description: 'Береговая рыбалка в Батуми: карта территорий, уловы, активность.',
}

// Without this, mobile Safari has nothing to go on but <body>'s own
// background (#DCDAD3 — the desktop letterbox color around the centered
// app-shell) and tints its own status-bar/toolbar chrome with it, so real
// phones show a gray strip above and below the app that isn't actually
// part of any page layout. This tells it to use the app's real background.
export const viewport: Viewport = {
  themeColor: '#F7F7F4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body
        className={manrope.variable}
        style={{ fontFamily: 'var(--font-manrope), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
