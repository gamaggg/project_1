'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OtpCodeStep } from '@/components/app-shell/onboarding/OtpCodeStep'
import { BackButton } from '@/components/app-shell/BackButton'

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
    if (error) setError(error.message === 'User already registered' ? 'Эта почта уже занята другим аккаунтом' : error.message)
    else setStep('code')
  }

  if (step === 'code') {
    return (
      <OtpCodeStep
        email={email.trim()}
        type="email_change"
        title="Проверь новую почту"
        subtitle={`Отправили код на ${email.trim()} — введи его ниже, чтобы привязать почту к аккаунту.`}
        ctaLabel="Привязать"
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
          <div className="intro-title">Почта привязана</div>
          <div className="intro-sub">Теперь можно входить и через Telegram, и по почте с этим паролем.</div>
          <button className="intro-cta" onClick={onDone}>
            Готово
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
        <div className="intro-title">Привязать почту</div>
        <div className="intro-sub">Добавь почту и пароль — сможешь заходить в RANGE не только через Telegram, но и с сайта.</div>
      </div>
      <form onSubmit={handleSubmit} className="wizard-anim-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <label htmlFor="link-email">Email</label>
          <input id="link-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="wizard-field">
          <label htmlFor="link-password">Пароль</label>
          <input id="link-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
        </div>
        <div className="wizard-field">
          <label htmlFor="link-password-confirm">Повторите пароль</label>
          <input
            id="link-password-confirm"
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
          {pending ? 'Отправляем…' : 'Отправить код'}
        </button>
      </form>
    </div>
  )
}
