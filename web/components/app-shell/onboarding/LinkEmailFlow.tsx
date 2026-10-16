'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OtpCodeStep } from '@/components/app-shell/onboarding/OtpCodeStep'
import { BackButton } from '@/components/app-shell/BackButton'
import { tn } from '@/lib/i18n/runtime'

// Rendered by FishZoneApp itself, same top-level-gate pattern as
// ForgotPasswordFlow — triggered from ProfileScreen for an account whose
// email is still the synthetic tg_<id>@telegram.catchrange.com one (see
// AuthProvider/api/auth/telegram). updateUser({email,password}) sets the
// password immediately and only the new email needs to confirm (verified
// live earlier — this project has no double opt-in), so by the time the
// OTP step's onVerified fires, the account already has a real email+password
// usable both from the Telegram Mini App and from the website's SignInStep.
type Step = 'form' | 'code' | 'done'

export function LinkEmailFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && passwordConfirm.length >= 6 && !mismatch

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: email.trim(), password })
    setPending(false)
    if (error) setError(error.message === 'User already registered' ? tn('onb.emailTaken') : error.message)
    else setStep('code')
  }

  if (step === 'code') {
    return (
      <OtpCodeStep
        email={email.trim()}
        type="email_change"
        title={tn('onb.checkNewMail')}
        subtitle={tn('onb.codeSentLink', { email: email.trim() })}
        ctaLabel={tn('onb.link')}
        onBack={() => setStep('form')}
        onVerified={async () => {
          // verifyOtp above only proves the new address — this project's
          // "secure email change" also wants a confirmation from the old
          // one, which for a Telegram account is an unreachable synthetic
          // placeholder (see complete-email-link/route.ts). Finish the swap
          // server-side, then refresh so the client's session (and
          // ProfileScreen's isTelegramAccount check) sees the new email.
          await fetch('/api/auth/complete-email-link', { method: 'POST' })
          await createClient().auth.refreshSession()
          setStep('done')
        }}
        onResend={() => createClient().auth.updateUser({ email: email.trim() })}
      />
    )
  }

  if (step === 'done') {
    return (
      <div className="intro-screen intro-screen--catch">
        <BackButton onClick={onDone} variant="intro" />
        <div className="sector-stage">
          <div className="sector-hex-wrap">
            <div className="sector-hex claimed">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l7 12 11-16" />
              </svg>
            </div>
            <div className="sector-pin" />
          </div>
        </div>
        <div className="intro-copy">
          <div className="intro-title">{tn('onb.linked')}</div>
          <div className="intro-sub">{tn('onb.linkedSub')}</div>
          <button className="intro-cta" onClick={onDone}>
            {tn('common.done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <BackButton onClick={onCancel} variant="intro" />
      <div className="sector-stage">
        <div className="otp-icon-wrap">
          <div className="otp-icon-ring" />
          <div className="otp-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">{tn('onb.linkTitle')}</div>
        <div className="intro-sub">{tn('onb.linkSub')}</div>
      </div>
      <form onSubmit={handleSubmit} className="wizard-anim-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <label htmlFor="link-email">Email</label>
          <input id="link-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="wizard-field">
          <label htmlFor="link-password">{tn('onb.password')}</label>
          <input id="link-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tn('onb.min6')} />
        </div>
        <div className="wizard-field">
          <label htmlFor="link-password-confirm">{tn('onb.repeatPass')}</label>
          <input
            id="link-password-confirm"
            type="password"
            required
            minLength={6}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder={tn('onb.againPass')}
          />
          {mismatch && <div style={{ fontSize: 12.5, color: '#D33', marginTop: 4 }}>{tn('onb.mismatch')}</div>}
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div style={{ flex: 1 }} />
        <button className="intro-cta" type="submit" disabled={!valid || pending} style={!valid || pending ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          {pending ? tn('onb.sending') : tn('onb.sendCode')}
        </button>
      </form>
    </div>
  )
}
