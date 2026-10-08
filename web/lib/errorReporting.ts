// «Что-то сломалось» without waiting for a player to complain: every request
// to the database that fails for a reason that isn't the player's — a missing
// function, table or column, no rights, a check the app broke, a timeout, a
// server error — and every uncaught error in the app's own code is reported
// as a client error. system_health_tick (pg_cron, every 5 minutes) turns them
// into a plain-language alert for the super admins, in the app and in
// Telegram. Expected refusals aren't reported: a `raise exception` from the
// game's own rules (cooldown, shield, «not enough coins» — P0001), a repeated
// like (23505), an empty `.single()` (PGRST116), an expired session (401).

type Reporter = (context: string, message: string) => void

const EXPECTED_CODES = new Set(['P0001', '23505', 'PGRST116', 'PGRST301', 'PGRST303'])
const REPEAT_MS = 5 * 60_000
const lastSent = new Map<string, number>()

// The same problem from the same tab at most once per 5 minutes — the server
// caps a person at 20 reports an hour anyway.
function once(key: string): boolean {
  const now = Date.now()
  const last = lastSent.get(key)
  if (last !== undefined && now - last < REPEAT_MS) return false
  lastSent.set(key, now)
  return true
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  } catch {
    return null
  }
}

// The Supabase client's fetch. Network failures (offline) throw and pass
// straight through — those are the phone's, not ours.
export function reportingFetch(report: Reporter): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init)
    if (res.ok) return res
    try {
      const url = requestUrl(input)
      if (!url || url.pathname.endsWith('/rpc/report_client_error')) return res
      const rest = url.pathname.match(/\/rest\/v1\/(?:rpc\/)?([^/]+)/)
      if (!rest) {
        if (res.status >= 500 && url.pathname.includes('/storage/')) {
          if (once('storage' + res.status)) report('storage', `HTTP ${res.status}`)
        }
        return res
      }
      let code = ''
      let message = ''
      try {
        const body = (await res.clone().json()) as { code?: string; message?: string }
        code = body.code ?? ''
        message = body.message ?? ''
      } catch {}
      if (EXPECTED_CODES.has(code) || (res.status === 401 && !code)) return res
      const context = `db:${rest[1]}`.slice(0, 40)
      if (once(context + code)) report(context, [code || `HTTP ${res.status}`, message].filter(Boolean).join(': '))
    } catch {}
    return res
  }
}

// Noise a browser raises on its own: cross-origin script errors with no
// detail, the ResizeObserver loop warning, a lost network, an old tab missing
// a chunk after a deploy (lib/appUpdate.ts reloads it).
const IGNORED_JS = /^(Script error\.?|ResizeObserver loop|Load failed|Failed to fetch|NetworkError|AbortError|ChunkLoadError|Loading chunk)/i

export function installGlobalErrorReporting(report: Reporter): () => void {
  const send = (name: string, message: string, where: string) => {
    const text = `${name}: ${message}`.trim()
    if (!message || IGNORED_JS.test(message) || IGNORED_JS.test(name)) return
    if (once('js' + text)) report('js', `${text}${where ? ` @ ${where}` : ''}`.slice(0, 500))
  }
  const onError = (e: ErrorEvent) => {
    if (e.filename && !e.filename.startsWith(window.location.origin)) return
    const err = e.error as Error | undefined
    send(err?.name ?? 'Error', err?.message ?? e.message ?? '', e.filename ? `${e.filename.replace(window.location.origin, '')}:${e.lineno}` : '')
  }
  const onRejection = (e: PromiseRejectionEvent) => {
    const r = e.reason as { name?: string; message?: string; code?: string } | undefined
    // A Supabase error that reached here was already judged by reportingFetch.
    if (r && typeof r === 'object' && 'code' in r && !(r instanceof Error)) return
    send(r?.name ?? 'Error', r?.message ?? String(e.reason ?? ''), '')
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
