import { createClient } from '@/lib/supabase/client'
import { reportsEnabled } from '@/lib/errorReporting'
import { trySignInWithTelegram } from '@/lib/telegram/signIn'

// The app thinks someone is signed in, but the phone has lost their session:
// every request then goes out as a guest and is refused — a catch photo
// won't upload, nothing saves, and even the error report is refused, so
// nobody hears about it (seen 08.10 in Telegram on an iPhone: the session
// was gone 5 s after a silent Telegram sign-in). On the first such refusal
// this looks again, refreshes the token and restores the session — silently
// through Telegram inside the Mini App.
//
// It NEVER signs anyone out (rule of the owner, 26.10: a player leaves only
// by pressing «Выйти» or by clearing the browser's data). Until 26.10 a session that could
// not be read was ended on the spot, and one such case was a false alarm: the server had
// refreshed the session that very second. Now, when nothing brings the session back, the
// player stays in the app and the failed action reports its own error; the next try looks
// again. The report waits in this tab until a session is back, since as a guest it is refused.

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
  if (!reportsEnabled) return
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
  // No network: nothing can be checked, and a session that can't be refreshed
  // right now is not a lost one — never sign anybody out for that.
  if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(true)
  inflight ??= (async () => {
    const supabase = createClient()
    const expected = expectedUserId
    let { data } = await supabase.auth.getSession()
    if (data.session?.user.id !== expected) {
      // A token refresh in flight can make the session read as empty for a moment (26.10: the server
      // refreshed a player's session at 13:20:42 and the app, asking the same second, signed them out
      // of a perfectly good session). One more look after a short wait before calling it lost.
      await new Promise((resolve) => setTimeout(resolve, 1500))
      ;({ data } = await supabase.auth.getSession())
    }
    if (data.session?.user.id === expected) return true
    // A stored refresh token can still bring it back.
    const { data: refreshed } = await supabase.auth.refreshSession()
    if (refreshed.session?.user.id === expected) return true
    const why = diagnostics()
    if (await trySignInWithTelegram(supabase, false)) {
      const { data: again } = await supabase.auth.getSession()
      // Restored silently: nobody needs an alarm for something that healed
      // itself (it fired for every such case until 16.10). Only a player we
      // couldn't bring back is reported, below.
      if (again.session?.user.id === expected) return true
    }
    // Nothing brought it back: the player stays where they are, and the report
    // goes out once a session is there again (flushSessionReport).
    pendingReport = `сессия не читается ${why} — игрок оставлен в приложении`
    return false
  })()
    .then((ok) => {
      // The player now stays signed in through a failure, so AuthProvider never sees them «come
      // back»: a report held back by an earlier failure goes out on the next check that succeeds.
      if (ok) flushSessionReport()
      return ok
    })
    .finally(() => {
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
