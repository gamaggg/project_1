'use client'

import { useState, type CSSProperties } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'
import { TERRITORY_COLORS } from '@/lib/data/territoryColors'

// Last step — this mutation also flips onboarding_completed:true, which is
// what makes FishZoneApp's gate unmount the whole wizard and show the real
// map (see the gate condition there: `!user || !myProfile.onboardingCompleted`).
export function ColorStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const updateProfile = useUpdateProfile()

  async function handleSubmit() {
    if (!selected) return
    await updateProfile.mutateAsync({ territoryColor: selected, onboardingCompleted: true })
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
      <div className="page-title">Выберите цвет вашей территории</div>
      <div className="color-grid">
        {TERRITORY_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`color-swatch${selected === c.hex ? ' selected' : ''}`}
            style={{ '--swatch-color': c.hex } as CSSProperties}
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
