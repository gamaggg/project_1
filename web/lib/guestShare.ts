// A «Поделиться» link opened by someone without an account: which screen it
// points at, and who shared it (the ref that pays the invite bonus — see
// claim_referral). The guest sees that screen read-only with a sign-up
// panel; after signing up the same deep link opens it for real.

export type ShareKind = 'territory' | 'user' | 'catch' | 'clan' | 'achievement'
export type GuestShare = { kind: ShareKind; key: string; ref: string | null }

const REF_KEY = 'fishzone:ref'
// How long a remembered invite stays claimable — long enough to sign up
// later the same week, short enough not to credit a stale link.
const REF_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function parseGuestShare(search: string): GuestShare | null {
  const params = new URLSearchParams(search)
  const ref = params.get('ref')
  const pick = (kind: ShareKind, param: string): GuestShare | null => {
    const key = params.get(param)
    return key ? { kind, key, ref } : null
  }
  return (
    pick('territory', 'territory') ??
    pick('catch', 'catch') ??
    pick('user', 'user') ??
    pick('clan', 'clan') ??
    pick('achievement', 'achievement')
  )
}

export function rememberRef(ref: string, source: ShareKind) {
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ ref, source, at: Date.now() }))
  } catch {}
}

export function takeRememberedRef(): { ref: string; source: string } | null {
  try {
    const raw = localStorage.getItem(REF_KEY)
    if (!raw) return null
    localStorage.removeItem(REF_KEY)
    const v = JSON.parse(raw) as { ref?: string; source?: string; at?: number }
    if (!v.ref || !v.at || Date.now() - v.at > REF_TTL_MS) return null
    return { ref: v.ref, source: v.source ?? '' }
  } catch {
    return null
  }
}

// «&ref=<public id>» for share links, when the sharer's id is known.
export function refParam(publicId: string | null | undefined): string {
  return publicId ? `&ref=${encodeURIComponent(publicId)}` : ''
}
