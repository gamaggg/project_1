'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/app-shell/BackButton'
import { tn } from '@/lib/i18n/runtime'
import { getCaptchaToken, isCaptchaError } from '@/lib/captcha'

// Mirrors the old AuthForm's signin mode exactly (same copy, same error
// text) — just given its own screen now that AuthForm itself is retired.
// On success there's nothing to do here: onAuthStateChange (AuthProvider)
// updates `user`, and FishZoneApp's gate reacts (existing accounts have
// onboarding_completed=true by default, so it drops straight to the map).
export function SignInStep({ onBack, onForgotPassword }: { onBack: () => void; onForgotPassword: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const supabase = createClient()
    let captchaToken: string | undefined
    try {
      captchaToken = await getCaptchaToken()
    } catch {
      setPending(false)
      setError(tn('onb.captchaFailed'))
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
    setPending(false)
    if (error) setError(isCaptchaError(error) ? tn('onb.captchaFailed') : error.code === 'email_not_confirmed' ? tn('onb.needConfirm') : tn('onb.badLogin'))
  }

  return (
    <div className="onboarding-step">
      <div className="header-row" style={{ padding: 0, marginBottom: 12 }}>
        <BackButton onClick={onBack} />
      </div>
      <div className="auth-card">
        <div className="page-title" style={{ textAlign: 'center', fontSize: 24 }}>
          {tn('onb.signIn')}
        </div>
        <div className="page-sub" style={{ textAlign: 'center' }}>
          {tn('onb.signInSub')}
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="auth-field">
            <label htmlFor="signin-email">Email</label>
            <input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="auth-field">
            <label htmlFor="signin-password">{tn('onb.password')}</label>
            <input
              id="signin-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tn('onb.min6')}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? tn('onb.wait') : tn('onb.doSignIn')}
          </button>
          <button type="button" className="otp-resend" style={{ display: 'block', margin: '14px auto 0', textAlign: 'center' }} onClick={onForgotPassword}>
            {tn('onb.forgot')}
          </button>
        </form>
      </div>
    </div>
  )
}
