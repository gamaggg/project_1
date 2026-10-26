import { insideTelegram } from '@/lib/openExternal'

// Share links that survive the trip through Telegram.
//
// A plain catchrange.com/?ref=… link opens in Telegram's built-in browser, not
// in the Mini App, and the two keep separate storage: the invite is lost the
// moment the friend opens the bot (found 26.10: of 56 new players who came
// through Telegram, 2 arrived by an invite). A t.me link with ?startapp=… opens
// the Mini App itself and hands it that value as `start_param`.
//
// startapp may only hold letters, digits, «_» and «-», so the query of the
// ordinary link (clan=3&invite=…&ref=…) is carried as base64url, and at launch
// it is put back into the address bar — every existing deep-link effect then
// works unchanged.
//
// Needs NEXT_PUBLIC_TG_APP_LINK: the Mini App's link from BotFather
// (https://t.me/catchrangebot/<short name>, or https://t.me/catchrangebot
// when a main Mini App is set). Unset, share links stay as they were.

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

// The address a share link points at: the Mini App through Telegram when we are
// inside it and the link is configured, the website otherwise.
export function shareLink(query: string): string {
  const appLink = process.env.NEXT_PUBLIC_TG_APP_LINK
  if (appLink && insideTelegram()) return `${appLink}?startapp=${encodeStartParam(query)}`
  return `${window.location.origin}${window.location.pathname}?${query}`
}

// The launch address for this page load: what Telegram passed as start_param
// is turned back into the query string (only when the page was opened without
// one of its own), then the query is returned as it stands.
export function readLaunchSearch(): string {
  if (typeof window === 'undefined') return ''
  const param = window.Telegram?.WebApp?.initDataUnsafe?.start_param
  if (param && !window.location.search) {
    const query = decodeStartParam(param)
    if (query) window.history.replaceState(window.history.state, '', `${window.location.pathname}?${query}`)
  }
  return window.location.search
}
