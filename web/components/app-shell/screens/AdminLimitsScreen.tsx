'use client'

import { useMemo, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { useServiceLimits } from '@/lib/supabase/queries'
import {
  BUCKET_NAMES,
  SERVICES,
  formatAmount,
  limitService,
  limitText,
  limitTitle,
  sourceLabel,
  summarize,
  type Level,
  type LimitRow,
  type Verdict,
} from '@/lib/data/serviceLimits'

// «Лимиты сервисов» for the super admin and for admins given the switch: every service we
// run on a free plan, in plain Russian: how much is used, what happens if it runs out, and
// roughly when that would happen. The numbers come from get_service_limits (see
// docs/45 Администрирование/Лимиты в приложении.md).

const ORDER: Record<Level, number> = { bad: 0, warn: 1, ok: 2, info: 3 }

type Entry = { row: LimitRow; v: Verdict }

export function AdminLimitsScreen({ onBack, active }: { onBack: () => void; active: boolean }) {
  const { data, isLoading, isError, isFetching, refetch } = useServiceLimits(active)
  const [open, setOpen] = useState<string | null>(null)

  const sum = useMemo(() => (data ? summarize(data.items.filter((r) => limitService(r.key)), data.now) : null), [data])

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Лимиты сервисов</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {isLoading && <div className="stats-note">Считаем…</div>}
        {isError && <div className="stats-note">Не удалось загрузить лимиты</div>}
        {data && sum && (
          <div style={{ opacity: isFetching ? 0.55 : 1, transition: 'opacity .15s' }}>
            <Banner bad={sum.bad} warn={sum.warn} />
            <div className="stats-note" style={{ marginTop: 0 }}>
              У каждого сервиса есть бесплатная норма. Если её превысить, он что-то ограничит или потребует деньги. Ниже по каждому: сколько уже
              занято, что будет, если кончится, и примерная дата, когда это может случиться. Нажми на строку, чтобы прочитать подробнее.
            </div>
            {SERVICES.map((svc) => {
              const rows: Entry[] = sum.verdicts
                .filter((x) => limitService(x.row.key) === svc.id)
                .map((x) => ({ row: x.row, v: x.v }))
                .sort((a, b) => ORDER[a.v.level] - ORDER[b.v.level])
              if (rows.length === 0) return null
              return (
                <section key={svc.id} className="limits-service">
                  <div className="limits-service-name">{svc.name}</div>
                  <div className="limits-service-about">{svc.about}</div>
                  {rows.map(({ row, v }) => (
                    <LimitCard key={row.key} row={row} v={v} now={data.now} open={open === row.key} onToggle={() => setOpen(open === row.key ? null : row.key)} />
                  ))}
                </section>
              )
            })}
            <button type="button" className="stats-more" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function Banner({ bad, warn }: { bad: Entry[]; warn: Entry[] }) {
  const level: Level = bad.length ? 'bad' : warn.length ? 'warn' : 'ok'
  const title = bad.length ? 'Есть то, что скоро кончится' : warn.length ? 'Всё работает, но за кое-чем стоит следить' : 'Всё в порядке, лимитов бояться не нужно'
  const items = [...bad, ...warn]
  return (
    <div className={`limits-banner ${level}`}>
      <b>{title}</b>
      {items.length > 0 && (
        <ul>
          {items.map(({ row, v }) => (
            <li key={row.key}>
              <span>{limitTitle(row.key)}:</span> {v.headline.charAt(0).toLowerCase() + v.headline.slice(1)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LimitCard({ row, v, now, open, onToggle }: { row: LimitRow; v: Verdict; now: string; open: boolean; onToggle: () => void }) {
  const text = limitText(row.key)
  const src = sourceLabel(row, now)
  const pct = v.pct == null ? 0 : Math.min(100, Math.max(row.used > 0 ? 2 : 0, v.pct))
  const buckets = row.key === 'storage_files' ? ((row.detail as { name: string; mb: number; mb_7d: number }[] | undefined) ?? []) : []
  const cronMb = row.key === 'database' ? Number((row.detail as { cron_mb?: number } | undefined)?.cron_mb ?? 0) : 0

  return (
    <div className={`limit-card ${v.level}${open ? ' open' : ''}`}>
      <button type="button" className="limit-head" aria-expanded={open} onClick={onToggle}>
        <span className="limit-dot" aria-hidden />
        <span className="limit-main">
          <span className="limit-title">{limitTitle(row.key)}</span>
          <span className="limit-headline">{v.headline}</span>
        </span>
        <svg className="limit-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {v.pct != null && (
        <div className="limit-bar" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="limit-amount">
        {row.limit != null ? (
          <>
            <b>{formatAmount(row.unit, row.used)}</b> из {formatAmount(row.unit, row.limit)}
            {v.pct != null && <span> · занято {v.pct < 1 && v.pct > 0 ? '<1' : Math.round(v.pct)}%</span>}
          </>
        ) : (
          <b>{formatAmount(row.unit, row.used)}</b>
        )}
      </div>
      {open && (
        <div className="limit-more">
          {v.note && (
            <>
              <div className="limit-label">Прогноз</div>
              <p>{v.note}</p>
            </>
          )}
          <div className="limit-label">Что это</div>
          <p>{text.what}</p>
          <div className="limit-label">Что будет, если кончится</div>
          <p>{text.ifFull}</p>
          {buckets.length > 0 && (
            <>
              <div className="limit-label">Что занимает место</div>
              <ul className="limit-list">
                {buckets.map((b) => (
                  <li key={b.name}>
                    <span>{BUCKET_NAMES[b.name] ?? b.name}</span>
                    <span>
                      {formatAmount('mb', b.mb)}
                      {b.mb_7d > 0 && <em> +{formatAmount('mb', b.mb_7d)} за неделю</em>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {cronMb > 0 && (
            <p>
              Из них {formatAmount('mb', cronMb)} занимает история фоновых задач. Её можно безопасно чистить, это не данные игроков.
            </p>
          )}
          <div className="limit-source">
            {src.text}
            {src.stale && <b> Цифра устарела, попроси обновить.</b>}
          </div>
        </div>
      )}
    </div>
  )
}
