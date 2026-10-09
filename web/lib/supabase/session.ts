import { createClient } from '@/lib/supabase/client'
import { trySignInWithTelegram } from '@/lib/telegram/signIn'

// The app thinks someone is signed in, but the phone has lost their session:
// every request then goes out as a guest and is refused — a catch photo
// won't upload, nothing saves, and even the error report is refused, so
// nobody hears about it (seen 08.10 in Telegram on an iPhone: the session
// was gone 5 s after a silent Telegram sign-in). On the first such refusal
// this restores the session — silently through Telegram inside the Mini
// App — or, when it can't, signs out on this device so the player lands on
// the sign-in screen instead of a broken app. Either way it's reported.

let expectedUserId: string | null = null
let signedInAt = 0
let inflight: Promise<boolean> | null = null

// Set by AuthProvider whenever the signed-in player changes.
export function setExpectedUser(id: string | null) {
  if (id && id !== expectedUserId) signedInAt = Date.now()
  expectedUserId = id
}

function diagnostics() {
  const cookies = typeof document !== 'undefined' ? document.cookie.split(';').filter((c) => c.trim().startsWith('sb-')).length : -1
  let storage = 'ok'
  try {
    localStorage.setItem('range:probe', '1')
    localStorage.removeItem('range:probe')
  } catch {
    storage = 'blocked'
  }
  const tg = !!window.Telegram?.WebApp?.initData
  return `через ${Math.round((Date.now() - signedInAt) / 1000)} с после входа; sb-cookies ${cookies}; cookieEnabled ${navigator.cookieEnabled}; localStorage ${storage}; ${tg ? 'Telegram' : 'браузер'}; ${navigator.userAgent.slice(0, 120)}`
}

function report(message: string) {
  void createClient()
    .rpc('report_client_error', { p_context: 'auth_lost', p_message: message.slice(0, 500) })
    .then(
      () => {},
      () => {}
    )
}

// True when the player's session is there (or is back). Safe to call often:
// concurrent callers share one check.
export function ensureSession(): Promise<boolean> {
  if (!expectedUserId) return Promise.resolve(false)
  inflight ??= (async () => {
    const supabase = createClient()
    const expected = expectedUserId
    const { data } = await supabase.auth.getSession()
    if (data.session?.user.id === expected) return true
    const why = diagnostics()
    if (await trySignInWithTelegram(supabase, false)) {
      const { data: again } = await supabase.auth.getSession()
      if (again.session?.user.id === expected) {
        report(`сессия пропала ${why} — восстановлена через Telegram`)
        return true
      }
    }
    // Nothing to restore it with: back to the sign-in screen on this device
    // (AuthProvider hears SIGNED_OUT). The report can't go out as a guest, so
    // it waits in this tab until the player is back in.
    pendingReport = `сессия пропала ${why} — игрок отправлен на вход`
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    return false
  })().finally(() => {
    inflight = null
  })
  return inflight
}

let pendingReport: string | null = null
// Called once a player is signed in again.
export function flushSessionReport() {
  if (!pendingReport) return
  report(pendingReport)
  pendingReport = null
}
