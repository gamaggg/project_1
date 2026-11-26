import { QueryProvider } from '@/components/providers/QueryProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ServiceWorkerRegister } from '@/components/providers/ServiceWorkerRegister'
import { I18nProvider } from '@/lib/i18n'
import '../globals.css'
import '../nav-glass.css'
import '../intro-demo.css'
import '../journey.css'
import '../hex-loader.css'
import '../profile-blocks.css'
import '../alive.css'
import '../species-screen.css'

// The app and the pages built on its pieces (partners, previews). A route group:
// the addresses are unchanged. The landing (/about) and the privacy policy sit
// outside it and don't download any of this (they used to load 1.5 MB of the
// app's code and 384 KB of its styles they never used).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorkerRegister />
      </AuthProvider>
    </QueryProvider>
  )
}
