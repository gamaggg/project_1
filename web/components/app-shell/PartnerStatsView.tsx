'use client'

import '@/app/partner-points.css'
import { useMemo, useState } from 'react'
import { useAdminPartnerViewers, usePartnerStats, useSetPartnerViewer, type PartnerStatKind, type PartnerStats } from '@/lib/supabase/queries'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { CITIES, type CityId } from '@/lib/data/city'
import { addDays } from '@/lib/data/partnerPoints'

// A partner point's statistics (03_partner_stats.sql, partner_point_stats): for the super admin («Точки партнёров» →
// «Статистика») and for the partner's own account once the point was shared with them (Профиль → «Статистика точки»).
// Plain words: what players did with the pin and the card over the chosen period, the way from the card to the promo
// code and on to the shop, and day by day. `admin` adds who the statistics are shared with.

type Period = '1' | '7' | '30' | 'all'
const PERIODS: { id: Period; label: string }[] = [
  { id: '1', label: 'Сутки' },
  { id: '7', label: '7 дней' },
  { id: '30', label: '30 дней' },
  { id: 'all', label: 'Весь срок' },
]

const KINDS: { id: PartnerStatKind; label: string; hint: string }[] = [
  { id: 'pin', label: 'Нажали на метку', hint: 'на карте' },
  { id: 'open', label: 'Открыли карточку', hint: 'с карты или из рейтинга' },
  { id: 'copy_promo', label: 'Скопировали промокод', hint: 'кнопка «Скопировать промокод»' },
  { id: 'route', label: 'Построили маршрут', hint: 'кнопка «Маршрут»' },
  { id: 'call', label: 'Позвонили', hint: 'кнопка «Позвонить»' },
  { id: 'site', label: 'Перешли на сайт', hint: 'кнопка «Сайт»' },
  { id: 'copy_address', label: 'Скопировали адрес', hint: 'кнопка «Скопировать» у адреса' },
  { id: 'photo', label: 'Смотрели фото', hint: 'открыли фото на весь экран' },
]

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many
}
const people = (n: number) => `${n} ${plural(n, 'человек', 'человека', 'человек')}`
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const MONTHS = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.']
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`

function cityDay(city: CityId, at: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CITIES[city].timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
}

export function PartnerStatsView({
  pointId,
  city,
  name,
  startsAt,
  admin = false,
}: {
  pointId: number
  city: CityId
  name: string
  startsAt: string
  admin?: boolean
}) {
  const [period, setPeriod] = useState<Period>('all')
  // The window is fixed when the period is picked (a new «now» on every render would refetch forever).
  const [now] = useState(() => Date.now())
  const range = useMemo(() => {
    const to = new Date(now + 60_000).toISOString()
    const from = period === 'all' ? startsAt : new Date(now - Number(period) * 86_400_000).toISOString()
    return { from, to }
  }, [period, now, startsAt])
  const { data, isLoading, isError, error } = usePartnerStats(pointId, range.from, range.to)

  return (
    <div className="pps">
      <div className="pps-head">
        <div className="pps-name">{name}</div>
        <div className="pps-sub">Статистика точки на карте RANGE</div>
      </div>
      <div className="ppa-chips">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" className={`filter-chip${period === p.id ? ' active' : ''}`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {isLoading && <div className="stats-note">Считаем…</div>}
      {isError && (
        <div className="stats-note">
          {String((error as Error)?.message ?? '').includes('not_authorized') ? 'Нет доступа к статистике этой точки' : 'Не удалось загрузить статистику'}
        </div>
      )}
      {data && <StatsBody data={data} city={city} from={range.from} to={range.to} />}
      {admin && <Viewers pointId={pointId} />}
    </div>
  )
}

export function StatsBody({ data, city, from, to }: { data: PartnerStats; city: CityId; from: string; to: string }) {
  const t = data.totals
  const f = data.funnel
  const empty = data.people === 0

  // Every day of the period (up to 60), the quiet ones too, so the chart reads as time.
  const days = useMemo(() => {
    const byDay = new Map(data.days.map((d) => [d.day, d]))
    const last = cityDay(city, Date.parse(to) - 60_000)
    let first = cityDay(city, Date.parse(from))
    const span = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000)
    if (span > 59) first = addDays(last, -59)
    const out: { day: string; pin: number; open: number; copy_promo: number }[] = []
    for (let d = first; d <= last; d = addDays(d, 1)) out.push(byDay.get(d) ?? { day: d, pin: 0, open: 0, copy_promo: 0 })
    return out
  }, [data.days, city, from, to])
  const max = Math.max(1, ...days.map((d) => Math.max(d.open, d.pin, d.copy_promo)))

  return (
    <>
      <div className="pps-hero">
        <b>{data.people}</b>
        <span>{plural(data.people, 'человек', 'человека', 'человек')} заинтересовались точкой за этот период</span>
      </div>
      {empty && <div className="stats-note">Пока никто не нажимал на метку и карточку в этот период.</div>}

      <h3 className="ppa-h">Путь до магазина</h3>
      <div className="pps-funnel">
        <FunnelRow label="Открыли карточку или нажали метку" value={f.opened} base={f.opened} />
        <FunnelRow label="Скопировали промокод" value={f.copied} base={f.opened} />
        <FunnelRow label="После промокода нажали «Маршрут», «Позвонить» или «Сайт»" value={f.copied_then_any} base={f.copied} sub />
        <div className="pps-funnel-split">
          <span>маршрут <b>{f.copied_then_route}</b></span>
          <span>звонок <b>{f.copied_then_call}</b></span>
          <span>сайт <b>{f.copied_then_site}</b></span>
        </div>
      </div>
      <div className="stats-note" style={{ marginTop: 6 }}>
        Проценты: «Скопировали промокод» — от открывших карточку; следующая строка — от скопировавших промокод.
      </div>

      <h3 className="ppa-h">Все нажатия</h3>
      <div className="pps-grid">
        {KINDS.map((k) => (
          <div key={k.id} className="pps-tile">
            <span className="pps-tile-label">{k.label}</span>
            <b>{t[k.id]?.count ?? 0}</b>
            <span className="pps-tile-sub">
              {people(t[k.id]?.people ?? 0)} · {k.hint}
            </span>
          </div>
        ))}
      </div>

      <h3 className="ppa-h">По дням</h3>
      <div className="pps-legend">
        <span><i className="pps-c-open" /> открыли карточку</span>
        <span><i className="pps-c-pin" /> нажали метку</span>
        <span><i className="pps-c-promo" /> скопировали промокод</span>
      </div>
      <div className="pps-days">
        {[...days].reverse().map((d) => (
          <div key={d.day} className="pps-day">
            <span className="pps-day-date">{dayLabel(d.day)}</span>
            <span className="pps-day-bars">
              <i className="pps-c-open" style={{ width: `${(d.open / max) * 100}%` }} />
              <i className="pps-c-pin" style={{ width: `${(d.pin / max) * 100}%` }} />
              <i className="pps-c-promo" style={{ width: `${(d.copy_promo / max) * 100}%` }} />
            </span>
            <span className="pps-day-num">
              {d.open} · {d.pin} · {d.copy_promo}
            </span>
          </div>
        ))}
      </div>
      <div className="stats-note">
        Человек — это аккаунт игрока или телефон гостя без аккаунта. Админы RANGE не считаются. Повторное нажатие той же кнопки чаще раза в
        10 секунд не учитывается. Дни — по местному времени города. Скопированный промокод — ещё не покупка: сколько человек
        пришли в магазин, видно только на кассе.
      </div>
    </>
  )
}

function FunnelRow({ label, value, base, sub = false }: { label: string; value: number; base: number; sub?: boolean }) {
  const w = base > 0 ? Math.max(value > 0 ? 4 : 0, (value / base) * 100) : 0
  return (
    <div className={`pps-frow${sub ? ' pps-frow-sub' : ''}`}>
      <div className="pps-frow-top">
        <span>{label}</span>
        <b>
          {value} <em>{pct(value, base)}</em>
        </b>
      </div>
      <div className="pps-bar">
        <i style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}

function Viewers({ pointId }: { pointId: number }) {
  const { data: viewers = [], isLoading, isError } = useAdminPartnerViewers(pointId)
  const set = useSetPartnerViewer()
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <>
      <h3 className="ppa-h">Кому открыта эта статистика</h3>
      <div className="stats-note" style={{ marginTop: 0 }}>
        Чтобы показать статистику партнёру: откройте его профиль в RANGE → «Статистика точки партнёра» → включите эту точку. Он увидит её у себя в
        профиле.
      </div>
      {isLoading && <div className="stats-note">Загружаем…</div>}
      {isError && <div className="stats-note">Не удалось загрузить список</div>}
      {!isLoading && !isError && viewers.length === 0 && <div className="stats-note">Пока никому.</div>}
      {viewers.map((v) => (
        <div key={v.userId} className="pps-viewer">
          <span className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.avatarUrl ? <img src={thumbUrl(v.avatarUrl, 96)} alt="" /> : (v.displayName ?? 'И').slice(0, 2).toUpperCase()}
          </span>
          <span className="pps-viewer-name">{v.displayName ?? 'Игрок'}</span>
          <button
            type="button"
            className="ppa-renew-btn"
            disabled={busy === v.userId}
            onClick={async () => {
              setBusy(v.userId)
              try {
                await set.mutateAsync({ pointId, userId: v.userId, on: false })
              } finally {
                setBusy(null)
              }
            }}
          >
            {busy === v.userId ? '…' : 'Закрыть доступ'}
          </button>
        </div>
      ))}
    </>
  )
}
