'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// The captcha Supabase Auth checks before sign-in, sign-up, «забыл пароль» and «отправить код ещё раз»
// (Authentication → Attack Protection → CAPTCHA, provider Cloudflare Turnstile). Each of those screens
// shows a small Cloudflare check above its button (<CaptchaBox>); once it passes, the one-time token
// goes to the auth call as `options.captchaToken`, and the box asks for a new one (a token works once).
//
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY nothing is loaded and no box is drawn, so the app works the
// same with the captcha switched off in Supabase. Turn it on in Supabase only after the key is set
// here (and the build is live), or every sign-in is refused for lack of a token.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export const CAPTCHA_ENABLED = SITE_KEY !== ''

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let scriptPromise: Promise<Turnstile> | null = null
function loadScript(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<Turnstile>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('captcha_script')))
    el.onerror = () => {
      scriptPromise = null
      reject(new Error('captcha_script'))
    }
    document.head.appendChild(el)
  })
  return scriptPromise
}

export type Captcha = {
  enabled: boolean
  // The one-time token of a passed check, null until it passes (and again after it is used).
  token: string | null
  // The check could not load or run (blocked script, no network).
  failed: boolean
  // True when a button may go: the captcha is off, or the check has passed.
  ready: boolean
  // Call after each use of the token: the box asks Cloudflare for a new one.
  reset: () => void
  _set: (token: string | null, failed?: boolean) => void
  _resetKey: number
}

export function useCaptcha(): Captcha {
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const reset = useCallback(() => {
    setToken(null)
    setResetKey((k) => k + 1)
  }, [])
  const set = useCallback((t: string | null, fail = false) => {
    setToken(t)
    setFailed(fail)
  }, [])
  return { enabled: CAPTCHA_ENABLED, token, failed, ready: !CAPTCHA_ENABLED || token !== null, reset, _set: set, _resetKey: resetKey }
}

// The Cloudflare box itself. Put it above the screen's submit button.
export function CaptchaBox({ captcha }: { captcha: Captcha }) {
  const ref = useRef<HTMLDivElement>(null)
  const idRef = useRef<string | null>(null)
  const { _set: set, _resetKey: resetKey } = captcha

  useEffect(() => {
    if (!CAPTCHA_ENABLED || !ref.current) return
    let cancelled = false
    loadScript()
      .then((turnstile) => {
        if (cancelled || !ref.current) return
        idRef.current = turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme: 'light',
          language: 'auto',
          callback: (t: string) => set(t),
          'expired-callback': () => set(null),
          'timeout-callback': () => set(null),
          'error-callback': () => {
            set(null, true)
            return true
          },
        })
      })
      .catch(() => set(null, true))
    return () => {
      cancelled = true
      if (idRef.current) window.turnstile?.remove(idRef.current)
      idRef.current = null
    }
  }, [set])

  useEffect(() => {
    if (resetKey > 0 && idRef.current) window.turnstile?.reset(idRef.current)
  }, [resetKey])

  if (!CAPTCHA_ENABLED) return null
  return <div ref={ref} className="captcha-inline" />
}

// Supabase answers a refused token with code «captcha_failed» (and a refused request with a
// message that mentions the captcha).
export function isCaptchaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return e?.code === 'captcha_failed' || /captcha/i.test(e?.message ?? '')
}
