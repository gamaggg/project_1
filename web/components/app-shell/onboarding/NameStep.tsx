'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'

const NAME_RE = /^[\p{L}\p{N}]{2,}$/u

// No "back" here — the account already exists by this point (created in
// AccountStep), so undoing to re-edit email/password isn't meaningful.
export function NameStep({ initialName, onDone }: { initialName: string; onDone: () => void }) {
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="page-title">Как к вам обращаться?</div>
        <div className="page-sub">Скоро на карте появится земля с этим именем.</div>
        <div className="auth-field" style={{ marginTop: 12 }}>
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
