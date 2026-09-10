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
    <div className="onboarding-step">
      <div className="header-row" style={{ padding: 0, marginBottom: 12 }}>
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="page-title">Как к вам обращаться?</div>
        <div className="page-sub">Это имя увидят другие рыбаки на карте.</div>
        <div className="auth-field" style={{ marginTop: 28 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Введите имя" autoFocus />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: -8 }}>От 2 символов · без пробелов и спецсимволов</div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" type="submit" disabled={!valid || updateProfile.isPending}>
          {updateProfile.isPending ? 'Сохраняем…' : 'Далее'}
        </button>
      </form>
    </div>
  )
}
