import type { createClient } from '@/lib/supabase/client'

// Silent sign-in for the Telegram Mini App build: initData is only ever
// present when this page is actually running inside Telegram's WebView, so
// this is a no-op everywhere else (regular web, PWA). See
// app/api/auth/telegram/route.ts for the server side of this handshake.
// `create`: false for the silent check at launch — only an account this
// Telegram already belongs to is signed in, none is made (someone who plays
// on the web must not get a second, empty account just by opening the Mini
// App). True only for Welcome's explicit «start».
// One attempt at a time per kind: a double tap on «start» (or the launch check and «start»
// together) used to send two sign-ins for a brand-new player at once — one made the
// account, the other hit the duplicate and the server answered 500.
const inFlight: Partial<Record<'check' | 'create', Promise<TelegramSignInResult>>> = {}

// ok: signed in. no_account: this Telegram has no account yet (only for the silent check).
// failed: the server or the network let us down, even after the retry.
export type TelegramSignInResult = 'ok' | 'no_account' | 'failed'

export function trySignInWithTelegram(supabase: ReturnType<typeof createClient>, create: boolean): Promise<TelegramSignInResult> {
  const kind = create ? 'create' : 'check'
  const running = inFlight[kind]
  if (running) return running
  const attempt = signInWithRetry(supabase, create).finally(() => {
    delete inFlight[kind]
  })
  inFlight[kind] = attempt
  return attempt
}

// The sign-in is one request to our server (which asks Supabase Auth for a token) and one to
// Supabase to redeem it. Either can hit a slow moment — Supabase Auth answered 500/504 timeouts on
// 23.10 — and a single failed attempt used to land the player on the sign-in screen. One more try
// after a pause, with a freshly minted token (the first may already be spent); a definite answer
// (bad signature, no account) is never retried.
const RETRY_DELAY_MS = 1500

async function signInWithRetry(supabase: ReturnType<typeof createClient>, create: boolean): Promise<TelegramSignInResult> {
  const first = await signIn(supabase, create)
  if (first !== 'retry') return first
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  const second = await signIn(supabase, create)
  return second === 'retry' ? 'failed' : second
}

async function signIn(supabase: ReturnType<typeof createClient>, create: boolean): Promise<TelegramSignInResult | 'retry'> {
  const initData = window.Telegram?.WebApp?.initData
  if (!initData) return 'failed'
  try {
    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, create }),
    })
    if (res.status >= 500) return 'retry'
    if (!res.ok) return 'failed'
    const body = (await res.json()) as { status?: string; email?: string; token?: string }
    if (body.status === 'no_account') return 'no_account'
    if (!body.email || !body.token) return 'failed'
    const { error } = await supabase.auth.verifyOtp({ email: body.email, token: body.token, type: 'magiclink' })
    if (!error) return 'ok'
    return error.name === 'AuthRetryableFetchError' || (error.status ?? 0) >= 500 ? 'retry' : 'failed'
  } catch {
    return 'retry'
  }
}
