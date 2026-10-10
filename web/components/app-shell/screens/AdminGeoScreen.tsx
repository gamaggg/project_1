'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PanoramaViewer } from '@/components/app-shell/PanoramaViewer'
import { useAdminGeoFill, useAdminGeoList, useAdminGeoPlan, useAdminGeoReview, useAdminGeoSetDay, useTerritories } from '@/lib/supabase/queries'
import { geoImageUrl, type AdminGeoPanorama, type AdminGeoPlanDay, type GeoCity } from '@/lib/geo'

// Leaflet touches `window` at import time.
const GeoSpotMap = dynamic(() => import('@/components/app-shell/GeoSpotMap').then((m) => m.GeoSpotMap), { ssr: false })

type Status = AdminGeoPanorama['status']
type Tab = Status | 'plan'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Проверка' },
  { id: 'approved', label: 'Одобрены' },
  { id: 'rejected', label: 'Отказ' },
  { id: 'plan', label: 'План' },
]

// City dates come as 'YYYY-MM-DD'; read at noon UTC so no time zone moves
// them a day.
function dayDate(day: string) {
  return new Date(`${day}T12:00:00Z`)
}
function formatDay(day: string, opts: Intl.DateTimeFormatOptions) {
  return dayDate(day).toLocaleDateString('ru-RU', { ...opts, timeZone: 'UTC' })
}

// Metres from a point to the nearest side of its sector's hexagon — how far
// GPS error would have to go to put the answer next door.
function metresToEdge(lat: number, lng: number, corners: [number, number][]): number {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180)
  const ky = 110540
  let best = Infinity
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const ax = (corners[j][1] - lng) * kx
    const ay = (corners[j][0] - lat) * ky
    const dx = (corners[i][1] - corners[j][1]) * kx
    const dy = (corners[i][0] - corners[j][0]) * ky
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}

// «92% · 27 м до воды» (quality, water) for a planned day.
function panoNote(p: AdminGeoPanorama | undefined): string {
  if (!p) return 'убрана из игры'
  return [p.quality !== null && `${Math.round(p.quality * 100)}%`, p.waterM !== null && `${Math.round(p.waterM)} м до воды`].filter(Boolean).join(' · ')
}

function planErrorText(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? error)
  if (msg.includes('GEO:day_played')) return 'В этот день уже отвечали — панораму не поменять'
  if (msg.includes('GEO:past_day')) return 'Этот день уже прошёл'
  if (msg.includes('GEO:not_approved')) return 'Эту панораму убрали из игры'
  return 'Не получилось — попробуй ещё раз'
}

// Super admin: the panoramas scripts/geo-import.mjs brought in. «Проверка»
// goes through them one at a time — keep the ones where the water is in view;
// «Подходит» also saves the way the view is turned now (that's where it opens
// for the players). «План» lays the approved ones out over the next 30 days.
export function AdminGeoScreen({ active }: { active: boolean }) {
  const [city, setCity] = useState<GeoCity>('batumi')
  const [tab, setTab] = useState<Tab>('pending')
  const pending = useAdminGeoList('pending')
  const approved = useAdminGeoList('approved')
  const rejected = useAdminGeoList('rejected')
  const lists = { pending, approved, rejected }

  const inCity = (s: Status) => (lists[s].data ?? []).filter((p) => p.city === city)
  const counts = {
    pending: inCity('pending').length,
    approved: inCity('approved').length,
    rejected: inCity('rejected').length,
  }
  const cityTotal = (c: GeoCity) => [pending, approved, rejected].reduce((n, q) => n + (q.data ?? []).filter((p) => p.city === c).length, 0)

  return (
    <div className="admin-geo">
      <div className="admin-geo-tabs small" role="tablist" aria-label="Город">
        {(['batumi', 'moscow'] as const).map((c) => (
          <button key={c} role="tab" aria-selected={city === c} className={city === c ? 'on' : undefined} onClick={() => setCity(c)}>
            {c === 'batumi' ? 'Батуми' : 'Москва'}
            <span className="admin-geo-tab-n">{cityTotal(c)}</span>
          </button>
        ))}
      </div>
      <div className="admin-geo-tabs" role="tablist" aria-label="Раздел">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id !== 'plan' && <span className="admin-geo-tab-n">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'plan' ? (
        <GeoPlan key={city} city={city} approved={inCity('approved')} active={active} />
      ) : (
        <GeoReview key={`${city}:${tab}`} status={tab} list={inCity(tab)} loading={lists[tab].isLoading} reviewed={counts.approved + counts.rejected} active={active} />
      )}
    </div>
  )
}

type Undo = {
  id: number
  status: Status
  heading: number
  index: number
  text: string
}

function GeoReview({ status, list, loading, reviewed, active }: { status: Status; list: AdminGeoPanorama[]; loading: boolean; reviewed: number; active: boolean }) {
  const { data: territories = [] } = useTerritories()
  const review = useAdminGeoReview()
  const [index, setIndex] = useState(0)
  const [yaw, setYaw] = useState<number | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const i = Math.min(index, Math.max(0, list.length - 1))
  const pano = list[i]
  const sector = pano ? (territories.find((t) => t.id === pano.territoryId) ?? null) : null
  const view = yaw ?? pano?.heading ?? 0

  function go(next: number) {
    setIndex(Math.max(0, Math.min(list.length - 1, next)))
    setYaw(null)
  }

  // ← → between panoramas on a keyboard.
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })
  useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.key === 'ArrowLeft') goRef.current(i - 1)
      if (e.key === 'ArrowRight') goRef.current(i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, i])

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    },
    []
  )

  function showUndo(u: Undo) {
    setUndo(u)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 6000)
  }

  function decide(next: Status) {
    if (!pano) return
    const was = {
      id: pano.id,
      status: pano.status,
      heading: pano.heading,
      index: i,
    }
    review.mutate(
      {
        id: pano.id,
        status: next,
        heading: next === 'approved' ? view : undefined,
      },
      {
        onSuccess: () => {
          setYaw(null)
          // The list loses this one (another status now), so the same index
          // is already the next panorama; on the last one step back.
          if (next === status) setIndex(i + 1)
          else if (i >= list.length - 1) setIndex(Math.max(0, i - 1))
          const text =
            next === status ? `Вид сохранён · ${pano.territoryId ?? ''}` : next === 'approved' ? `Одобрена · ${pano.territoryId ?? ''}` : `Отклонена · ${pano.territoryId ?? ''}`
          showUndo({ ...was, text })
        },
      }
    )
  }

  function revert() {
    if (!undo) return
    const u = undo
    setUndo(null)
    review.mutate({ id: u.id, status: u.status, heading: u.heading }, { onSuccess: () => go(u.index) })
  }

  const total = reviewed + list.length

  return (
    <>
      {status === 'pending' && total > 0 && (
        <div className="admin-geo-progress">
          <div className="admin-geo-progress-text">
            Проверено <b>{reviewed}</b> из {total}
          </div>
          <div className="admin-geo-progress-bar">
            <span style={{ transform: `scaleX(${reviewed / total})` }} />
          </div>
        </div>
      )}

      {loading ? (
        <>
          <div className="skel admin-geo-skel" aria-hidden />
          <div className="admin-geo-skel-row" aria-hidden>
            <span />
            <span />
          </div>
        </>
      ) : !pano ? (
        <div className="geo-empty">
          <div className="geo-empty-art" aria-hidden />
          <div className="geo-empty-title">
            {status === 'pending' ? (total ? 'Всё проверено' : 'Панорам пока нет') : status === 'approved' ? 'Одобренных пока нет' : 'Отклонённых нет'}
          </div>
          <p>
            {status === 'pending'
              ? 'Новые панорамы появятся здесь после импорта с Mapillary.'
              : status === 'approved'
                ? 'Одобряй панорамы во вкладке «Проверка» — из них собирается план на месяц.'
                : 'Сюда попадают панорамы, которые не подошли. Любую можно вернуть в игру.'}
          </p>
        </div>
      ) : (
        <>
          <div className="admin-geo-stage">
            {active && (
              <PanoramaViewer
                key={pano.id}
                className="geo-pano"
                src={geoImageUrl(pano.image)}
                preview={geoImageUrl(pano.image, 'small')}
                heading={pano.heading}
                spin={false}
                onYawChange={setYaw}
              />
            )}
            <div className="admin-geo-stage-top">
              <span className="admin-geo-chip">{pano.territoryId ?? 'вне сектора'}</span>
              <span className="admin-geo-chip">
                {i + 1} / {list.length}
              </span>
            </div>
            <button className="admin-geo-nav prev" disabled={i === 0} onClick={() => go(i - 1)} aria-label="Предыдущая">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button className="admin-geo-nav next" disabled={i >= list.length - 1} onClick={() => go(i + 1)} aria-label="Следующая">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="admin-geo-actions">
            {status !== 'rejected' && (
              <button className="btn-secondary" disabled={review.isPending} onClick={() => decide('rejected')}>
                {status === 'approved' ? 'Убрать из игры' : 'Не подходит'}
              </button>
            )}
            <button className="btn-primary" disabled={review.isPending} onClick={() => decide('approved')}>
              {status === 'approved' ? 'Сохранить вид' : status === 'rejected' ? 'Вернуть в игру' : 'Подходит'}
            </button>
          </div>

          <div className="admin-geo-info">
            <GeoSpotMap corners={sector?.corners ?? null} lat={pano.lat} lng={pano.lng} bearing={(((view - pano.north) % 360) + 360) % 360} />
            <dl className="admin-geo-facts">
              {pano.quality !== null && (
                <div>
                  <dt>Качество</dt>
                  <dd>{Math.round(pano.quality * 100)}%</dd>
                </div>
              )}
              {pano.waterM !== null && (
                <div>
                  <dt>До воды</dt>
                  <dd>{Math.round(pano.waterM)} м</dd>
                </div>
              )}
              {sector && (
                <div>
                  <dt>До края</dt>
                  <dd>{Math.round(metresToEdge(pano.lat, pano.lng, sector.corners))} м</dd>
                </div>
              )}
              {pano.capturedAt && (
                <div>
                  <dt>Снята</dt>
                  <dd>
                    {new Date(pano.capturedAt).toLocaleDateString('ru-RU', {
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              )}
              {status === 'approved' && (
                <div>
                  <dt>В игре</dt>
                  <dd>{pano.nextDay ? `в плане на ${formatDay(pano.nextDay, { day: 'numeric', month: 'short' })}` : pano.shown > 0 ? `показана ${pano.shown}×` : 'ещё не было'}</dd>
                </div>
              )}
              {pano.author && (
                <div className="wide">
                  <dt>Автор · Mapillary</dt>
                  <dd className="admin-geo-author">{pano.author}</dd>
                </div>
              )}
            </dl>
          </div>

          <p className="admin-geo-hint">
            Поверни панораму к воде — так она откроется у игроков. Конус на карте показывает, куда смотрит вид. Не подходит: воды не видно, темно, размыто.
          </p>
        </>
      )}

      {undo &&
        createPortal(
          <div className="admin-geo-undo" role="status">
            <span>{undo.text}</span>
            <button onClick={revert}>Отменить</button>
          </div>,
          document.body
        )}
    </>
  )
}

function GeoPlan({ city, approved, active }: { city: GeoCity; approved: AdminGeoPanorama[]; active: boolean }) {
  const { data: plan, isLoading } = useAdminGeoPlan(city, active)
  const fill = useAdminGeoFill()
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [filled, setFilled] = useState<number | null>(null)

  const planned = (plan ?? []).filter((d) => d.panoramaId !== null).length
  const empty = (plan ?? []).length - planned
  // Approved and never used — what «Заполнить» takes from.
  const reserve = approved.filter((p) => !p.nextDay && p.shown === 0).length
  const day = plan?.find((d) => d.day === openDay) ?? null

  return (
    <>
      <div className="admin-plan-head">
        <div className="admin-plan-stat">
          <div>
            <b>{planned}</b> из {plan?.length ?? 30} дней с панорамой
          </div>
          <span>В запасе ещё {reserve} — одобренные, которых не было</span>
        </div>
        <button className="btn-primary admin-plan-fill" disabled={fill.isPending || !empty || !reserve} onClick={() => fill.mutate(city, { onSuccess: (n) => setFilled(n) })}>
          {fill.isPending ? 'Заполняю…' : 'Заполнить'}
        </button>
      </div>
      <p className="admin-geo-hint">
        {filled !== null
          ? `Готово: панорамы поставлены на ${filled} ${filled % 10 === 1 && filled % 100 !== 11 ? 'день' : filled % 10 >= 2 && filled % 10 <= 4 && (filled % 100 < 10 || filled % 100 >= 20) ? 'дня' : 'дней'}. Нажми на день, чтобы заменить.`
          : '«Заполнить» ставит на пустые дни лучшие одобренные, которых ещё не было. Пустой день игра заполнит сама — случайной одобренной.'}
      </p>

      {isLoading ? (
        <div className="admin-plan-list" aria-hidden>
          {Array.from({ length: 6 }, (_, k) => (
            <div key={k} className="admin-plan-row skel-row">
              <span className="skel" style={{ width: 44, height: 34 }} />
              <span className="skel" style={{ width: 96, height: 48, borderRadius: 10 }} />
              <span className="skel" style={{ flex: 1, height: 14 }} />
            </div>
          ))}
        </div>
      ) : (
        <ol className="admin-plan-list">
          {(plan ?? []).map((d, k) => (
            <li key={d.day}>
              <button className={`admin-plan-row${d.locked ? ' locked' : ''}`} onClick={() => setOpenDay(d.day)}>
                <span className="admin-plan-date">
                  <b>{formatDay(d.day, { day: 'numeric' })}</b>
                  <span>{k === 0 ? 'сегодня' : k === 1 ? 'завтра' : formatDay(d.day, { weekday: 'short' })}</span>
                </span>
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a storage preview, not worth next/image here
                  <img className="admin-plan-thumb" src={geoImageUrl(d.image, 'small')} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="admin-plan-thumb empty">случайная</span>
                )}
                <span className="admin-plan-main">
                  <span className="admin-plan-sector">{d.territoryId ?? 'Не выбрана'}</span>
                  <span className="admin-plan-sub">
                    {d.locked ? 'Уже отвечали — не меняется' : d.image ? panoNote(approved.find((p) => p.id === d.panoramaId)) : 'Игра выберет сама'}
                  </span>
                </span>
                {d.locked ? (
                  <svg
                    className="admin-plan-lock"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-label="Закрыт"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                ) : (
                  <svg
                    className="admin-plan-chev"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}

      {day && active && <GeoDaySheet city={city} day={day} isToday={plan?.[0]?.day === day.day} approved={approved} onClose={() => setOpenDay(null)} />}
    </>
  )
}

function GeoDaySheet({ city, day, isToday, approved, onClose }: { city: GeoCity; day: AdminGeoPlanDay; isToday: boolean; approved: AdminGeoPanorama[]; onClose: () => void }) {
  const setDay = useAdminGeoSetDay()
  // Not used yet first, then the best.
  const choices = useMemo(
    () =>
      [...approved].sort((a, b) => {
        const usedA = a.nextDay || a.shown > 0 ? 1 : 0
        const usedB = b.nextDay || b.shown > 0 ? 1 : 0
        return usedA - usedB || (b.quality ?? 0) - (a.quality ?? 0)
      }),
    [approved]
  )

  function put(panoramaId: number | null) {
    setDay.mutate({ city, day: day.day, panoramaId }, { onSuccess: onClose })
  }

  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet admin-day-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="День плана">
        <div className="move-sheet-handle" />
        <div className="admin-day-head">
          <div>
            <div className="admin-day-kicker">{isToday ? 'Сегодня' : formatDay(day.day, { weekday: 'long' })}</div>
            <div className="admin-day-title">{formatDay(day.day, { day: 'numeric', month: 'long' })}</div>
          </div>
          <button className="icon-btn tap-scale" aria-label="Закрыть" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="admin-day-body">
          {day.image && (
            <PanoramaViewer
              key={day.panoramaId}
              className="geo-pano admin-day-pano"
              src={geoImageUrl(day.image)}
              preview={geoImageUrl(day.image, 'small')}
              heading={day.heading ?? 0}
              spin={false}
            />
          )}
          {day.locked ? (
            <p className="admin-geo-hint">В этот день уже отвечали — панораму не поменять.</p>
          ) : (
            <>
              {isToday && <p className="admin-day-warn">Сегодняшнюю панораму игроки, возможно, уже видели. Меняй, только если с ней что-то не так.</p>}
              {day.panoramaId !== null && (
                <button className="btn-secondary" disabled={setDay.isPending} onClick={() => put(null)}>
                  Убрать с этого дня
                </button>
              )}
              {setDay.isError && <div className="move-error">{planErrorText(setDay.error)}</div>}
              <div className="admin-day-pick-title">{day.panoramaId ? 'Заменить на' : 'Поставить на этот день'}</div>
              {choices.length === 0 ? (
                <p className="admin-geo-hint">Одобренных панорам пока нет — сначала одобри их во вкладке «Проверка».</p>
              ) : (
                <div className="admin-day-grid">
                  {choices.map((p) => {
                    const current = p.id === day.panoramaId
                    return (
                      <button key={p.id} className={`admin-day-choice${current ? ' on' : ''}`} disabled={current || setDay.isPending} onClick={() => put(p.id)}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a storage preview */}
                        <img src={geoImageUrl(p.image, 'small')} alt="" loading="lazy" decoding="async" />
                        <span className="admin-day-choice-sector">{p.territoryId}</span>
                        {(current || p.nextDay || p.shown > 0) && (
                          <span className="admin-day-choice-note">
                            {current ? 'стоит сейчас' : p.nextDay ? `на ${formatDay(p.nextDay, { day: 'numeric', month: 'short' })}` : `была ${p.shown}×`}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
