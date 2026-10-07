'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CITIES, type CityId } from '@/lib/data/city'
import { HPA_TO_MMHG, compassPoint, dayTones, nowInZone, weatherKind, type ForecastDay, type ForecastPoint, type Tone, type WeatherKind } from '@/lib/forecast/bite'
import { useBiteForecast } from '@/lib/forecast/useBiteForecast'
import { useSectorInsights } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/core'
import type { Territory } from '@/lib/data/types'
import { hapticSelect, hapticTap } from '@/lib/telegram/haptics'
import { useNow } from '@/lib/useNow'

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

export function WeatherIcon({ kind, size = 20, night = false }: { kind: WeatherKind; size?: number; night?: boolean }) {
  // A clear or partly cloudy night shows the moon, not the sun.
  if (night && (kind === 'clear' || kind === 'partly')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.4A7 7 0 0 1 15.5 3.5z" fill="#8E9BB5" transform={kind === 'partly' ? 'translate(-3 -3) scale(.85)' : undefined} />
        {kind === 'partly' && <path d="M8.5 20h9.2a3.8 3.8 0 0 0 .3-7.6A5.2 5.2 0 0 0 8 13.3 3.4 3.4 0 0 0 8.5 20z" fill="#C7CCD4" />}
      </svg>
    )
  }
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
        data-tour="forecast" className="forecast-chip tap-scale"
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
      {open && days && <ForecastSheet title={t('forecast.title')} kicker={info.name} days={days} sector={false} timezone={info.timezone} onClose={() => setOpen(false)} />}
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
    // The sector's own catch hours (insights never mixes in other sectors).
    catchHours: insights?.hours ?? null,
  })

  if (isError && !days) return null
  const today = days?.[0]

  return (
    <>
      <button type="button" data-tour="sector-forecast" className="forecast-card tap-scale" onClick={() => days && setOpen(true)} disabled={!days}>
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
      {open && days && <ForecastSheet title={t('forecast.here')} kicker={territory.id} days={days} sector timezone={CITIES[city].timezone} onClose={() => setOpen(false)} />}
    </>
  )
}

const hourOf = (iso: string) => Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60

// The sheet: pick a day on top (its 1–5 is for the whole day), then drag a
// finger along the hours to read the bite and the weather at any hour; below,
// which of the day's inputs help the score and which hold it back.
function ForecastSheet({
  title,
  kicker,
  days,
  sector,
  timezone,
  onClose,
}: {
  title: string
  kicker: string
  days: ForecastDay[]
  sector: boolean
  timezone: string
  onClose: () => void
}) {
  const { t, lang, scoreLabel, dayName, dateLabel, pressure, trend, num } = useForecastLabels()
  const nowLocal = nowInZone(timezone, useNow(60_000))
  const nowHour = Number(nowLocal.slice(11, 13))
  const isToday = (d: ForecastDay) => nowLocal.startsWith(d.date)
  // Today opens on the current hour, other days on their best window.
  const startHour = (d: ForecastDay) => (isToday(d) ? nowHour : (d.best?.from ?? 12))
  const tabs = days.slice(0, 4)
  const [dayIdx, setDayIdx] = useState(0)
  const [hour, setHour] = useState(() => startHour(days[0]))
  const [dragged, setDragged] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  // A finger on the hour scale only scrubs: touch-action:none covers most
  // browsers, and this non-passive listener stops iOS WebViews from still
  // scrolling the sheet under a diagonal drag (React's own touch handlers
  // are passive, so they can't).
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const stop = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchmove', stop, { passive: false })
    return () => el.removeEventListener('touchmove', stop)
  }, [])

  const day = tabs[dayIdx] ?? days[0]
  const today = isToday(day)
  const peak = Math.max(...day.hours)
  const at = day.hourly[hour]
  const tones = dayTones(day)
  const moonPct = Math.round(day.moon.illumination * 100)
  const sunrise = hourOf(day.sunrise)
  const sunset = hourOf(day.sunset)
  const night = hour + 0.5 < sunrise || hour + 0.5 > sunset

  const pickDay = (i: number) => {
    if (i === dayIdx) return
    hapticTap()
    setDayIdx(i)
    setHour(startHour(tabs[i]))
  }
  const pickHour = (h: number) => {
    const next = Math.min(23, Math.max(0, h))
    if (next === hour) return
    hapticSelect()
    setHour(next)
  }
  const pickAt = (clientX: number) => {
    const box = chartRef.current?.getBoundingClientRect()
    if (box) pickHour(Math.floor(((clientX - box.left) / box.width) * 24))
  }

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
          <div className="forecast-tabs" role="tablist">
            {tabs.map((d, i) => (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={i === dayIdx}
                className={`forecast-day forecast-tab${i === dayIdx ? ' on' : ''}`}
                style={{ ['--score-color' as string]: SCORE_COLOR[d.score] }}
                onClick={() => pickDay(i)}
              >
                <span className="forecast-day-name">{dayName(d, i)}</span>
                <span className="forecast-tab-date">{dateLabel(d)}</span>
                <span className="forecast-day-score">
                  <ScoreBars score={d.score} size={13} />
                  <b>{d.score}</b>
                </span>
              </button>
            ))}
          </div>

          <div className="forecast-today" style={{ ['--score-color' as string]: SCORE_COLOR[day.score] }}>
            <div className="forecast-today-score">
              <b>{day.score}</b>
              <span>/5</span>
            </div>
            <div className="forecast-today-text">
              <div className="forecast-today-label">{scoreLabel(day.score)}</div>
              <div className="forecast-today-best">
                {t('forecast.dayScore')}
                {day.best && (
                  <>
                    <br />
                    {t('forecast.bestShort', { from: hh(day.best.from), to: hh(day.best.to) })}
                  </>
                )}
              </div>
            </div>
            <div className="forecast-today-weather">
              <WeatherIcon kind={weatherKind(day.code)} size={30} />
              <span>
                {Math.round(day.tempMin)}…{Math.round(day.tempMax)}°
              </span>
              {day.waterTemp != null && <small>{t('forecast.waterShort', { value: Math.round(day.waterTemp) })}</small>}
            </div>
          </div>

          <div className="forecast-block">
            <div className="forecast-block-head">
              <span className="forecast-label">{t('forecast.hours')}</span>
              {!dragged && <span className="forecast-hint">{t('forecast.scrub')}</span>}
            </div>
            <div
              ref={chartRef}
              className="forecast-chart"
              role="slider"
              tabIndex={0}
              aria-label={t('forecast.hours')}
              aria-valuemin={0}
              aria-valuemax={23}
              aria-valuenow={hour}
              aria-valuetext={t('forecast.hourAria', { time: hh(hour), label: scoreLabel(at.score) })}
              onPointerDown={(e) => {
                dragging.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                setDragged(true)
                pickAt(e.clientX)
              }}
              onPointerMove={(e) => {
                if (dragging.current) pickAt(e.clientX)
              }}
              onPointerUp={() => {
                dragging.current = false
              }}
              onPointerCancel={() => {
                dragging.current = false
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  pickHour(hour + (e.key === 'ArrowRight' ? 1 : -1))
                }
              }}
            >
              {day.best && (
                <div className="forecast-chart-best" style={{ left: `${(day.best.from / 24) * 100}%`, width: `${((day.best.to - day.best.from) / 24) * 100}%` }}>
                  <span>{t('forecast.bestMark')}</span>
                </div>
              )}
              <div className="forecast-chart-bars">
                {day.hours.map((v, h) => (
                  <i
                    key={h}
                    className={`${h === hour ? 'sel' : ''}${today && h < nowHour ? ' past' : ''}`}
                    style={{ height: `${Math.max(10, (v / peak) * 100)}%`, ['--c' as string]: SCORE_COLOR[day.hourly[h].score] }}
                  />
                ))}
              </div>
              <div className="forecast-chart-cursor" style={{ left: `${((hour + 0.5) / 24) * 100}%` }} />
            </div>
            <div className="insights-hours-axis" aria-hidden>
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </div>

            <div className="forecast-hour" style={{ ['--score-color' as string]: SCORE_COLOR[at.score] }} aria-live="polite">
              <div className="forecast-hour-head">
                <b className="forecast-hour-time">{today && hour === nowHour ? `${t('forecast.now')} · ${hh(hour)}` : hh(hour)}</b>
                <span className="forecast-hour-score">
                  <ScoreBars score={at.score} size={14} />
                  {scoreLabel(at.score)}
                </span>
              </div>
              <div className="forecast-hour-stats">
                <div className="forecast-stat">
                  <b>
                    <WeatherIcon kind={weatherKind(at.code)} size={20} night={night} />
                    {Math.round(at.temp)}°
                  </b>
                  <span>{t('forecast.statAir')}</span>
                </div>
                <div className="forecast-stat">
                  <b>
                    <svg className="wind-arrow" width="13" height="13" viewBox="0 0 12 12" aria-hidden style={{ transform: `rotate(${at.windDir + 180}deg)` }}>
                      <path d="M6 1l4 9-4-2.2L2 10z" fill="currentColor" />
                    </svg>
                    {t('forecast.msValue', { value: num(at.wind) })}
                  </b>
                  <span>{t('forecast.statWind', { dir: t(`forecast.windShort.${compassPoint(at.windDir)}` as TKey) })}</span>
                </div>
                <div className="forecast-stat">
                  <b>{Math.round(lang === 'en' ? at.pressureHpa : at.pressureHpa * HPA_TO_MMHG)}</b>
                  <span>{t('forecast.statPressure')}</span>
                </div>
                <div className="forecast-stat">
                  {at.wave != null ? (
                    <>
                      <b>{t('forecast.waveValue', { value: num(at.wave, at.wave < 0.1 ? 2 : 1) })}</b>
                      <span>{t('forecast.statWave')}</span>
                    </>
                  ) : (
                    <>
                      <b>{t('forecast.mmValue', { value: num(at.precip) })}</b>
                      <span>{t('forecast.statRain')}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="forecast-why">
            <span className="forecast-label">{t('forecast.factors')}</span>
            <div className="forecast-legend">
              <span>
                <i className="forecast-tone good" />
                {t('forecast.toneGood')}
              </span>
              <span>
                <i className="forecast-tone ok" />
                {t('forecast.toneOk')}
              </span>
              <span>
                <i className="forecast-tone bad" />
                {t('forecast.toneBad')}
              </span>
            </div>
            <div className="forecast-factors">
              <FactorRow tone={tones.pressure} label={t('forecast.pressure')} value={`${pressure(day.pressureHpa)} · ${trend(day.pressureTrend)}`} />
              <FactorRow
                tone={tones.wind}
                label={t('forecast.wind')}
                value={t('forecast.windValue', { value: num(day.wind), dir: t(`forecast.windDirs.${compassPoint(day.windDir)}` as TKey), gusts: Math.round(day.gusts) })}
              />
              {day.wave != null && tones.wave && <FactorRow tone={tones.wave} label={t('forecast.wave')} value={t('forecast.waveValue', { value: num(day.wave) })} />}
              <FactorRow
                tone={tones.rain}
                label={t('forecast.rain')}
                value={day.storm ? t('forecast.rainStorm') : day.precip < 0.2 ? t('forecast.rainNone') : t('forecast.rainValue', { value: num(day.precip) })}
              />
              <FactorRow tone={tones.moon} label={t('forecast.moon')} value={`${t(`forecast.moonPhases.${day.moon.phase}` as TKey)} · ${moonPct}%`} />
              <FactorRow tone="ok" label={t('forecast.sun')} value={t('forecast.sunValue', { sunrise: clock(day.sunrise), sunset: clock(day.sunset) })} />
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

function FactorRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="forecast-factor">
      <span>
        <i className={`forecast-tone ${tone}`} />
        {label}
      </span>
      <b>{value}</b>
    </div>
  )
}
