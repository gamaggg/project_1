'use client'

import { useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { useAppStats, type AppStats } from '@/lib/supabase/queries'

// Super admin's «Статистика»: our own app_events (from this update on)
// plus what the database already knows (sign-ups, catches). Russian only,
// like the other admin screens.

const PERIODS = [7, 30, 90] as const

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

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'short' })

export function AdminStatsScreen({ onBack, active }: { onBack: () => void; active: boolean }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const { data, isLoading, isError } = useAppStats(days, active)

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Статистика</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="filter-row" style={{ marginBottom: 14 }}>
          {PERIODS.map((p) => (
            <div key={p} className={`filter-chip${days === p ? ' active' : ''}`} onClick={() => setDays(p)}>
              {p} дней
            </div>
          ))}
        </div>
        {isError && <div className="stats-note">Не удалось загрузить статистику</div>}
        {isLoading && <div className="stats-note">Считаем…</div>}
        {data && <StatsBody data={data} />}
      </div>
    </>
  )
}

function StatsBody({ data }: { data: AppStats }) {
  const today = data.daily[data.daily.length - 1]
  const newUsers = data.daily.reduce((a, d) => a + d.newUsers, 0)
  const catches = data.daily.reduce((a, d) => a + d.catches, 0)
  const f = data.funnel
  const funnel = [
    { label: 'Зарегистрировались', n: f.registered },
    { label: 'Прошли онбординг', n: f.onboarded },
    { label: 'Открыли камеру', n: f.camera },
    { label: 'Поймали первую рыбу', n: f.firstCatch },
    { label: 'Вернулись на другой день', n: f.secondDay },
  ]
  const steps = ONBOARDING_STEPS.map((s) => ({ ...s, devices: data.onboarding.find((o) => o.step === s.id)?.devices ?? 0 }))
  const stepsMax = Math.max(1, ...steps.map((s) => s.devices))

  return (
    <>
      <div className="stats-kpis">
        <Kpi label="Сегодня заходили" value={today?.active ?? 0} sub={`из них с аккаунтом ${today?.signedIn ?? 0}`} />
        <Kpi label="За 7 дней" value={data.wau} sub="игроков с аккаунтом" />
        <Kpi label="За 30 дней" value={data.mau} sub="игроков с аккаунтом" />
        <Kpi label="Новых за период" value={newUsers} sub={`уловов за период ${catches}`} />
      </div>

      <section className="stats-block">
        <div className="stats-title">Заходы по дням</div>
        <Bars daily={data.daily} pick={(d) => d.active} color="var(--blue)" />
      </section>
      <section className="stats-block">
        <div className="stats-title">Новые игроки по дням</div>
        <Bars daily={data.daily} pick={(d) => d.newUsers} color="var(--accent)" />
      </section>
      <section className="stats-block">
        <div className="stats-title">Уловы по дням</div>
        <Bars daily={data.daily} pick={(d) => d.catches} color="var(--green)" />
      </section>

      <section className="stats-block">
        <div className="stats-title">Путь новичка</div>
        <div className="stats-sub">Зарегистрировались с {dayLabel(data.from)}</div>
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
        <div className="stats-sub">Кто зарегистрировался в периоде больше 8 дней назад: {data.retention.cohort}</div>
        <div className="stats-kpis" style={{ marginTop: 8 }}>
          <Kpi label="На следующий день" value={`${pct(data.retention.d1, data.retention.cohort)}%`} sub={`${data.retention.d1} человек`} />
          <Kpi label="В первую неделю" value={`${pct(data.retention.w1, data.retention.cohort)}%`} sub={`${data.retention.w1} человек`} />
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
          <div className="stats-sub">Пока пусто — экраны считаются с выхода обновления</div>
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

      <div className="stats-note">Заходы, экраны, камера и онбординг собираются с выхода обновления. Регистрации и уловы — из базы за весь период.</div>
    </>
  )
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="stats-kpi">
      <span className="stats-kpi-label">{label}</span>
      <b>{value}</b>
      <span className="stats-kpi-sub">{sub}</span>
    </div>
  )
}

function Bars({ daily, pick, color }: { daily: AppStats['daily']; pick: (d: AppStats['daily'][number]) => number; color: string }) {
  const values = daily.map(pick)
  const max = Math.max(1, ...values)
  return (
    <>
      <div className="stats-bars" style={{ ['--bar-color' as string]: color }}>
        {daily.map((d, i) => (
          <span key={d.day} title={`${dayLabel(d.day)}: ${values[i]}`}>
            <i style={{ height: `${values[i] ? Math.max(6, (values[i] / max) * 100) : 0}%` }} />
          </span>
        ))}
      </div>
      <div className="stats-bars-axis">
        <span>{dayLabel(daily[0].day)}</span>
        <span>макс. {max}</span>
        <span>{dayLabel(daily[daily.length - 1].day)}</span>
      </div>
    </>
  )
}
