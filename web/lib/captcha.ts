// The captcha Supabase Auth checks before sign-in, sign-up, «забыл пароль» and «отправить код ещё раз»
// (Authentication → Attack Protection → CAPTCHA, provider Cloudflare Turnstile). The page asks Turnstile
// for a one-time token and hands it to the auth call as `options.captchaToken`; Supabase verifies it
// with the secret key. Turnstile is invisible: a person is only asked something (a tick) when it
// cannot decide on its own.
//
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY nothing is loaded and no token is sent, so the app works the
// same with the captcha switched off in Supabase. Turn it on in Supabase only after the key is set
// here (and the build is live), or every sign-in is refused for lack of a token.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TOKEN_TIMEOUT_MS = 25_000

export const CAPTCHA_ENABLED = SITE_KEY !== ''

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  execute: (widgetId: string) => void
  reset: (widgetId: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

export class CaptchaError extends Error {
  constructor(message = 'captcha_failed') {
    super(message)
    this.name = 'CaptchaError'
  }
}

let scriptPromise: Promise<Turnstile> | null = null
function loadScript(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<Turnstile>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new CaptchaError('captcha_script')))
    el.onerror = () => {
      scriptPromise = null
      reject(new CaptchaError('captcha_script'))
    }
    document.head.appendChild(el)
  })
  return scriptPromise
}

// One widget for the whole session. A visible challenge, when one is needed, shows in this box
// (pinned above the bottom of the screen, over whatever step is open).
let widget: { id: string; box: HTMLDivElement } | null = null
let waiting: { resolve: (token: string) => void; reject: (e: CaptchaError) => void } | null = null

function ensureWidget(turnstile: Turnstile) {
  if (widget) return widget
  const box = document.createElement('div')
  box.className = 'captcha-box'
  document.body.appendChild(box)
  const id = turnstile.render(box, {
    sitekey: SITE_KEY,
    execution: 'execute',
    appearance: 'interaction-only',
    theme: 'light',
    callback: (token: string) => {
      waiting?.resolve(token)
      waiting = null
    },
    'error-callback': () => {
      waiting?.reject(new CaptchaError())
      waiting = null
      return true
    },
    'timeout-callback': () => {
      waiting?.reject(new CaptchaError())
      waiting = null
    },
  })
  widget = { id, box }
  return widget
}

// A fresh one-time token for one auth call (undefined when the captcha is not set up). Throws
// CaptchaError when the check could not be completed.
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!CAPTCHA_ENABLED) return undefined
  const turnstile = await loadScript()
  const { id } = ensureWidget(turnstile)
  waiting?.reject(new CaptchaError('captcha_superseded'))
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      waiting = null
      reject(new CaptchaError('captcha_timeout'))
    }, TOKEN_TIMEOUT_MS)
    waiting = {
      resolve: (token) => {
        window.clearTimeout(timer)
          resolve(token)
      },
      reject: (e) => {
        window.clearTimeout(timer)
          reject(e)
      },
    }
    // A token is good for one call: always ask anew.
    turnstile.reset(id)
    turnstile.execute(id)
  })
}

// Supabase answers a refused token with code «captcha_failed» (and a refused request with a
// message that mentions the captcha).
export function isCaptchaError(error: unknown): boolean {
  if (error instanceof CaptchaError) return true
  const e = error as { code?: string; message?: string } | null
  return e?.code === 'captcha_failed' || /captcha/i.test(e?.message ?? '')
}
