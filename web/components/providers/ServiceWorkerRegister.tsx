'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile } from '@/lib/supabase/queries'

// Switches the offline mode on (public/sw.js): registers the service worker a
// moment after the page is up — never in the way of the first paint — and on
// each launch asks it to bring the app's files up to date. Only in a
// production build (in `next dev` the files change by the second and a
// cached copy would only get in the way). Where the browser has no service
// workers (some in-app browsers) nothing happens and the app works as before.
//
// Rolled out in steps: for everyone it is off (SW_FOR_ALL) and a service
// worker left from an earlier visit is removed; it runs for the super admins
// and for anyone who opens the app once with ?sw=1 (?sw=0 turns it off again).
// Flip SW_FOR_ALL to true to give it to everyone.
const SW_FOR_ALL = false
const FLAG_KEY = 'range:sw'

function manualFlag(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('sw')
    if (q === '1') localStorage.setItem(FLAG_KEY, '1')
    if (q === '0') localStorage.removeItem(FLAG_KEY)
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function ServiceWorkerRegister() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const isAdmin = profile?.isSuperAdmin ?? false

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const enabled = SW_FOR_ALL || isAdmin || manualFlag()
    if (!enabled) {
      // Not for this player (or no longer): drop a worker an earlier visit left.
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister())).catch(() => {})
      return
    }
    let timer = 0
    const start = () => {
      timer = window.setTimeout(() => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then(() => navigator.serviceWorker.ready)
          .then((reg) => reg.active?.postMessage({ type: 'sync' }))
          .catch(() => {})
      }, 2500)
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('load', start)
    }
  }, [isAdmin])
  return null
}
