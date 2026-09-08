'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'

// Native <input type="date"> instead of a custom ДД.ММ.ГГГГ text mask — the
// browser's own picker is free, accessible, and hard to get wrong; a masked
// text input is extra work the reference screenshot doesn't strictly require.
export function DetailsStep({ onDone }: { onDone: () => void }) {
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [confirmed14, setConfirmed14] = useState(false)
  const updateProfile = useUpdateProfile()
  const valid = !!birthDate && confirmed14

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    await updateProfile.mutateAsync({
      birthDate,
      ...(gender ? { gender } : {}),
      heightCm: height ? Number(height) : null,
      weightKg: weight ? Number(weight) : null,
    })
    onDone()
  }

  return (
    <div className="onboarding-step">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="page-title">Заполните основные данные</div>
        <div style={{ marginTop: 12 }}>
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

          <div className="auth-field unit-field">
            <label htmlFor="height">Рост (Необязательно)</label>
            <input id="height" type="number" inputMode="numeric" min={50} max={260} value={height} onChange={(e) => setHeight(e.target.value)} />
            <span className="unit-suffix">см</span>
          </div>

          <div className="auth-field unit-field">
            <label htmlFor="weight">Вес (Необязательно)</label>
            <input id="weight" type="number" inputMode="numeric" min={20} max={400} value={weight} onChange={(e) => setWeight(e.target.value)} />
            <span className="unit-suffix">кг</span>
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
