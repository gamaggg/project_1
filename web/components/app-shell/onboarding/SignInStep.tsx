'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Mirrors the old AuthForm's signin mode exactly (same copy, same error
// text) — just given its own screen now that AuthForm itself is retired.
// On success there's nothing to do here: onAuthStateChange (AuthProvider)
// updates `user`, and FishZoneApp's gate reacts (existing accounts have
// onboarding_completed=true by default, so it drops straight to the map).
export function SignInStep({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) setError(error.code === 'email_not_confirmed' ? 'Подтверди почту по ссылке из письма, которое мы прислали при регистрации' : 'Неверный email или пароль')
  }

  return (
    <div className="onboarding-step">
      <div className="header-row" style={{ padding: 0, marginBottom: 12 }}>
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
      </div>
      <div className="auth-card">
        <div className="page-title" style={{ textAlign: 'center', fontSize: 24 }}>
          Вход
        </div>
        <div className="page-sub" style={{ textAlign: 'center' }}>
          Заходи, чтобы занимать территории
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="auth-field">
            <label htmlFor="signin-email">Email</label>
            <input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="auth-field">
            <label htmlFor="signin-password">Пароль</label>
            <input
              id="signin-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? 'Подождите…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
