'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'

const NAME_RE = /^[\p{L}\p{N}]{2,}$/u

export function NameStep({ initialName, onBack, onDone }: { initialName: string; onBack: () => void; onDone: () => void }) {
  const [name, setName] = useState(initialName)
  const updateProfile = useUpdateProfile()
  const valid = NAME_RE.test(name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    await updateProfile.mutateAsync({ displayName: name })
    onDone()
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
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </div>
          <div className="sector-pin" />
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">Как к вам обращаться?</div>
        <div className="intro-sub">Это имя увидят другие рыбаки на карте.</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Введите имя" autoFocus />
        </div>
        <div className="wizard-hint">От 2 символов · без пробелов и спецсимволов</div>
        <div style={{ flex: 1 }} />
        <button
          className="intro-cta"
          type="submit"
          disabled={!valid || updateProfile.isPending}
          style={!valid || updateProfile.isPending ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          {updateProfile.isPending ? 'Сохраняем…' : 'Далее'}
        </button>
      </form>
    </div>
  )
}
