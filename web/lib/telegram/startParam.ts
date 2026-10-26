import { insideTelegram } from '@/lib/openExternal'
import { TELEGRAM_BOT_URL } from '@/lib/data/landing.shared'
import { botStartPayload, decodeStartParam, encodeStartParam } from '@/lib/telegram/startParamCodec'

export { decodeStartParam, encodeStartParam }

// Share links that survive the trip through Telegram.
//
// A plain catchrange.com/?ref=… link opens in Telegram's built-in browser, not
// in the Mini App, and the two keep separate storage: the invite is lost the
// moment the friend opens the bot (found 26.10: of 56 new players who came
// through Telegram, 2 arrived by an invite). Inside Telegram a share link now
// goes through the bot instead:
//   · t.me/<bot>/<app>?startapp=… (or t.me/<bot>?startapp=…) — opens the Mini App
//     itself and hands it `start_param`. Needs NEXT_PUBLIC_TG_APP_LINK: the Mini App's
//     link from BotFather (a Main Mini App, or an app short name). Best: one tap.
//   · t.me/<bot>?start=r_… — works with no BotFather setup: the bot answers /start with
//     the usual welcome and a button that opens the Mini App at catchrange.com/?<query>
//     (app/api/telegram/webhook), so the app sees the same address a web link would give.
// The query of the ordinary link (clan=3&invite=…&ref=…) is carried as base64url, since both
// parameters allow only letters, digits, «_» and «-». At launch a start_param is put back
// into the address bar, so every existing deep-link effect works unchanged.

// The address a share link points at: through Telegram when we are inside it, the website
// otherwise (and when the query is too long for the bot's 64-character start parameter).
export function shareLink(query: string): string {
  if (insideTelegram()) {
    const appLink = process.env.NEXT_PUBLIC_TG_APP_LINK
    if (appLink) return `${appLink}?startapp=${encodeStartParam(query)}`
    const payload = botStartPayload(query)
    if (payload) return `${TELEGRAM_BOT_URL}?start=${payload}`
  }
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
