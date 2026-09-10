'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'

// Native <input type="date"> instead of a custom ДД.ММ.ГГГГ text mask — the
// browser's own picker is free, accessible, and hard to get wrong; a masked
// text input is extra work the reference screenshot doesn't strictly require.
export function DetailsStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [confirmed14, setConfirmed14] = useState(false)
  const updateProfile = useUpdateProfile()
  const valid = !!birthDate && confirmed14

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    await updateProfile.mutateAsync({
      birthDate,
      ...(gender ? { gender } : {}),
    })
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
        <div className="page-title">Заполните основные данные</div>
        <div style={{ marginTop: 28 }}>
          <div className="auth-field">
            <label htmlFor="birth-date">Дата рождения</label>
            <input id="birth-date" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>

          <div className="auth-field">
            <label>Пол (Необязательно)</label>
            <div className="gender-pill-row">
              <button type="button" className={`gender-pill${gender === 'female' ? ' active' : ''}`} onClick={() => setGender(gender === 'female' ? null : 'female')}>
                Женский
              </button>
              <button type="button" className={`gender-pill${gender === 'male' ? ' active' : ''}`} onClick={() => setGender(gender === 'male' ? null : 'male')}>
                Мужской
              </button>
            </div>
          </div>

          <div className="onboarding-checkbox-row">
            <input id="confirm14" type="checkbox" checked={confirmed14} onChange={(e) => setConfirmed14(e.target.checked)} />
            <label htmlFor="confirm14">Мне уже исполнилось 14 лет</label>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" type="submit" disabled={!valid || updateProfile.isPending}>
          {updateProfile.isPending ? 'Сохраняем…' : 'Далее'}
        </button>
      </form>
    </div>
  )
}
