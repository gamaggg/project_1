'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'
import { TERRITORY_COLORS } from '@/lib/data/territoryColors'

// Last step — this mutation also flips onboarding_completed:true, which is
// what makes FishZoneApp's gate unmount the whole wizard and show the real
// map (see the gate condition there: `!user || !myProfile.onboardingCompleted`).
export function ColorStep({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const updateProfile = useUpdateProfile()

  async function handleSubmit() {
    if (!selected) return
    await updateProfile.mutateAsync({ territoryColor: selected, onboardingCompleted: true })
    onDone()
  }

  return (
    <div className="onboarding-step">
      <div className="page-title">Выберите цвет вашей территории</div>
      <div className="color-grid">
        {TERRITORY_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`color-swatch${selected === c.hex ? ' selected' : ''}`}
            style={{ background: c.hex }}
            aria-label={c.label}
            onClick={() => setSelected(c.hex)}
          />
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn-primary" onClick={handleSubmit} disabled={!selected || updateProfile.isPending}>
        {updateProfile.isPending ? 'Сохраняем…' : 'Готово'}
      </button>
    </div>
  )
}
