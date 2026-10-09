import type { createClient } from '@/lib/supabase/client'

// Silent sign-in for the Telegram Mini App build: initData is only ever
// present when this page is actually running inside Telegram's WebView, so
// this is a no-op everywhere else (regular web, PWA). See
// app/api/auth/telegram/route.ts for the server side of this handshake.
// `create`: false for the silent check at launch — only an account this
// Telegram already belongs to is signed in, none is made (someone who plays
// on the web must not get a second, empty account just by opening the Mini
// App). True only for Welcome's explicit «start».
export async function trySignInWithTelegram(supabase: ReturnType<typeof createClient>, create: boolean) {
  const initData = window.Telegram?.WebApp?.initData
  if (!initData) return false
  try {
    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, create }),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { status?: string; email?: string; token?: string }
    if (body.status === 'no_account' || !body.email || !body.token) return false
    const { error } = await supabase.auth.verifyOtp({ email: body.email, token: body.token, type: 'magiclink' })
    return !error
  } catch {
    return false
  }
}
