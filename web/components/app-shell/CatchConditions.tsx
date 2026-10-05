'use client'

import { WeatherIcon } from '@/components/app-shell/BiteForecast'
import { HPA_TO_MMHG, compassPoint, isNight, weatherKind } from '@/lib/forecast/bite'
import { CITIES, cityForSectorId } from '@/lib/data/city'
import { useCatchConditions } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/core'

// «Погода во время улова» — one short line under the catch's sector and
// time: sky and air, water (by the sea), wind, pressure and where it was
// heading, waves. Nothing at all while it loads or if the
// archive has nothing for that hour.
export function CatchConditions({ catchId, caughtAt, territoryId }: { catchId: number; caughtAt: string; territoryId: string }) {
  const { t, lang } = useI18n()
  const { data: c } = useCatchConditions(catchId)
  if (!c) return null
  const num = (n: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n)
  const [lat, lng] = CITIES[cityForSectorId(territoryId)].center
  const night = isNight(new Date(caughtAt), lat, lng)
  const chips: { key: string; text: string; icon?: React.ReactNode }[] = []
  if (c.airTemp != null) {
    chips.push({ key: 'air', text: `${Math.round(c.airTemp)}°`, icon: c.weatherCode != null ? <WeatherIcon kind={weatherKind(c.weatherCode)} size={16} night={night} /> : undefined })
  }
  if (c.waterTemp != null) chips.push({ key: 'water', text: t('conditions.water', { value: num(c.waterTemp) }) })
  if (c.wind != null) {
    chips.push({
      key: 'wind',
      text:
        c.wind < 0.5 || c.windDir == null
          ? t('conditions.calm')
          : t('conditions.wind', { value: num(c.wind), dir: t(`conditions.dirs.${compassPoint(c.windDir)}` as TKey) }),
    })
  }
  if (c.pressure != null) {
    const value = Math.round(lang === 'en' ? c.pressure : c.pressure * HPA_TO_MMHG)
    const trend = c.pressureTrend == null || Math.abs(c.pressureTrend) < 1 ? '' : c.pressureTrend < 0 ? ' ↓' : ' ↑'
    chips.push({ key: 'pressure', text: t('conditions.pressure', { value }) + trend })
  }
  if (c.wave != null) chips.push({ key: 'wave', text: t('conditions.wave', { value: num(c.wave) }) })

  return (
    <div className="catch-conditions">
      <div className="catch-conditions-title">{t('conditions.title')}</div>
      <div className="catch-conditions-chips">
        {chips.map((ch) => (
          <span key={ch.key} className="catch-conditions-chip">
            {ch.icon}
            {ch.text}
          </span>
        ))}
      </div>
    </div>
  )
}
