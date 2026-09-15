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

type TelegramSafeAreaInset = { top: number; bottom: number; left: number; right: number }

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        ready: () => void
        expand: () => void
        requestFullscreen?: () => void
        isFullscreen?: boolean
        isVersionAtLeast?: (version: string) => boolean
        safeAreaInset?: TelegramSafeAreaInset
        contentSafeAreaInset?: TelegramSafeAreaInset
        onEvent?: (type: string, cb: () => void) => void
        offEvent?: (type: string, cb: () => void) => void
        enableClosingConfirmation?: () => void
        disableVerticalSwipes?: () => void
        BackButton?: {
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
          offClick: (cb: () => void) => void
        }
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
          selectionChanged: () => void
        }
        // Bot API 8.0+ — prompts the OS's own "add to home screen" flow.
        // checkHomeScreenStatus's callback fires once with the current state;
        // 'unsupported' covers both an old client and a platform that can't
        // do this at all (desktop Telegram, most notably).
        addToHomeScreen?: () => void
        checkHomeScreenStatus?: (cb: (status: 'unsupported' | 'unknown' | 'added' | 'missed') => void) => void
      }
    }
  }
}

// Telegram's own chrome (the header bar with the Close button, still shown
// even in fullscreen mode — see BotFather's "Launch Mode") floats on top of
// the page rather than reserving layout space, so our own back buttons need
// pushing down by however much it actually occupies. contentSafeAreaInset is
// specifically "how much of the top is covered by Telegram's UI, not the
// device's" (safeAreaInset alone is just the device notch, already covered
// by env(safe-area-inset-top)) — see globals.css's --tg-safe-area-top.
// Bot API 8.0+; both fields are undefined on older clients, hence the `?? 0`.
function applyTelegramChrome() {
  const webApp = window.Telegram?.WebApp
  if (!webApp) return
  const top = webApp.contentSafeAreaInset?.top ?? webApp.safeAreaInset?.top ?? 0
  const bottom = webApp.contentSafeAreaInset?.bottom ?? webApp.safeAreaInset?.bottom ?? 0
  document.documentElement.style.setProperty('--tg-safe-area-top', `${top}px`)
  document.documentElement.style.setProperty('--tg-safe-area-bottom', `${bottom}px`)
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
    const webApp = window.Telegram?.WebApp
    webApp?.ready()
    webApp?.expand()
    // Without this, a downward drag on content already scrolled to the top
    // (map, any list) is read by Telegram's own chrome as "swipe to
    // minimize/close" instead of reaching our page — this is what was
    // collapsing the app out of fullscreen on a top-of-map scroll-down.
    webApp?.disableVerticalSwipes?.()
    // Tried Telegram's own "changes may be lost" confirmation
    // (enableClosingConfirmation) on Close/swipe-down, but its text is fixed
    // by the client — not something the Web App API lets a Mini App
    // customize — and it fired on every close regardless of whether
    // anything was actually unsaved, which read as just plain annoying.
    // Reverted; see git log if revisiting this.
    // BotFather's "Launch Mode: Fullscreen" is only a default hint — some
    // clients honor it inconsistently (this is the likely cause if fullscreen
    // opens for one Telegram account/device but not another). Requesting it
    // directly from the app is the more reliable path. Guarded twice: the
    // SDK's own compatibility shim (loaded even on a plain, non-Telegram
    // page — see layout.tsx) reports itself as version 6.0 and *throws* an
    // uncaught error if requestFullscreen (Bot API 8.0+) is called anyway,
    // so isVersionAtLeast has to gate the call, not just optional-chaining;
    // the try/catch is a second net in case some other client version does
    // the same for a method this build doesn't yet know to gate.
    try {
      if (webApp?.isVersionAtLeast?.('8.0')) webApp.requestFullscreen?.()
    } catch {}
    applyTelegramChrome()
    webApp?.onEvent?.('contentSafeAreaChanged', applyTelegramChrome)
    webApp?.onEvent?.('safeAreaChanged', applyTelegramChrome)
    webApp?.onEvent?.('fullscreenChanged', applyTelegramChrome)

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

    return () => {
      subscription.subscription.unsubscribe()
      webApp?.offEvent?.('contentSafeAreaChanged', applyTelegramChrome)
      webApp?.offEvent?.('safeAreaChanged', applyTelegramChrome)
      webApp?.offEvent?.('fullscreenChanged', applyTelegramChrome)
    }
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
