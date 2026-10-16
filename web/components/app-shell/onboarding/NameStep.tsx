'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'
import { BackButton } from '@/components/app-shell/BackButton'
import { TermsOfUseModal } from '@/components/app-shell/TermsOfUseModal'
import { tn } from '@/lib/i18n/runtime'

const NAME_RE = /^[\p{L}\p{N}]{2,}$/u

export function NameStep({
  initialName,
  onBack,
  onDone,
  onSwitchToEmailSignIn,
  preview,
}: {
  initialName: string
  onBack: () => void
  onDone: () => void
  onSwitchToEmailSignIn?: () => void
  // Only the /onboarding-preview page: go on without writing the name.
  preview?: boolean
}) {
  // The name the database made from the e-mail («ivan.petrov») may hold characters the
  // rule below refuses — start from it without them, so «Next» isn't dead on arrival.
  const [name, setName] = useState(initialName.replace(/[^\p{L}\p{N}]/gu, ''))
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const updateProfile = useUpdateProfile()
  const valid = NAME_RE.test(name) && acceptedTerms

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    if (!preview) await updateProfile.mutateAsync({ displayName: name })
    onDone()
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <BackButton onClick={onBack} variant="intro" />
      <div className="sector-stage">
        <div className="sector-hex-wrap">
          <div className={`sector-hex${valid ? ' claimed' : ''}`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </div>
          <div className="sector-pin" />
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">{tn('onb.nameTitle')}</div>
        <div className="intro-sub">{tn('onb.nameSub')}</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tn('onb.namePlaceholder')} maxLength={40} />
        </div>
        <div className={`wizard-hint${name && !NAME_RE.test(name) ? ' bad' : ''}`}>{tn('onb.nameHint')}</div>
        <div className="onboarding-checkbox-row">
          <input id="accept-terms" type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
          <label htmlFor="accept-terms">
            {tn('onb.accept')}{' '}
            <span
              className="terms-link"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setTermsOpen(true)
              }}
            >
              {tn('onb.terms')}
            </span>
          </label>
        </div>
        <div style={{ flex: 1 }} />
        {onSwitchToEmailSignIn && (
          <button type="button" className="otp-resend" style={{ marginBottom: 14 }} onClick={onSwitchToEmailSignIn}>
            {tn('onb.haveAccount')}
          </button>
        )}
        <button
          className="intro-cta"
          type="submit"
          disabled={!valid || updateProfile.isPending}
          style={!valid || updateProfile.isPending ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          {updateProfile.isPending ? tn('common.saving') : tn('common.next')}
        </button>
      </form>
      {termsOpen && <TermsOfUseModal onClose={() => setTermsOpen(false)} />}
    </div>
  )
}
