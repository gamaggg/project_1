'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// First real step of the wizard: creates the Supabase account right away
// (no name/details/color yet — those get filled in via useUpdateProfile in
// later steps). Doing it this early means a refresh mid-wizard resumes from
// real account state instead of losing everything typed so far. On success,
// nothing to do here — the parent OnboardingFlow's resume effect picks up
// the new session + freshly-inserted (onboarding_completed:false) profile.
//
// That "nothing to do" only holds when email confirmation is off. With it
// on (see auth/smtp — Confirm email toggle), signUp() succeeds but returns
// no session until the visitor clicks the emailed link, so there's nothing
// for OnboardingFlow's resume effect to pick up yet — show a "check your
// email" screen instead of silently going nowhere. Note: Supabase
// deliberately returns this same no-error, no-session response for an
// email that's already registered too (anti-enumeration), so a mistyped
// existing address looks identical to a fresh signup here — expected.
//
// Visually a "growing sector" screen like TerritoryIntroStep/CatchIntroStep/
// CityStep (cream intro-screen, hex that claims itself) rather than the old
// plain white form — the hex claims once the form looks submittable, same
// gesture as claiming a real sector by catching a fish there.
export function AccountStep({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [resent, setResent] = useState(false)
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm
  const valid = email.trim().length > 0 && password.length >= 6 && passwordConfirm.length >= 6 && !mismatch

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    setPending(false)
    if (error) setError(error.message)
    else if (!data.session) setAwaitingConfirmation(true)
  }

  // Success here sets a real session directly (no redirect/link involved),
  // so OnboardingFlow's resume effect just picks it up like any other
  // sign-in — same as handleSubmit above needing nothing further on success.
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length !== 6) return
    setVerifyError(null)
    setVerifying(true)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' })
    setVerifying(false)
    if (error) setVerifyError('Неверный или устаревший код')
  }

  async function handleResend() {
    setResent(false)
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
    setResent(true)
  }

  if (awaitingConfirmation) {
    return (
      <div className="intro-screen intro-screen--catch">
        <button className="intro-back" onClick={onBack} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
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
          <div className="intro-title">Проверь почту</div>
          <div className="intro-sub">Отправили код на {email} — введи его ниже, чтобы подтвердить аккаунт.</div>
        </div>
        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
          <div className="wizard-field">
            <label htmlFor="account-code">Код подтверждения</label>
            <input
              id="account-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ letterSpacing: 4, textAlign: 'center', fontSize: 20 }}
            />
          </div>
          {verifyError && <div className="auth-error">{verifyError}</div>}
          <button type="button" className="wizard-hint" style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: 'var(--accent)' }} onClick={handleResend}>
            {resent ? 'Код отправлен ещё раз' : 'Отправить код ещё раз'}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="intro-cta"
            type="submit"
            disabled={code.trim().length !== 6 || verifying}
            style={code.trim().length !== 6 || verifying ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
          >
            {verifying ? 'Проверяем…' : 'Подтвердить'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <button className="intro-back" onClick={onBack} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="sector-stage">
        <div className="sector-hex-wrap">
          <div className={`sector-hex${valid ? ' claimed' : ''}`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.5 20c1.6-3.8 4.6-5.7 7.5-5.7s5.9 1.9 7.5 5.7" />
            </svg>
          </div>
          <div className="sector-pin" />
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">Создать аккаунт</div>
        <div className="intro-sub">Аккаунт нужен, чтобы фиксировать уловы и занимать территории.</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <label htmlFor="account-email">Email</label>
          <input id="account-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="wizard-field">
          <label htmlFor="account-password">Пароль</label>
          <input
            id="account-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Минимум 6 символов"
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="account-password-confirm">Повторите пароль</label>
          <input
            id="account-password-confirm"
            type="password"
            required
            minLength={6}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Ещё раз пароль"
          />
          {mismatch && <div style={{ fontSize: 12.5, color: '#D33', marginTop: 4 }}>Пароли не совпадают</div>}
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div style={{ flex: 1 }} />
        <button className="intro-cta" type="submit" disabled={!valid || pending} style={!valid || pending ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          {pending ? 'Подождите…' : 'Далее'}
        </button>
      </form>
    </div>
  )
}
