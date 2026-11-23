// Where a new player came from: links in RANGE's social accounts point at
// catchrange.com/?from=<platform> (tiktok, instagram, threads, youtube, facebook…).
// The label is kept in this browser until the account exists, then handed to
// set_signup_source once (the server keeps only the first label of a brand-new
// account). Inside Telegram the same query arrives through start_param
// (readLaunchSearch), so ?startapp=… links work too.
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

const FROM_KEY = 'fishzone:from'
// A link opened this month still counts if the account is made later.
const FROM_TTL_MS = 30 * 24 * 60 * 60 * 1000
const FROM_RE = /^[a-z0-9_-]{1,32}$/

// ?from=… (or ?utm_source=…, as other tools write it), checked and lower-cased.
export function launchSource(search: string): string | null {
  const params = new URLSearchParams(search)
  const raw = (params.get('from') ?? params.get('utm_source') ?? '').trim().toLowerCase()
  return FROM_RE.test(raw) ? raw : null
}

// The latest link wins: it is the post that finally brought them in.
export function rememberSource(from: string) {
  try {
    localStorage.setItem(FROM_KEY, JSON.stringify({ from, at: Date.now() }))
  } catch {}
}

// Stays in storage until the server has answered for it (forgetRememberedSource),
// so a failed request is tried again on the next launch.
export function peekRememberedSource(): string | null {
  try {
    const raw = localStorage.getItem(FROM_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { from?: string; at?: number }
    if (!v.from || !v.at || !FROM_RE.test(v.from) || Date.now() - v.at > FROM_TTL_MS) {
      localStorage.removeItem(FROM_KEY)
      return null
    }
    return v.from
  } catch {
    return null
  }
}

export function forgetRememberedSource() {
  try {
    localStorage.removeItem(FROM_KEY)
  } catch {}
}
