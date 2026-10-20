'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { tn } from '@/lib/i18n/runtime'

// The captcha Supabase Auth checks before sign-in, sign-up, «забыл пароль» and «отправить код ещё раз»
// (Authentication → Attack Protection → CAPTCHA, provider Cloudflare Turnstile). Each of those screens
// shows our own plate above its button (<CaptchaBox>): a hexagon that checks itself, then claims itself,
// like a sector (flat side up, as the sectors on the map). Cloudflare's check runs behind it in «interaction-only» mode: its own tick shows up inside
// the plate only when Cloudflare cannot decide on its own. The one-time token of a passed check goes to
// the auth call as `options.captchaToken`; the plate asks for a new one after each use.
//
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY nothing is loaded and no plate is drawn, so the app works the
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

// checking: Cloudflare is deciding; ask: it wants a tick from the person (shown inside the plate);
// done: passed, the token is ready; failed: could not load or run.
type Status = 'checking' | 'ask' | 'done' | 'failed'

export type Captcha = {
  enabled: boolean
  status: Status
  // The one-time token of a passed check, null until it passes (and again after it is used).
  token: string | null
  // True when a button may go: the captcha is off, or the check has passed.
  ready: boolean
  // Call after each use of the token: the plate asks Cloudflare for a new one.
  reset: () => void
  _set: (status: Status, token?: string | null) => void
  _resetKey: number
}

export function useCaptcha(): Captcha {
  const [state, setState] = useState<{ status: Status; token: string | null }>({ status: 'checking', token: null })
  const [resetKey, setResetKey] = useState(0)
  const reset = useCallback(() => {
    setState({ status: 'checking', token: null })
    setResetKey((k) => k + 1)
  }, [])
  const set = useCallback((status: Status, token: string | null = null) => setState({ status, token }), [])
  return { enabled: CAPTCHA_ENABLED, status: state.status, token: state.token, ready: !CAPTCHA_ENABLED || (state.status === 'done' && state.token !== null), reset, _set: set, _resetKey: resetKey }
}

// The plate: a hexagon with a line of text; Cloudflare's own widget renders in the box under it.
export function CaptchaBox({ captcha }: { captcha: Captcha }) {
  const ref = useRef<HTMLDivElement>(null)
  const idRef = useRef<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const { _set: set, _resetKey: resetKey, status } = captcha

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
          size: 'flexible',
          // Invisible unless Cloudflare needs a tick from the person.
          appearance: 'interaction-only',
          callback: (t: string) => set('done', t),
          'before-interactive-callback': () => set('ask'),
          'after-interactive-callback': () => set('checking'),
          'expired-callback': () => set('checking'),
          'timeout-callback': () => set('failed'),
          'error-callback': () => {
            set('failed')
            return true
          },
        })
      })
      .catch(() => set('failed'))
    return () => {
      cancelled = true
      if (idRef.current) window.turnstile?.remove(idRef.current)
      idRef.current = null
    }
  }, [set, attempt])

  useEffect(() => {
    if (resetKey > 0 && idRef.current) window.turnstile?.reset(idRef.current)
  }, [resetKey])

  if (!CAPTCHA_ENABLED) return null

  function retry() {
    set('checking')
    if (idRef.current) window.turnstile?.reset(idRef.current)
    else setAttempt((a) => a + 1)
  }

  const text =
    status === 'done' ? tn('onb.captchaDone') : status === 'ask' ? tn('onb.captchaAsk') : status === 'failed' ? tn('onb.captchaFailed') : tn('onb.captchaChecking')
  return (
    <div className={`captcha-plate is-${status}`} role="status" aria-live="polite">
      <div className="captcha-plate-row">
        <svg className="captcha-hex" width="30" height="30" viewBox="0 0 30 30" aria-hidden>
          <polygon className="captcha-hex-shape" points="27.5,15 21.25,25.8 8.75,25.8 2.5,15 8.75,4.2 21.25,4.2" />
          {status === 'done' && <path className="captcha-hex-check" d="M9.5 15.4l3.9 3.9 7.2-7.6" />}
          {status === 'failed' && <path className="captcha-hex-x" d="M11 11l8 8M19 11l-8 8" />}
        </svg>
        <span className="captcha-plate-text">{text}</span>
        {status === 'failed' && (
          <button type="button" className="captcha-retry" onClick={retry}>
            {tn('onb.captchaRetry')}
          </button>
        )}
      </div>
      <div ref={ref} className="captcha-widget" />
    </div>
  )
}

// Supabase answers a refused token with code «captcha_failed» (and a refused request with a
// message that mentions the captcha).
export function isCaptchaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return e?.code === 'captcha_failed' || /captcha/i.test(e?.message ?? '')
}
