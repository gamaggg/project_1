'use client'

import { useState } from 'react'
import { CITIES, launchedCountries, type CityId, type CountryId } from '@/lib/data/city'
import { Flag } from '@/components/app-shell/Flag'
import { tn } from '@/lib/i18n/runtime'
import type { TKey } from '@/lib/i18n/core'

// The countries as cards with their flag; a tap opens that country's cities as a list
// that drops down right under the card (one country open at a time). Registration's
// CityStep and the profile's city modal both use it. `variant` only picks the look:
// 'intro' goes on the cream sign-up screen, 'modal' in the profile's modal.
export function CountryCityPicker({
  selected,
  onSelect,
  variant,
}: {
  selected: CityId | null
  onSelect: (city: CityId) => void
  variant: 'intro' | 'modal'
}) {
  const countries = launchedCountries()
  // Closed to begin with, so the countries are what the player sees first; the country of
  // the chosen city is marked.
  const [open, setOpen] = useState<CountryId | null>(null)
  const selectedCountry = selected ? CITIES[selected].country : null

  return (
    <div className={`country-list country-list--${variant}`}>
      {countries.map((country) => {
        const isOpen = open === country.id
        return (
          <div key={country.id} className={`country-block${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              className={`country-card${selectedCountry === country.id ? ' selected' : ''}`}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : country.id)}
            >
              <Flag country={country.id} height={26} />
              <span className="country-card-name">{tn(`country.${country.id}` as TKey)}</span>
              <span className="country-card-count">{tn('country.cities', { count: country.cities.length })}</span>
              <svg className="country-card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {/* Grid rows 0fr → 1fr: the list opens to its own height without measuring it. */}
            <div className="country-drop" aria-hidden={!isOpen}>
              <div className="country-drop-inner">
                <div className="country-drop-list">
                  {country.cities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      tabIndex={isOpen ? 0 : -1}
                      className={`country-city${selected === c.id ? ' selected' : ''}`}
                      onClick={() => onSelect(c.id)}
                    >
                      <span className="country-city-dot" />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
