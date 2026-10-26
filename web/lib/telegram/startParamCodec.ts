// The pure half of lib/telegram/startParam.ts (no browser access), so the bot's webhook can read
// what the app wrote. See there for why share links travel as base64url.

const MAX_PARAM = 512
const SAFE_QUERY = /^[A-Za-z0-9_=&%.:+\-]*$/

export function encodeStartParam(query: string): string {
  const bytes = new TextEncoder().encode(query)
  const b64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeStartParam(param: string): string | null {
  if (!param || param.length > MAX_PARAM || !/^[A-Za-z0-9_-]+$/.test(param)) return null
  try {
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const query = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    return SAFE_QUERY.test(query) ? query : null
  } catch {
    return null
  }
}

// «/start r_<encoded query>» is how a share link reaches the bot (the start parameter of a bot link
// holds at most 64 characters of the same alphabet). The address the Mini App button then opens.
export const BOT_START_PREFIX = 'r_'
export const BOT_START_MAX = 64

export function botStartPayload(query: string): string | null {
  const payload = BOT_START_PREFIX + encodeStartParam(query)
  return payload.length <= BOT_START_MAX ? payload : null
}

export function miniAppUrlForPayload(payload: string, siteUrl: string): string {
  if (!payload.startsWith(BOT_START_PREFIX)) return siteUrl
  const query = decodeStartParam(payload.slice(BOT_START_PREFIX.length))
  return query ? `${siteUrl}/?${query}` : siteUrl
}
