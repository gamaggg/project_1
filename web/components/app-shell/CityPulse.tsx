'use client'

import { useEffect, useState } from 'react'
import { useCityPulse } from '@/lib/supabase/queries'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/core'
import type { CityId } from '@/lib/data/city'

const OPEN_KEY = 'range:pulse-open'

function readOpen(fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(OPEN_KEY)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

// «Живой город» — a plaque above the map's sector cards: the city's week in
// three numbers, and (unfolded) its freshest catch photos. Open by default
// for someone who hasn't caught anything yet, folded for everyone else; a
// tap on the line flips it and the choice sticks on this device. No
// animation on the map itself — just this line.
export function CityPulse({ city, newbie, onOpenCatch }: { city: CityId; newbie: boolean; onOpenCatch: (catchId: number) => void }) {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState<boolean | null>(null)
  useEffect(() => {
    // After the map's own first requests, not alongside them.
    const id = window.setTimeout(() => setReady(true), 1200)
    return () => window.clearTimeout(id)
  }, [])
  const { data } = useCityPulse(city, ready)
  if (!data || data.catches === 0) return null
  const isOpen = open ?? readOpen(newbie)

  function toggle() {
    const next = !isOpen
    setOpen(next)
    try {
      window.localStorage.setItem(OPEN_KEY, next ? '1' : '0')
    } catch {}
  }

  return (
    <div className={`pulse${isOpen ? ' open' : ''}`}>
      <button type="button" className="pulse-line" onClick={toggle} aria-expanded={isOpen} aria-label={isOpen ? t('pulse.collapse') : t('pulse.expand')}>
        <span className="pulse-dot" aria-hidden />
        <span className="pulse-title">{t('pulse.week', { city: t(`pulse.cities.${city}` as TKey) })}</span>
        <span className="pulse-stats">
          <b>{t('pulse.catches', { count: data.catches })}</b>
          <span>·</span>
          <b>{t('pulse.anglers', { count: data.anglers })}</b>
          <span>·</span>
          <b>{t('pulse.captures', { count: data.captures })}</b>
        </span>
        <svg className="pulse-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
      {isOpen && data.recent.length > 0 && (
        <div className="pulse-photos">
          {data.recent.map((r) => (
            <button key={r.catchId} type="button" className="pulse-photo tap-scale" onClick={() => onOpenCatch(r.catchId)} aria-label={`${r.species ?? ''} · ${r.name ?? ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- catch thumbnail, same as the feed */}
              <img src={thumbUrl(r.photoUrl, 160)} alt="" loading="lazy" decoding="async" />
              {r.species && <span>{r.species}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
