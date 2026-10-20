'use client'

import { useMemo, useRef, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { CITIES, type CityId } from '@/lib/data/city'
import { useAppStatsRange, type AppStats, type AppStatsPoint } from '@/lib/supabase/queries'

// Super admin's «Статистика»: our own app_events plus what the database already knows
// (sign-ups, catches), for any period — a preset or from/to to the minute — with
// an interactive chart (touch or drag over it to read a bucket). Russian only, like
// the other admin screens. Time is Tbilisi's (UTC+4, no DST), the same the server counts in.

const TZ = 'Asia/Tbilisi'
const TZ_OFFSET_MS = 4 * 3600 * 1000

type Preset = 'today' | 'yesterday' | '7' | '30' | '90' | 'custom'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'yesterday', label: 'Вчера' },
  { id: '7', label: '7 дней' },
  { id: '30', label: '30 дней' },
  { id: '90', label: '90 дней' },
  { id: 'custom', label: 'Свой период' },
]

const SCREEN_NAMES: Record<string, string> = {
  'screen-map': 'Карта',
  'screen-territory': 'Сектор',
  'screen-territories': 'Территории',
  'screen-catches': 'Список уловов',
  'screen-catch-photo': 'Улов',
  'screen-camera': 'Камера',
  'screen-confirm': 'Форма улова',
  'screen-activity': 'Активность',
  'screen-profile': 'Профиль',
  'screen-user-profile': 'Чужой профиль',
  'screen-achievements': 'Достижения',
  'screen-achievement-detail': 'Достижение',
  'screen-last-week': 'Итоги недели',
  'screen-shop': 'Магазин',
  'screen-slots': 'Слоты',
  'screen-challenges': 'Челленджи',
  'screen-clans': 'Кланы',
  'screen-clan': 'Клан',
  'screen-clan-editor': 'Создание клана',
  'screen-clan-race': 'Битва кланов',
  'screen-clan-chat': 'Чат клана',
  'screen-users': 'Игроки',
  'screen-geo': 'Где это?',
  'screen-admin-reports': 'Жалобы',
  'screen-admin-access': 'Доступы',
  'screen-admin-log': 'Последние действия',
  'screen-admin-stats': 'Статистика',
}

const ONBOARDING_STEPS: { id: string; name: string }[] = [
  { id: 'welcome', name: 'Приветствие' },
  { id: 'signin', name: 'Вход' },
  { id: 'account', name: 'Регистрация' },
  { id: 'name', name: 'Имя' },
  { id: 'color', name: 'Цвет' },
  { id: 'city', name: 'Город' },
  { id: 'territory-intro', name: 'Про сектора' },
  { id: 'catch-intro', name: 'Про улов' },
]

type MetricId = 'newUsers' | 'active' | 'catches'
const METRICS: { id: MetricId; label: string; short: string; color: string; pick: (p: AppStatsPoint) => number }[] = [
  { id: 'newUsers', label: 'Новые игроки', short: 'Новых', color: 'var(--accent)', pick: (p) => p.newUsers },
  { id: 'active', label: 'Заходы', short: 'Заходили', color: 'var(--blue)', pick: (p) => p.active },
  { id: 'catches', label: 'Уловы', short: 'Уловов', color: 'var(--green)', pick: (p) => p.catches },
]

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

// ---- time, in Tbilisi's clock ------------------------------------------------------------

const fmtDay = new Intl.DateTimeFormat('ru', { timeZone: TZ, day: 'numeric', month: 'short' })
const fmtDayWeek = new Intl.DateTimeFormat('ru', { timeZone: TZ, day: 'numeric', month: 'short', weekday: 'short' })
const fmtTime = new Intl.DateTimeFormat('ru', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })

const dayText = (iso: string | Date) => fmtDay.format(new Date(iso)).replace('.', '')
const timeText = (iso: string | Date) => fmtTime.format(new Date(iso))
const dateTimeText = (iso: string | Date) => `${dayText(iso)}, ${timeText(iso)}`

// Midnight (Tbilisi) `daysAgo` days back.
function startOfDay(daysAgo: number): Date {
  const shifted = new Date(Date.now() + TZ_OFFSET_MS)
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysAgo)
  return new Date(midnight - TZ_OFFSET_MS)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

// Date → the value of a datetime-local input (Tbilisi's wall clock).
function toInputValue(d: Date): string {
  const s = new Date(d.getTime() + TZ_OFFSET_MS)
  return `${s.getUTCFullYear()}-${pad2(s.getUTCMonth() + 1)}-${pad2(s.getUTCDate())}T${pad2(s.getUTCHours())}:${pad2(s.getUTCMinutes())}`
}

// The value of a datetime-local input (Tbilisi's wall clock) → the instant.
function fromInputValue(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - TZ_OFFSET_MS
  return Number.isFinite(t) ? new Date(t) : null
}

type Range = { from: string; to: string | null }

function presetRange(preset: Exclude<Preset, 'custom'>): Range {
  switch (preset) {
    case 'today':
      return { from: startOfDay(0).toISOString(), to: null }
    case 'yesterday':
      return { from: startOfDay(1).toISOString(), to: startOfDay(0).toISOString() }
    case '7':
      return { from: startOfDay(6).toISOString(), to: null }
    case '30':
      return { from: startOfDay(29).toISOString(), to: null }
    case '90':
      return { from: startOfDay(89).toISOString(), to: null }
  }
}

// ---- screen ------------------------------------------------------------------------------

export function AdminStatsScreen({ onBack, active }: { onBack: () => void; active: boolean }) {
  const [preset, setPreset] = useState<Preset>('7')
  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(() => toInputValue(startOfDay(1)))
  const [customTo, setCustomTo] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const [customRange, setCustomRange] = useState<Range | null>(null)
  const [bucketPref, setBucketPref] = useState<'auto' | 'hour' | 'day'>('auto')

  // Preset ranges are cut at midnight, so they only change when the preset does.
  const presetRanged = useMemo(() => (preset === 'custom' ? null : presetRange(preset)), [preset])
  const range = preset === 'custom' ? customRange : presetRanged
  const { data, isLoading, isError, isFetching } = useAppStatsRange(
    range?.from ?? new Date(0).toISOString(),
    range?.to ?? null,
    bucketPref,
    active && !!range
  )

  function pick(next: Preset) {
    setBucketPref('auto')
    if (next === 'custom') {
      setCustomOpen((o) => !o)
      if (customRange) setPreset('custom')
      return
    }
    setCustomOpen(false)
    setPreset(next)
  }

  function applyCustom() {
    const from = fromInputValue(customFrom)
    const to = customTo ? fromInputValue(customTo) : null
    if (!from) return setCustomError('Укажи, с какого момента считать')
    if (to && to <= from) return setCustomError('Конец периода должен быть позже начала')
    if (from.getTime() > Date.now()) return setCustomError('Начало периода ещё не наступило')
    setCustomError(null)
    setCustomRange({ from: from.toISOString(), to: to ? to.toISOString() : null })
    setBucketPref('auto')
    setPreset('custom')
    setCustomOpen(false)
  }

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Статистика</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="filter-row" style={{ marginBottom: customOpen ? 10 : 8 }}>
          {PRESETS.map((p) => (
            <div key={p.id} className={`filter-chip${preset === p.id || (p.id === 'custom' && customOpen) ? ' active' : ''}`} onClick={() => pick(p.id)}>
              {p.label}
            </div>
          ))}
        </div>

        {customOpen && (
          <div className="stats-custom">
            <label>
              <span>С</span>
              <input type="datetime-local" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label>
              <span>До</span>
              <input type="datetime-local" value={customTo} placeholder="сейчас" onChange={(e) => setCustomTo(e.target.value)} />
              {customTo && (
                <button type="button" className="stats-custom-now" onClick={() => setCustomTo('')}>
                  Сейчас
                </button>
              )}
            </label>
            <div className="stats-custom-hint">Время Тбилиси. Если «До» пусто, считаем до сих пор.</div>
            {customError && <div className="stats-custom-error">{customError}</div>}
            <button type="button" className="btn-primary" onClick={applyCustom}>
              Показать
            </button>
          </div>
        )}

        {data && (
          <div className="stats-range" style={{ opacity: isFetching ? 0.55 : 1 }}>
            {dateTimeText(data.from)} — {range?.to ? dateTimeText(data.to) : 'сейчас'} · время Тбилиси
          </div>
        )}
        {!range && <div className="stats-note">Выбери период и нажми «Показать»</div>}
        {isError && <div className="stats-note">Не удалось загрузить статистику</div>}
        {isLoading && range && <div className="stats-note">Считаем…</div>}
        {data && (
          <div style={{ opacity: isFetching ? 0.55 : 1, transition: 'opacity .15s' }}>
            <StatsBody data={data} onBucket={setBucketPref} />
          </div>
        )}
      </div>
    </>
  )
}

// ---- body --------------------------------------------------------------------------------

function StatsBody({ data, onBucket }: { data: AppStats; onBucket: (b: 'auto' | 'hour' | 'day') => void }) {
  const t = data.totals
  const f = data.funnel
  const spanMs = new Date(data.to).getTime() - new Date(data.from).getTime()
  const canHourly = spanMs <= 14 * 86400_000
  const funnel = [
    { label: 'Зарегистрировались', n: f.registered },
    { label: 'Прошли онбординг', n: f.onboarded },
    { label: 'Открыли камеру', n: f.camera },
    { label: 'Поймали первую рыбу', n: f.firstCatch },
    { label: 'Вернулись на другой день', n: f.secondDay },
  ]
  const steps = ONBOARDING_STEPS.map((s) => ({ ...s, devices: data.onboarding.find((o) => o.step === s.id)?.devices ?? 0 }))
  const stepsMax = Math.max(1, ...steps.map((s) => s.devices))
  const cityMax = Math.max(1, ...data.byCity.map((c) => c.n))

  return (
    <>
      <div className="stats-kpis">
        <Kpi label="Новых игроков" value={t.newUsers} sub={t.newUsers ? `в Telegram ${t.viaTelegram} из ${t.newUsers}` : 'за период никого'} now={t.newUsers} prev={data.prev.newUsers} />
        <Kpi label="Заходили" value={t.active} sub={`с аккаунтом ${t.signedIn}`} now={t.active} prev={data.prev.active} />
        <Kpi label="Уловов" value={t.catches} sub={`поймали ${t.catchers} игроков`} now={t.catches} prev={data.prev.catches} />
        <Kpi
          label="Новички с уловом"
          value={t.firstCatch}
          sub={t.newUsers ? `${pct(t.firstCatch, t.newUsers)}% от новых` : 'нет новых'}
          now={t.firstCatch}
          prev={data.prev.firstCatch}
        />
      </div>
      <div className="stats-sub" style={{ marginTop: 6 }}>
        Стрелка сравнивает с предыдущим таким же отрезком. Всего игроков в приложении: {t.playersTotal}.
      </div>

      <StatsChart data={data} canHourly={canHourly} onBucket={onBucket} />

      <section className="stats-block">
        <div className="stats-title">Новые игроки</div>
        <div className="stats-sub">
          {t.newUsers
            ? `Зарегистрировались за период: ${t.newUsers}${t.newUsers > data.newPlayers.length ? `, ниже последние ${data.newPlayers.length}` : ''}`
            : 'За этот период никто не зарегистрировался'}
        </div>
        <NewPlayers players={data.newPlayers} />
      </section>

      {t.newUsers > 0 && (
        <section className="stats-block">
          <div className="stats-title">Откуда новые</div>
          <div className="stats-funnel">
            <div className="stats-funnel-row">
              <span className="stats-funnel-label">Через Telegram</span>
              <span className="stats-funnel-bar">
                <i style={{ transform: `scaleX(${t.viaTelegram / t.newUsers})` }} />
              </span>
              <span className="stats-funnel-num">
                {t.viaTelegram} <em>{pct(t.viaTelegram, t.newUsers)}%</em>
              </span>
            </div>
            {data.byCity.map((c) => (
              <div key={c.city} className="stats-funnel-row">
                <span className="stats-funnel-label">{CITIES[c.city as CityId]?.name ?? 'Без города'}</span>
                <span className="stats-funnel-bar">
                  <i style={{ transform: `scaleX(${c.n / cityMax})`, background: 'var(--blue)' }} />
                </span>
                <span className="stats-funnel-num">
                  {c.n} <em>{pct(c.n, t.newUsers)}%</em>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="stats-block">
        <div className="stats-title">Путь новичка</div>
        <div className="stats-sub">Те, кто зарегистрировался в выбранный период</div>
        <div className="stats-funnel">
          {funnel.map((s) => (
            <div key={s.label} className="stats-funnel-row">
              <span className="stats-funnel-label">{s.label}</span>
              <span className="stats-funnel-bar">
                <i style={{ transform: `scaleX(${f.registered ? s.n / f.registered : 0})` }} />
              </span>
              <span className="stats-funnel-num">
                {s.n} <em>{pct(s.n, f.registered)}%</em>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-block">
        <div className="stats-title">Возвращаются</div>
        <div className="stats-sub">Из тех, кто зарегистрировался в периоде больше 8 дней назад: {data.retention.cohort}</div>
        <div className="stats-kpis" style={{ marginTop: 8 }}>
          <Kpi label="На следующий день" value={data.retention.cohort ? `${pct(data.retention.d1, data.retention.cohort)}%` : '—'} sub={`${data.retention.d1} человек`} />
          <Kpi label="В первую неделю" value={data.retention.cohort ? `${pct(data.retention.w1, data.retention.cohort)}%` : '—'} sub={`${data.retention.w1} человек`} />
        </div>
      </section>

      <section className="stats-block">
        <div className="stats-title">Экраны</div>
        {data.screens.length ? (
          <div className="stats-list">
            {data.screens.map((s) => (
              <div key={s.screen} className="stats-list-row">
                <span>{SCREEN_NAMES[s.screen] ?? s.screen}</span>
                <b>{s.views}</b>
                <em>{s.people} чел.</em>
              </div>
            ))}
          </div>
        ) : (
          <div className="stats-sub">За этот период экраны не открывали (или события ещё не собирались)</div>
        )}
      </section>

      <section className="stats-block">
        <div className="stats-title">Онбординг по шагам</div>
        <div className="stats-sub">Сколько телефонов дошло до шага</div>
        <div className="stats-funnel">
          {steps.map((s) => (
            <div key={s.id} className="stats-funnel-row">
              <span className="stats-funnel-label">{s.name}</span>
              <span className="stats-funnel-bar">
                <i style={{ transform: `scaleX(${s.devices / stepsMax})` }} />
              </span>
              <span className="stats-funnel-num">{s.devices}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="stats-note">Заходы, экраны, камера и онбординг собираются с 6 октября. Регистрации и уловы берутся из базы за весь период.</div>
    </>
  )
}

function Kpi({ label, value, sub, now, prev }: { label: string; value: number | string; sub: string; now?: number; prev?: number }) {
  const diff = now !== undefined && prev !== undefined ? now - prev : null
  return (
    <div className="stats-kpi">
      <span className="stats-kpi-label">{label}</span>
      <span className="stats-kpi-row">
        <b>{value}</b>
        {diff !== null && (
          <span className={`stats-delta${diff > 0 ? ' up' : diff < 0 ? ' down' : ''}`} title={`Предыдущий такой же отрезок: ${prev}`}>
            {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {diff === 0 ? prev : Math.abs(diff)}
          </span>
        )}
      </span>
      <span className="stats-kpi-sub">{sub}</span>
    </div>
  )
}

// ---- new players -------------------------------------------------------------------------

function NewPlayers({ players }: { players: AppStats['newPlayers'] }) {
  const [all, setAll] = useState(false)
  if (!players.length) return null
  const shown = all ? players : players.slice(0, 8)
  return (
    <>
      <div className="stats-players">
        {shown.map((p) => (
          <div key={p.id} className="stats-player">
            <div className="stats-player-main">
              <b>{p.name?.trim() || 'Без имени'}</b>
              {p.publicId && <span>ID {p.publicId}</span>}
              <time>{dateTimeText(p.at)}</time>
            </div>
            <div className="stats-player-tags">
              <span className="stats-tag">{CITIES[p.city as CityId]?.name ?? 'без города'}</span>
              <span className={`stats-tag${p.telegram ? ' on' : ''}`}>{p.telegram ? 'Telegram' : 'не Telegram'}</span>
              <span className={`stats-tag${p.onboarded ? ' on' : ' off'}`}>{p.onboarded ? 'онбординг пройден' : 'онбординг не пройден'}</span>
              <span className={`stats-tag${p.catches ? ' on' : ''}`}>{p.catches ? `уловов: ${p.catches}` : 'без уловов'}</span>
              <span className="stats-tag">{p.seen ? `был ${dateTimeText(p.seen)}` : 'не заходил после'}</span>
            </div>
          </div>
        ))}
      </div>
      {players.length > 8 && (
        <button type="button" className="stats-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Свернуть' : `Показать всех (${players.length})`}
        </button>
      )}
    </>
  )
}

// ---- chart -------------------------------------------------------------------------------

const CW = 340
const CH = 196
const PAD_L = 28
const PAD_R = 6
const PAD_T = 10
const PAD_B = 22

// Round the top of the axis up to a tick that reads well (1, 2, 5, 10, 20, 50…).
function niceAxis(max: number): { top: number; step: number } {
  const raw = Math.max(max, 1) / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag)
  return { top: Math.ceil(Math.max(max, 1) / step) * step, step }
}

function bucketLabel(t: string, bucket: 'hour' | 'day'): string {
  const d = new Date(t)
  if (bucket === 'hour') {
    const end = new Date(d.getTime() + 3600_000)
    return `${dayText(d)}, ${timeText(d)}–${timeText(end)}`
  }
  return fmtDayWeek.format(d).replace('.', '')
}

function StatsChart({
  data,
  canHourly,
  onBucket,
}: {
  data: AppStats
  canHourly: boolean
  onBucket: (b: 'auto' | 'hour' | 'day') => void
}) {
  const [metricId, setMetricId] = useState<MetricId>('newUsers')
  const [sel, setSel] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const metric = METRICS.find((m) => m.id === metricId)!
  const points = data.series
  const n = points.length
  const values = points.map(metric.pick)
  const { top, step } = niceAxis(Math.max(0, ...values))
  const innerW = CW - PAD_L - PAD_R
  const innerH = CH - PAD_T - PAD_B
  const slot = innerW / Math.max(n, 1)
  const gap = n <= 48 ? slot * 0.22 : n <= 120 ? slot * 0.12 : 0
  const y = (v: number) => PAD_T + innerH - (v / top) * innerH
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v)

  // About five labels along the bottom, always the first and the last bucket.
  const labelEvery = Math.max(1, Math.ceil(n / 5))
  const labelIdx: number[] = []
  for (let i = 0; i < n; i += labelEvery) labelIdx.push(i)
  if (n > 1 && n - 1 - labelIdx[labelIdx.length - 1] >= labelEvery * 0.6) labelIdx.push(n - 1)
  const axisLabel = (i: number) => {
    const d = new Date(points[i].t)
    return data.bucket === 'hour' ? (i === 0 || timeText(d) === '00:00' ? `${dayText(d)} ${timeText(d)}` : timeText(d)) : dayText(d)
  }

  function indexAt(e: React.PointerEvent<SVGSVGElement>): number | null {
    const el = svgRef.current
    if (!el || !n) return null
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * CW
    return Math.min(n - 1, Math.max(0, Math.floor((x - PAD_L) / slot)))
  }

  const selPoint = sel !== null ? points[sel] : null
  const total = (m: MetricId) => (m === 'newUsers' ? data.totals.newUsers : m === 'active' ? data.totals.active : data.totals.catches)

  return (
    <section className="stats-block">
      <div className="stats-seg" role="tablist" aria-label="Что показывать на графике">
        {METRICS.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={metricId === m.id} className={metricId === m.id ? 'on' : ''} onClick={() => setMetricId(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="stats-readout" aria-live="polite">
        <div className="stats-readout-when">{selPoint ? bucketLabel(selPoint.t, data.bucket) : `Весь период · ${data.bucket === 'hour' ? 'по часам' : 'по дням'}`}</div>
        <div className="stats-readout-vals">
          {METRICS.map((m) => (
            <span key={m.id} className={m.id === metricId ? 'cur' : ''}>
              <i style={{ background: m.color }} />
              {m.short} <b>{selPoint ? m.pick(selPoint) : total(m.id)}</b>
            </span>
          ))}
        </div>
      </div>

      {n > 0 ? (
        <svg
          ref={svgRef}
          className="stats-chart"
          viewBox={`0 0 ${CW} ${CH}`}
          role="img"
          aria-label={`${metric.label}: график по ${data.bucket === 'hour' ? 'часам' : 'дням'}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setSel(indexAt(e))
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' || e.buttons) setSel(indexAt(e))
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setSel(null)
          }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={CW - PAD_R} y1={y(v)} y2={y(v)} className={v === 0 ? 'stats-axis' : 'stats-grid'} />
              <text x={PAD_L - 5} y={y(v) + 3.5} textAnchor="end" className="stats-tick">
                {v}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const v = values[i]
            const h = (v / top) * innerH
            const x = PAD_L + i * slot + gap / 2
            const w = Math.max(slot - gap, 0.6)
            return (
              <g key={p.t}>
                {sel === i && <rect x={PAD_L + i * slot} y={PAD_T} width={slot} height={innerH} className="stats-sel" />}
                {v > 0 && <rect x={x} y={y(v)} width={w} height={h} rx={Math.min(2, w / 2)} fill={metric.color} opacity={sel === null || sel === i ? 1 : 0.45} />}
              </g>
            )
          })}
          {labelIdx.map((i) => (
            <text key={i} x={Math.min(Math.max(PAD_L + i * slot + slot / 2, PAD_L + 14), CW - PAD_R - 14)} y={CH - 6} textAnchor="middle" className="stats-tick">
              {axisLabel(i)}
            </text>
          ))}
        </svg>
      ) : (
        <div className="stats-sub">Нет данных за период</div>
      )}
      <div className="stats-chart-hint">Проведи пальцем по графику, чтобы увидеть конкретный {data.bucket === 'hour' ? 'час' : 'день'}</div>

      {canHourly && (
        <div className="stats-seg small" style={{ marginTop: 10 }}>
          <button type="button" className={data.bucket === 'hour' ? 'on' : ''} onClick={() => onBucket('hour')}>
            По часам
          </button>
          <button type="button" className={data.bucket === 'day' ? 'on' : ''} onClick={() => onBucket('day')}>
            По дням
          </button>
        </div>
      )}
    </section>
  )
}
