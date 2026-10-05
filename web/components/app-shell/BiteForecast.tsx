'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CITIES, type CityId } from '@/lib/data/city'
import { HPA_TO_MMHG, weatherKind, type ForecastDay, type ForecastPoint, type WeatherKind } from '@/lib/forecast/bite'
import { useBiteForecast } from '@/lib/forecast/useBiteForecast'
import { useSectorInsights } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/core'
import type { Territory } from '@/lib/data/types'
import { hapticTap } from '@/lib/telegram/haptics'

export const SCORE_COLOR: Record<ForecastDay['score'], string> = {
  1: '#B4B7BF',
  2: '#E08A3C',
  3: '#D9A419',
  4: '#4FAE5A',
  5: '#17955A',
}

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
const clock = (iso: string) => iso.slice(11, 16)

// Five rising bars, filled up to the score — reads like signal strength,
// which is what a bite forecast is.
export function ScoreBars({ score, size = 14 }: { score: ForecastDay['score']; size?: number }) {
  const color = SCORE_COLOR[score]
  const w = size / 5.6
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="score-bars">
      {[1, 2, 3, 4, 5].map((n) => {
        const h = (size * (n + 1)) / 6
        return <rect key={n} x={(n - 1) * w * 1.15} y={size - h} width={w} height={h} rx={w / 3} fill={n <= score ? color : 'rgba(23,24,27,.12)'} />
      })}
    </svg>
  )
}

export function WeatherIcon({ kind, size = 20 }: { kind: WeatherKind; size?: number }) {
  const sun = <circle cx="12" cy="12" r="4.2" fill="#F5B300" />
  const rays = (
    <g stroke="#F5B300" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </g>
  )
  const cloud = (dx = 0, dy = 0, fill = '#C7CCD4') => (
    <path transform={`translate(${dx} ${dy})`} d="M7.5 19h9.2a3.8 3.8 0 0 0 .3-7.6A5.2 5.2 0 0 0 7 12.3 3.4 3.4 0 0 0 7.5 19z" fill={fill} />
  )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {kind === 'clear' && (
        <>
          {rays}
          {sun}
        </>
      )}
      {kind === 'partly' && (
        <>
          <g transform="translate(-3 -3) scale(.8)">
            {rays}
            {sun}
          </g>
          {cloud(1.5, 1)}
        </>
      )}
      {kind === 'cloudy' && (
        <>
          {cloud(-2, -3, '#DADDE3')}
          {cloud(1, 0, '#B9BFC8')}
        </>
      )}
      {kind === 'fog' && (
        <g stroke="#AEB4BD" strokeWidth="2" strokeLinecap="round">
          <path d="M4 9h16M6 13h12M4 17h16" />
        </g>
      )}
      {(kind === 'rain' || kind === 'storm' || kind === 'snow') && (
        <>
          {cloud(0, -4, kind === 'storm' ? '#8E96A3' : '#AEB6C2')}
          {kind === 'rain' && (
            <g stroke="#3E7BFA" strokeWidth="1.8" strokeLinecap="round">
              <path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" />
            </g>
          )}
          {kind === 'storm' && <path d="M12.8 15.5l-2.6 4h2.4l-1.2 3.5 3.8-5h-2.5l1.3-2.5z" fill="#F5B300" />}
          {kind === 'snow' && (
            <g fill="#8FB4F0">
              <circle cx="8.5" cy="19" r="1.2" />
              <circle cx="12.5" cy="20.5" r="1.2" />
              <circle cx="16.5" cy="19" r="1.2" />
            </g>
          )}
        </>
      )}
    </svg>
  )
}

function useForecastLabels() {
  const { t, lang } = useI18n()
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  const dayMonth = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  return {
    t,
    lang,
    scoreLabel: (s: ForecastDay['score']) => t(`forecast.scores.s${s}` as TKey),
    dayName: (d: ForecastDay, i: number) => {
      if (i === 0) return t('forecast.today')
      if (i === 1) return t('forecast.tomorrow')
      const date = new Date(`${d.date}T12:00:00`)
      const name = weekday.format(date)
      return name.charAt(0).toUpperCase() + name.slice(1)
    },
    dateLabel: (d: ForecastDay) => dayMonth.format(new Date(`${d.date}T12:00:00`)),
    pressure: (hpa: number) => t('forecast.pressureValue', { value: Math.round(lang === 'en' ? hpa : hpa * HPA_TO_MMHG) }),
    trend: (delta: number) => (Math.abs(delta) < 2 ? t('forecast.pressureStable') : delta < 0 ? t('forecast.pressureFalling') : t('forecast.pressureRising')),
    num: (n: number, digits = 1) => new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(n),
  }
}

// --- On the map: a chip at the end of the legend line, today's score. ---
// The fetch waits a moment after launch so it never competes with the map's
// own first requests; the city's numbers are then cached for an hour.
export function ForecastChip({ city }: { city: CityId }) {
  const { t, scoreLabel } = useForecastLabels()
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1500)
    return () => window.clearTimeout(id)
  }, [])
  const info = CITIES[city]
  const { days } = useBiteForecast({
    point: { lat: info.center[0], lng: info.center[1] },
    timezone: info.timezone,
    sea: info.seaPoint ? { lat: info.seaPoint[0], lng: info.seaPoint[1] } : null,
    enabled: ready,
  })
  const today = days?.[0]
  if (!today) return null

  return (
    <>
      <button
        type="button"
        className="forecast-chip tap-scale"
        onClick={() => {
          hapticTap()
          setOpen(true)
        }}
        aria-label={`${t('forecast.title')}: ${scoreLabel(today.score)}`}
      >
        <ScoreBars score={today.score} size={13} />
        {t('forecast.chip')}
        <b style={{ color: SCORE_COLOR[today.score] }}>{today.score}</b>
      </button>
      {open && days && <ForecastSheet title={t('forecast.title')} kicker={info.name} days={days} sector={false} onClose={() => setOpen(false)} />}
    </>
  )
}

// --- On the sector screen: today and the next three days at the sector
// itself, with the hours people catch here weighed in. ---
export function SectorForecastCard({ territory, city }: { territory: Territory; city: CityId }) {
  const { t, scoreLabel, dayName } = useForecastLabels()
  const [open, setOpen] = useState(false)
  const { data: insights } = useSectorInsights(territory.id)
  const point: ForecastPoint = { lat: territory.lat, lng: territory.lng }
  const sea = territory.kind === 'sea' ? point : null
  const { days, isError } = useBiteForecast({
    point,
    timezone: CITIES[city].timezone,
    sea,
    // Only the sector's own hours: the city-wide fallback says little about
    // this spot's best time.
    catchHours: insights?.scope === 'sector' ? insights.hours : null,
  })

  if (isError && !days) return null
  const today = days?.[0]

  return (
    <>
      <button type="button" className="forecast-card tap-scale" onClick={() => days && setOpen(true)} disabled={!days}>
        <div className="insights-head">
          <span className="insights-title">{t('forecast.here')}</span>
          {today && <span className="forecast-card-label" style={{ color: SCORE_COLOR[today.score] }}>{scoreLabel(today.score)}</span>}
        </div>
        {days ? (
          <>
            <div className="forecast-days">
              {days.slice(0, 4).map((d, i) => (
                <div key={d.date} className={`forecast-day${i === 0 ? ' today' : ''}`}>
                  <span className="forecast-day-name">{dayName(d, i)}</span>
                  <WeatherIcon kind={weatherKind(d.code)} size={22} />
                  <span className="forecast-day-score">
                    <ScoreBars score={d.score} size={13} />
                    <b>{d.score}</b>
                  </span>
                </div>
              ))}
            </div>
            {today?.best && <div className="forecast-card-best">{t('forecast.bestToday', { from: hh(today.best.from), to: hh(today.best.to) })}</div>}
          </>
        ) : (
          <div className="forecast-days">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="forecast-day forecast-day-skeleton" />
            ))}
          </div>
        )}
      </button>
      {open && days && <ForecastSheet title={t('forecast.here')} kicker={territory.id} days={days} sector onClose={() => setOpen(false)} />}
    </>
  )
}

function ForecastSheet({ title, kicker, days, sector, onClose }: { title: string; kicker: string; days: ForecastDay[]; sector: boolean; onClose: () => void }) {
  const { t, scoreLabel, dayName, dateLabel, pressure, trend, num } = useForecastLabels()
  const today = days[0]
  const peak = Math.max(...today.hours)
  const inBest = (h: number) => !!today.best && h >= today.best.from && h < today.best.to
  const moonPct = Math.round(today.moon.illumination * 100)

  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet forecast-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">{kicker}</div>
            <div className="move-title">{title}</div>
          </div>
        </div>
        <div className="move-body forecast-sheet-body">
          <div className="forecast-today" style={{ ['--score-color' as string]: SCORE_COLOR[today.score] }}>
            <div className="forecast-today-score">
              <b>{today.score}</b>
              <span>/5</span>
            </div>
            <div className="forecast-today-text">
              <div className="forecast-today-label">{scoreLabel(today.score)}</div>
              {today.best && <div className="forecast-today-best">{t('forecast.bestTime', { from: hh(today.best.from), to: hh(today.best.to) })}</div>}
            </div>
            <div className="forecast-today-weather">
              <WeatherIcon kind={weatherKind(today.code)} size={30} />
              <span>
                {Math.round(today.tempMin)}…{Math.round(today.tempMax)}°
              </span>
            </div>
          </div>

          <div className="forecast-block">
            <span className="atlas-sheet-label">{t('forecast.hours')}</span>
            <div className="insights-hours forecast-hours" aria-hidden>
              {today.hours.map((v, h) => (
                <i key={h} className={inBest(h) ? 'on' : undefined} style={{ height: `${Math.max(8, (v / peak) * 100)}%` }} />
              ))}
            </div>
            <div className="insights-hours-axis" aria-hidden>
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </div>
          </div>

          <div className="forecast-factors">
            <FactorRow label={t('forecast.pressure')} value={`${pressure(today.pressureHpa)} · ${trend(today.pressureTrend)}`} />
            <FactorRow label={t('forecast.wind')} value={t('forecast.windValue', { value: num(today.wind), gusts: Math.round(today.gusts) })} />
            {today.wave != null && <FactorRow label={t('forecast.wave')} value={t('forecast.waveValue', { value: num(today.wave) })} />}
            <FactorRow label={t('forecast.moon')} value={`${t(`forecast.moonPhases.${today.moon.phase}` as TKey)} · ${moonPct}%`} />
            <FactorRow label={t('forecast.sun')} value={t('forecast.sunValue', { sunrise: clock(today.sunrise), sunset: clock(today.sunset) })} />
          </div>

          <div className="forecast-block">
            <span className="atlas-sheet-label">{t('forecast.next')}</span>
            <div className="forecast-next">
              {days.slice(1, 4).map((d, i) => (
                <div key={d.date} className="forecast-next-row">
                  <span className="forecast-next-day">
                    <b>{dayName(d, i + 1)}</b>
                    <span>{dateLabel(d)}</span>
                  </span>
                  <WeatherIcon kind={weatherKind(d.code)} size={24} />
                  <span className="forecast-next-temp">
                    {Math.round(d.tempMin)}…{Math.round(d.tempMax)}°
                  </span>
                  <span className="forecast-next-score">
                    <ScoreBars score={d.score} size={14} />
                    <span style={{ color: SCORE_COLOR[d.score] }}>{scoreLabel(d.score)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="forecast-note">
            {sector ? t('forecast.howSector') : t('forecast.how')}. {t('forecast.source')}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function FactorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="forecast-factor">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}
