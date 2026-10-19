'use client'

import { useState } from 'react'
import { storeCity, type CityId } from '@/lib/data/city'
import { CountryCityPicker } from '@/components/app-shell/CountryCityPicker'
import { BackButton } from '@/components/app-shell/BackButton'
import { tn } from '@/lib/i18n/runtime'

// Right after CatchIntroStep ("Поймал — значит занял") — by then the visitor
// already understands the mechanic, so picking where to play it makes sense
// here rather than earlier. storeCity() below is just the same-device local
// cache (see lib/data/city); OnboardingFlow's onDone also persists the real
// choice to the profile row. Changeable any time later from the Профиль tab.
// Visually a third intro-screen variant (GPS-pin drop, see globals.css)
// alongside TerritoryIntroStep/CatchIntroStep — chosen from two proposed designs.
// `preview` (the /onboarding-preview page only): don't keep the choice on this device.
export function CityStep({ onBack, onDone, preview }: { onBack: () => void; onDone: (city: CityId) => void; preview?: boolean }) {
  const [selected, setSelected] = useState<CityId | null>(null)

  function handleSubmit() {
    if (!selected) return
    if (!preview) storeCity(selected)
    onDone(selected)
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <BackButton onClick={onBack} variant="intro" />
      <div className="city-illustration">
        <div className="city-pin-wrap">
          <div className="city-pin-ring" />
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
            <path d="M12 21c-4-4.5-7-8-7-11a7 7 0 0 1 14 0c0 3-3 6.5-7 11z" fill="#FC5200" />
            <circle cx="12" cy="10" r="2.6" fill="#fff" />
          </svg>
        </div>
        <CountryCityPicker selected={selected} onSelect={setSelected} variant="intro" />
      </div>
      <div className="intro-copy">
        <div className="intro-title">{tn('onb.whereCatch')}</div>
        <div className="intro-sub">{tn('onb.citySub')}</div>
        <button className="intro-cta" onClick={handleSubmit} disabled={!selected} style={!selected ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          {tn('common.next')}
        </button>
      </div>
    </div>
  )
}
