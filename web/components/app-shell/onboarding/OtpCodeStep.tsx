'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EmailOtpType } from '@supabase/supabase-js'

const RESEND_COOLDOWN_S = 30

// Shared by AccountStep's signup confirmation and ForgotPasswordFlow's
// recovery code — same envelope-drop animation, same verify/resend/cooldown
// logic, just a different `type` and a caller-supplied resend action (signup
// resends via supabase.auth.resend(), recovery via resetPasswordForEmail()
// again — two different Supabase calls, so that part comes from the caller
// rather than being hardcoded here).
export function OtpCodeStep({
  email,
  type,
  title,
  subtitle,
  ctaLabel,
  onBack,
  onVerified,
  onResend,
}: {
  email: string
  type: EmailOtpType
  title: string
  subtitle: string
  ctaLabel: string
  onBack: () => void
  onVerified: () => void
  onResend: () => Promise<{ error: { message: string } | null }>
}) {
  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length !== 6) return
    setVerifyError(null)
    setVerifying(true)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type })
    setVerifying(false)
    if (error) setVerifyError('Неверный или устаревший код')
    else onVerified()
  }

  async function handleResend() {
    if (cooldown > 0) return
    setResendError(null)
    setResent(false)
    const { error } = await onResend()
    if (error) setResendError('Не получилось отправить код, попробуй чуть позже')
    else {
      setResent(true)
      setCooldown(RESEND_COOLDOWN_S)
    }
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <button className="intro-back" onClick={onBack} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
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
        <div className="intro-title">{title}</div>
        <div className="intro-sub">{subtitle}</div>
      </div>
      <form onSubmit={handleVerify} className="otp-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <label htmlFor="otp-code">Код подтверждения</label>
          <input
            id="otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            style={{ letterSpacing: 4, textAlign: 'center', fontSize: 20 }}
          />
        </div>
        <div>
          {verifyError && <div className="auth-error">{verifyError}</div>}
          {resendError && <div className="auth-error">{resendError}</div>}
          <button type="button" className="otp-resend" disabled={cooldown > 0} onClick={handleResend}>
            {cooldown > 0 ? `Отправить ещё раз через ${cooldown}с` : resent ? 'Код отправлен ещё раз' : 'Отправить код ещё раз'}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="intro-cta"
          type="submit"
          disabled={code.trim().length !== 6 || verifying}
          style={code.trim().length !== 6 || verifying ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          {verifying ? 'Проверяем…' : ctaLabel}
        </button>
      </form>
    </div>
  )
}
