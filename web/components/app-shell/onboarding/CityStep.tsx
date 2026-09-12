'use client'

import { useState } from 'react'
import { CITY_LIST, storeCity, type CityId } from '@/lib/data/city'

// Right after CatchIntroStep ("Поймал — значит занял") — by then the visitor
// already understands the mechanic, so picking where to play it makes sense
// here rather than earlier. storeCity() below is just the same-device local
// cache (see lib/data/city); OnboardingFlow's onDone also persists the real
// choice to the profile row. Changeable any time later from the Профиль tab.
// Visually a third intro-screen variant (GPS-pin drop, see globals.css)
// alongside TerritoryIntroStep/CatchIntroStep — chosen from two proposed designs.
export function CityStep({ onBack, onDone }: { onBack: () => void; onDone: (city: CityId) => void }) {
  const [selected, setSelected] = useState<CityId | null>(null)

  function handleSubmit() {
    if (!selected) return
    storeCity(selected)
    onDone(selected)
  }

  return (
    <div className="intro-screen intro-screen--catch">
      <button className="intro-back" onClick={onBack} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="city-illustration">
        <div className="city-pin-wrap">
          <div className="city-pin-ring" />
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
            <path d="M12 21c-4-4.5-7-8-7-11a7 7 0 0 1 14 0c0 3-3 6.5-7 11z" fill="#FC5200" />
            <circle cx="12" cy="10" r="2.6" fill="#fff" />
          </svg>
        </div>
        <div className="city-chips">
          {CITY_LIST.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`city-chip${selected === c.id ? ' selected' : ''}`}
              onClick={() => setSelected(c.id)}
            >
              <span className="city-chip-dot" />
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">Где ты будешь ловить?</div>
        <div className="intro-sub">Можно сменить позже в профиле — сектора никуда не денутся.</div>
        <button className="intro-cta" onClick={handleSubmit} disabled={!selected} style={!selected ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          Далее
        </button>
      </div>
    </div>
  )
}
