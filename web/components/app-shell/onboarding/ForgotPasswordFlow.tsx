'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OtpCodeStep } from '@/components/app-shell/onboarding/OtpCodeStep'

// Rendered by FishZoneApp itself (see `recoveryMode`), not nested inside
// OnboardingFlow — verifyOtp's 'recovery' type sets a real session the
// instant the code is confirmed, and OnboardingFlow only mounts while
// `!user`, so nesting this there would have the whole flow vanish out from
// under the visitor right as they finish entering the code, before they'd
// actually set a new password. Living as its own sibling gate keeps this
// screen up until handleSetPassword's onDone fires, regardless of session
// state in between.
type Step = 'email' | 'code' | 'password' | 'done'

export function ForgotPasswordFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm
  const passwordValid = password.length >= 6 && passwordConfirm.length >= 6 && !mismatch

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setPending(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordValid) return
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) setError(error.message)
    else setStep('done')
  }

  if (step === 'code') {
    return (
      <OtpCodeStep
        email={email}
        type="recovery"
        title="Проверь почту"
        subtitle={`Отправили код на ${email} — введи его ниже, чтобы сбросить пароль.`}
        ctaLabel="Далее"
        onBack={() => setStep('email')}
        onVerified={() => setStep('password')}
        onResend={() => createClient().auth.resetPasswordForEmail(email.trim())}
      />
    )
  }

  if (step === 'password' || step === 'done') {
    return (
      <div className="intro-screen intro-screen--catch">
        <button className="intro-back" onClick={onCancel} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="sector-stage">
          <div className="sector-hex-wrap">
            <div className={`sector-hex${step === 'done' ? ' claimed' : ''}`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {step === 'done' ? <path d="M3 8l7 12 11-16" /> : <rect x="5" y="10" width="14" height="10" rx="2" />}
                {step !== 'done' && <path d="M8 10V7a4 4 0 0 1 8 0v3" />}
              </svg>
            </div>
            <div className="sector-pin" />
          </div>
        </div>
        {step === 'done' ? (
          <div className="intro-copy">
            <div className="intro-title">Пароль обновлён</div>
            <div className="intro-sub">Можно возвращаться в RANGE.</div>
            <button className="intro-cta" onClick={onDone}>
              Продолжить
            </button>
          </div>
        ) : (
          <>
            <div className="intro-copy">
              <div className="intro-title">Новый пароль</div>
              <div className="intro-sub">Код подтверждён — придумай новый пароль для входа.</div>
            </div>
            <form onSubmit={handleSetPassword} className="wizard-anim-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
              <div className="wizard-field">
                <label htmlFor="new-password">Новый пароль</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                />
              </div>
              <div className="wizard-field">
                <label htmlFor="new-password-confirm">Повторите пароль</label>
                <input
                  id="new-password-confirm"
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
              <button className="intro-cta" type="submit" disabled={!passwordValid || pending} style={!passwordValid || pending ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
                {pending ? 'Сохраняем…' : 'Сохранить пароль'}
              </button>
            </form>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <button className="intro-back" onClick={onCancel} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="sector-stage">
        <div className="otp-icon-wrap">
          <div className="otp-icon-ring" />
          <div className="otp-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">Забыли пароль?</div>
        <div className="intro-sub">Введи email — пришлём код для сброса пароля.</div>
      </div>
      <form onSubmit={handleSendCode} className="wizard-anim-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <label htmlFor="forgot-email">Email</label>
          <input id="forgot-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div style={{ flex: 1 }} />
        <button className="intro-cta" type="submit" disabled={!email.trim() || pending} style={!email.trim() || pending ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          {pending ? 'Отправляем…' : 'Отправить код'}
        </button>
      </form>
    </div>
  )
}
