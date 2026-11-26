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

// «Купить в Telegram» from the website or the installed app (26.11.2026): «/start b_<key>_<product>» — the one-time key
// of telegram_link_tokens (its uuid without hyphens) and the Stars product. The bot answers with a button that opens the
// Mini App at ?tglink=<key>&buy=<product> (buyQuery); there the key signs the person in to the account that asked for
// the link and ties this Telegram to it (app/api/auth/telegram/claim). 2 + 32 + 1 + 18 characters fit the bot's 64.
export const BOT_BUY_PREFIX = 'b_'
const BUY_PAYLOAD = /^b_([0-9a-f]{32})_([a-z0-9_]{1,24})$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const PRODUCT_ID = /^[a-z0-9_]{1,24}$/

export function isLinkToken(token: string): boolean {
  return UUID.test(token)
}

export function buyStartPayload(token: string, productId: string): string | null {
  if (!UUID.test(token) || !PRODUCT_ID.test(productId)) return null
  const payload = `${BOT_BUY_PREFIX}${token.replace(/-/g, '')}_${productId}`
  return payload.length <= BOT_START_MAX ? payload : null
}

export function parseBuyPayload(payload: string): { token: string; productId: string } | null {
  const m = BUY_PAYLOAD.exec(payload)
  if (!m) return null
  const h = m[1]
  return { token: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`, productId: m[2] }
}

export function buyQuery(token: string, productId: string): string {
  return `tglink=${token}&buy=${productId}`
}
