'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const supabase = createClient()

    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { display_name: name || undefined } } })

    setPending(false)
    if (error) {
      setError(mode === 'signin' ? 'Неверный email или пароль' : error.message)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brandmark" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 17c3-5 6-7.5 9-7.5s6 2.5 9 7.5" stroke="#FC5200" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M3 12.5c3-5 6-7.5 9-7.5s6 2.5 9 7.5" stroke="#FC5200" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
          </svg>
          <span style={{ fontSize: 16 }}>FishZone</span>
        </div>
        <div className="page-title" style={{ textAlign: 'center', fontSize: 24 }}>
          {mode === 'signin' ? 'Вход' : 'Регистрация'}
        </div>
        <div className="page-sub" style={{ textAlign: 'center' }}>
          {mode === 'signin' ? 'Заходи, чтобы занимать территории' : 'Аккаунт нужен, чтобы фиксировать уловы'}
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          {mode === 'signup' && (
            <div className="auth-field">
              <label htmlFor="name">Имя</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как тебя называть" />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Пароль</label>
            <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? 'Подождите…' : mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'signin' ? (
            <>
              Нет аккаунта? <button onClick={() => setMode('signup')}>Зарегистрироваться</button>
            </>
          ) : (
            <>
              Уже есть аккаунт? <button onClick={() => setMode('signin')}>Войти</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
