'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type AuthState = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  // Re-runs the Telegram handshake on demand — used by WelcomeStep's
  // "Продолжить" when someone signed out mid-session (see NameStep's
  // "Войти по почте" and ProfileScreen's sign-out) and comes back to a
  // still-open Mini App: initData is still valid, so this logs them straight
  // back into the same telegram_id-linked account rather than leaving them
  // stuck navigating the wizard with no session.
  signInWithTelegram: () => Promise<boolean>
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, signOut: async () => {}, signInWithTelegram: async () => false })

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } }
  }
}

// Silent sign-in for the Telegram Mini App build: initData is only ever
// present when this page is actually running inside Telegram's WebView, so
// this is a no-op everywhere else (regular web, PWA). See
// app/api/auth/telegram/route.ts for the server side of this handshake.
async function trySignInWithTelegram(supabase: ReturnType<typeof createClient>) {
  const initData = window.Telegram?.WebApp?.initData
  if (!initData) return false
  try {
    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    if (!res.ok) return false
    const { email, token } = await res.json()
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'magiclink' })
    return !error
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    window.Telegram?.WebApp?.ready()
    window.Telegram?.WebApp?.expand()

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user && (await trySignInWithTelegram(supabase))) {
        const { data: refreshed } = await supabase.auth.getUser()
        setUser(refreshed.user)
      } else {
        setUser(data.user)
      }
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  async function signInWithTelegram() {
    const supabase = createClient()
    const ok = await trySignInWithTelegram(supabase)
    if (ok) {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    return ok
  }

  return <AuthContext.Provider value={{ user, loading, signOut, signInWithTelegram }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
