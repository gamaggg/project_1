// A «Поделиться» link opened by someone without an account: which screen it
// points at, and who shared it (the ref that pays the invite bonus — see
// claim_referral). The guest sees that screen read-only with a sign-up
// panel; after signing up the same deep link opens it for real.

export type ShareKind = 'territory' | 'user' | 'catch' | 'clan' | 'achievement'
export type GuestShare = { kind: ShareKind; key: string; ref: string | null; invite: string | null }

const REF_KEY = 'fishzone:ref'
// How long a remembered invite stays claimable — long enough to sign up
// later the same week, short enough not to credit a stale link.
const REF_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function parseGuestShare(search: string): GuestShare | null {
  const params = new URLSearchParams(search)
  const ref = params.get('ref')
  const invite = params.get('invite')
  const pick = (kind: ShareKind, param: string): GuestShare | null => {
    const key = params.get(param)
    return key ? { kind, key, ref, invite } : null
  }
  return (
    pick('territory', 'territory') ??
    pick('catch', 'catch') ??
    pick('user', 'user') ??
    pick('clan', 'clan') ??
    pick('achievement', 'achievement')
  )
}

// source: which shared screen the link pointed at, or 'invite' for the
// profile's plain «Пригласить друзей» link (?ref= alone).
export function rememberRef(ref: string, source: ShareKind | 'invite') {
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

// The profile's «Пригласить друзей» link — the app itself, credited to you.
export function inviteLink(publicId: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(publicId)}`
}

// «&ref=<public id>» for share links, when the sharer's id is known.
export function refParam(publicId: string | null | undefined): string {
  return publicId ? `&ref=${encodeURIComponent(publicId)}` : ''
}

// A clan's invite link (?clan=<id>&invite=<code>, see shareClan) — the code
// is what lets someone join an invite-only clan (join_clan's p_invite_code).
// Kept in storage so the join button still works after signing up, a
// sign-in link reload or an app restart; the same week-long life as a ref.
export type ClanInvite = { clanId: number; code: string }
const CLAN_INVITE_KEY = 'fishzone:clanInvite'

export function rememberClanInvite(search: string): ClanInvite | null {
  const params = new URLSearchParams(search)
  const clanId = Number(params.get('clan'))
  const code = params.get('invite')
  const fromUrl = code && Number.isInteger(clanId) && clanId > 0 ? { clanId, code } : null
  try {
    if (fromUrl) {
      localStorage.setItem(CLAN_INVITE_KEY, JSON.stringify({ ...fromUrl, at: Date.now() }))
      return fromUrl
    }
    const raw = localStorage.getItem(CLAN_INVITE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { clanId?: number; code?: string; at?: number }
    if (!v.clanId || !v.code || !v.at || Date.now() - v.at > REF_TTL_MS) return null
    return { clanId: v.clanId, code: v.code }
  } catch {
    return fromUrl
  }
}

export function forgetClanInvite() {
  try {
    localStorage.removeItem(CLAN_INVITE_KEY)
  } catch {}
}
