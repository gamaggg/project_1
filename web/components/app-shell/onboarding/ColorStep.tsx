'use client'

import { useState, type CSSProperties } from 'react'
import { useUpdateProfile } from '@/lib/supabase/queries'
import { TERRITORY_COLORS, withAlpha } from '@/lib/data/territoryColors'
import { BackButton } from '@/components/app-shell/BackButton'
import { tn } from '@/lib/i18n/runtime'

// Not the last step (city/territory-intro/catch-intro still follow — see
// OnboardingFlow) — onboarding_completed only flips true at the very end,
// in CatchIntroStep's onDone.
//
// The hex claims in the picked color itself (not the generic brand accent
// every other step uses) via --sector-color/--sector-glow — a real preview
// of your own territory color, not just "done".
// `preview` (the /onboarding-preview page only): go on without writing the colour.
export function ColorStep({ onBack, onDone, preview }: { onBack: () => void; onDone: () => void; preview?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  const updateProfile = useUpdateProfile()

  async function handleSubmit() {
    if (!selected) return
    if (!preview) await updateProfile.mutateAsync({ territoryColor: selected })
    onDone()
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <BackButton onClick={onBack} variant="intro" />
      <div className="sector-stage">
        <div className="sector-hex-wrap">
          <div
            className={`sector-hex${selected ? ' claimed' : ''}`}
            style={selected ? ({ '--sector-color': selected, '--sector-glow': withAlpha(selected, 0.18) } as CSSProperties) : undefined}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a9 9 0 1 0 9 9c0-1-.8-2-2-2h-2a2 2 0 0 1-2-2 2 2 0 0 1 2-2h1a2 2 0 0 0 0-4 9 9 0 0 0-6-1z" />
              <circle cx="7.5" cy="10.5" r="1" />
              <circle cx="8.5" cy="15" r="1" />
              <circle cx="13" cy="17" r="1" />
            </svg>
          </div>
          <div className="sector-pin" style={selected ? ({ '--sector-color': selected } as CSSProperties) : undefined} />
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">{tn('onb.colorTitle')}</div>
        <div className="intro-sub">{tn('onb.colorSub')}</div>
      </div>
      <div className="color-grid" style={{ padding: '0 24px' }}>
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
      <div style={{ padding: '0 24px' }}>
        <button
          className="intro-cta"
          onClick={handleSubmit}
          disabled={!selected || updateProfile.isPending}
          style={!selected || updateProfile.isPending ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          {updateProfile.isPending ? tn('common.saving') : tn('common.next')}
        </button>
      </div>
    </div>
  )
}
