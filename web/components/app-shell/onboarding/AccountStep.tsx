'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// First real step of the wizard: creates the Supabase account right away
// (no name/details/color yet — those get filled in via useUpdateProfile in
// later steps). Doing it this early means a refresh mid-wizard resumes from
// real account state instead of losing everything typed so far. On success,
// nothing to do here — the parent OnboardingFlow's resume effect picks up
// the new session + freshly-inserted (onboarding_completed:false) profile.
export function AccountStep({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают')
      return
    }
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    setPending(false)
    if (error) setError(error.message)
  }

  return (
    <div className="onboarding-step">
      <div className="header-row" style={{ padding: 0, marginBottom: 12 }}>
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
      </div>
      <div className="auth-card">
        <div className="page-title" style={{ textAlign: 'center', fontSize: 24 }}>
          Создать аккаунт
        </div>
        <div className="page-sub" style={{ textAlign: 'center' }}>
          Аккаунт нужен, чтобы фиксировать уловы и занимать территории
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="auth-field">
            <label htmlFor="account-email">Email</label>
            <input id="account-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="auth-field">
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
          <div className="auth-field">
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
          <button className="btn-primary" type="submit" disabled={pending || mismatch}>
            {pending ? 'Подождите…' : 'Далее'}
          </button>
        </form>
      </div>
    </div>
  )
}
