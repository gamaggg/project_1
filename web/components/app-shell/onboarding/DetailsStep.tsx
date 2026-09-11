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
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
            </svg>
          </div>
          <div className="sector-pin" />
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">Заполните основные данные</div>
        <div className="intro-sub">Останутся только у вас в профиле — на карте их не видно.</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px' }}>
        <div className="wizard-field">
          <label htmlFor="birth-date">Дата рождения</label>
          <div className="wizard-date-wrap">
            <input id="birth-date" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            {!birthDate && <span className="wizard-date-placeholder">ДД.ММ.ГГГГ</span>}
          </div>
        </div>

        <div className="wizard-field">
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
