'use client'

import '@/app/partner-points.css'
import { useMemo, useRef, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { PartnerPreview } from '@/components/app-shell/PartnerPreview'
import { PartnerStatsView } from '@/components/app-shell/PartnerStatsView'
import { useAdminPartnerPoints, useDeletePartnerPoint, useSavePartnerPoint } from '@/lib/supabase/queries'
import { uploadAnnouncementPhoto } from '@/lib/supabase/storage'
import { downscaleToJpeg } from '@/lib/exif'
import { getCurrentCoords } from '@/lib/geolocation'
import { openExternal } from '@/lib/openExternal'
import { CITIES, type CityId } from '@/lib/data/city'
import {
  MAX_PARTNER_PHOTOS,
  PARTNER_ICONS,
  cleanSvg,
  isCustomIcon,
  partnerPinHtml,
  presetIconSvg,
  addDays,
  cityMonday,
  cityToday,
  daysBetween,
  normalizeWebsite,
  parseCoords,
  partnerErrorText,
  type PartnerPlan,
  type PartnerPoint,
  type PartnerPointAdmin,
  type PartnerPointInput,
} from '@/lib/data/partnerPoints'

// «Точки партнёров» — the super admin's screen (Профиль → admin tools): every partner point, and the form that adds
// or changes one. What the form saves is what players see on the map (PartnerPointSheet); «Предпросмотр» opens
// that card right over the form. Russian only, like the other admin screens.

const CITY_IDS = Object.keys(CITIES) as CityId[]
const MONTHS = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.']
const MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const dm = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS_FULL[Number(day.slice(5, 7)) - 1]}`
const weekLabel = (monday: string) => {
  const sun = addDays(monday, 6)
  const a = Number(monday.slice(8, 10))
  const b = Number(sun.slice(8, 10))
  const ma = MONTHS[Number(monday.slice(5, 7)) - 1]
  const mb = MONTHS[Number(sun.slice(5, 7)) - 1]
  return ma === mb ? `${a}–${b} ${mb}` : `${a} ${ma} – ${b} ${mb}`
}
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many
}
const daysWord = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`

// A point's local day from a timestamp (city time).
function cityDay(city: CityId, iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CITIES[city].timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

type Form = {
  city: CityId
  plan: PartnerPlan
  name: string
  kind: string
  description: string
  hours: string
  address: string
  coords: string
  phone: string
  website: string
  photos: string[]
  promoCode: string
  promoDiscount: string
  promoTerms: string
  prizeTitle: string
  prizeFrom: string
  prizeWeeks: string[]
  start: string
  days: string
  paused: boolean
  // A ready icon id or the partner's own SVG markup.
  icon: string
}

function emptyForm(): Form {
  return {
    city: 'moscow',
    plan: 'start',
    name: '',
    kind: '',
    description: '',
    hours: '',
    address: '',
    coords: '',
    phone: '',
    website: '',
    photos: [],
    promoCode: '',
    promoDiscount: '',
    promoTerms: '',
    prizeTitle: '',
    prizeFrom: '',
    prizeWeeks: [],
    start: cityToday('moscow'),
    days: '30',
    paused: false,
    icon: 'shop',
  }
}

function formOf(p: PartnerPointAdmin): Form {
  const start = cityDay(p.city, p.startsAt)
  return {
    city: p.city,
    plan: p.plan,
    name: p.name,
    kind: p.kind ?? '',
    description: p.description ?? '',
    hours: p.hours ?? '',
    address: p.address ?? '',
    coords: `${p.lat}, ${p.lng}`,
    phone: p.phone ?? '',
    website: p.website ?? '',
    photos: p.photos,
    promoCode: p.promoCode ?? '',
    promoDiscount: p.promoDiscount ?? '',
    promoTerms: p.promoTerms ?? '',
    prizeTitle: p.prizeTitle ?? '',
    prizeFrom: p.prizeFrom ?? '',
    prizeWeeks: p.prizeWeeks,
    start,
    days: String(Math.max(1, daysBetween(start, cityDay(p.city, p.endsAt)))),
    paused: p.paused,
    icon: p.icon ?? 'shop',
  }
}

// What the form sends to admin_partner_point_save, or what is wrong with it.
function toInput(f: Form): PartnerPointInput | string {
  const coords = parseCoords(f.coords)
  const days = Number(f.days)
  if (!f.name.trim()) return 'Напиши название'
  if (!coords) return 'Координаты не распознаны. Пример: 55.70870, 37.62270'
  if (!Number.isInteger(days) || days < 1 || days > 366) return 'Срок показа: от 1 до 366 дней'
  if (!f.start) return 'Укажи день начала'
  if (f.plan === 'partner' && f.prizeWeeks.length > 0 && !f.prizeTitle.trim()) return 'Напиши, что за приз недели'
  if (f.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(normalizeWebsite(f.website))) return 'Сайт не похож на адрес, пример: fishing-shop.ru'
  return {
    city: f.city,
    plan: f.plan,
    name: f.name.trim(),
    kind: f.kind,
    description: f.description,
    hours: f.hours,
    address: f.address,
    lat: coords[0],
    lng: coords[1],
    phone: f.phone,
    website: normalizeWebsite(f.website),
    photos: f.photos,
    promo_code: f.promoCode.trim().toUpperCase(),
    promo_discount: f.promoDiscount,
    promo_terms: f.promoTerms,
    prize_title: f.plan === 'partner' ? f.prizeTitle : '',
    prize_from: f.plan === 'partner' ? f.prizeFrom : '',
    prize_weeks: f.plan === 'partner' ? f.prizeWeeks : [],
    start: f.start,
    days,
    paused: f.paused,
    icon: f.icon,
  }
}

// «Включить снова» / «Продлить» in one tap. A point whose days ran out comes back from today for `n` days; a point still
// on the map gets `n` more days on top of its end; `n` null only lifts the pause. Nothing else of the point changes.
function renew(f: Form, n: number | null): Form {
  const today = cityToday(f.city)
  const days = Number(f.days) || 1
  const last = addDays(f.start, days - 1)
  if (n === null) return { ...f, paused: false }
  if (last < today) return { ...f, start: today, days: String(n), paused: false }
  // Longer than 366 days from the old start: count from today instead (the database takes at most 366).
  if (days + n > 366) return { ...f, start: today, days: String(Math.min(366, daysBetween(today, last) + 1 + n)), paused: false }
  return { ...f, days: String(days + n), paused: false }
}

const RENEW_DAYS = [10, 30, 60, 90]

type Status = { key: 'live' | 'soon' | 'paused' | 'over'; text: string }
function statusOf(p: PartnerPointAdmin): Status {
  const now = Date.now()
  const lastDay = cityDay(p.city, new Date(Date.parse(p.endsAt) - 60_000).toISOString())
  if (Date.parse(p.endsAt) <= now) return { key: 'over', text: `Закончилась ${dm(lastDay)}` }
  if (p.paused) return { key: 'paused', text: `На паузе · до ${dm(lastDay)}` }
  if (Date.parse(p.startsAt) > now) return { key: 'soon', text: `Появится ${dm(cityDay(p.city, p.startsAt))}` }
  const left = Math.max(1, daysBetween(cityToday(p.city), cityDay(p.city, p.endsAt)))
  return { key: 'live', text: `На карте · осталось ${daysWord(left)}, до ${dm(lastDay)}` }
}

export function AdminPartnersScreen({ onBack, active }: { onBack: () => void; active: boolean }) {
  const { data: points = [], isLoading, isError } = useAdminPartnerPoints(active)
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null)
  const save = useSavePartnerPoint()
  const [statsFor, setStatsFor] = useState<PartnerPointAdmin | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [note, setNote] = useState<{ id: number; text: string; bad?: boolean } | null>(null)

  const quick = async (p: PartnerPointAdmin, n: number | null) => {
    const v = toInput(renew(formOf(p), n))
    if (typeof v === 'string') {
      setNote({ id: p.id, text: v, bad: true })
      return
    }
    setBusy(p.id)
    setNote(null)
    try {
      await save.mutateAsync({ id: p.id, input: v })
      const last = addDays(v.start, v.days - 1)
      setNote({ id: p.id, text: n === null ? 'Снова на карте' : `Готово: на карте до ${dm(last)} включительно` })
    } catch (e) {
      setNote({ id: p.id, text: partnerErrorText(e), bad: true })
    } finally {
      setBusy(null)
    }
  }

  if (statsFor) {
    return (
      <>
        <div className="header-row">
          <BackButton onClick={() => setStatsFor(null)} registerNative={false} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>Статистика</div>
          <div style={{ width: 36 }} />
        </div>
        <div className="screen-inner">
          <PartnerStatsView pointId={statsFor.id} city={statsFor.city} name={statsFor.name} startsAt={statsFor.startsAt} admin />
        </div>
      </>
    )
  }

  if (editing) {
    return (
      <PartnerEditor
        key={editing.id ?? 'new'}
        id={editing.id}
        initial={editing.form}
        others={points.filter((p) => p.id !== editing.id)}
        onDone={() => setEditing(null)}
      />
    )
  }

  const order: Record<Status['key'], number> = { live: 0, soon: 1, paused: 2, over: 3 }
  const sorted = [...points].sort((a, b) => order[statusOf(a).key] - order[statusOf(b).key])

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Точки партнёров</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="stats-note" style={{ marginTop: 0 }}>
          Магазины и другие места, которые купили тариф на странице для бизнеса. Точка видна всем на карте в свои дни и пропадает сама, когда срок
          кончился. В тарифе «Партнёр» в выбранные недели в рейтинге недели города показывается приз.
        </div>
        <button className="btn-primary" onClick={() => setEditing({ id: null, form: emptyForm() })}>
          Добавить точку
        </button>
        {isLoading && <div className="stats-note">Загружаем…</div>}
        {isError && <div className="stats-note">Не удалось загрузить точки. Если миграция partner-points ещё не применена, так и должно быть.</div>}
        {!isLoading && !isError && points.length === 0 && <div className="stats-note">Точек пока нет.</div>}
        <div className="ppa-list">
          {sorted.map((p) => {
            const st = statusOf(p)
            return (
              <div key={p.id} className={`ppa-card ppa-${st.key}`}>
                <button className="ppa-item" onClick={() => setEditing({ id: p.id, form: formOf(p) })}>
                  <span className="ppa-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.photos[0] ? <img src={p.photos[0]} alt="" loading="lazy" /> : <span>{p.name.slice(0, 1).toUpperCase()}</span>}
                  </span>
                  <span className="ppa-main">
                    <span className="ppa-name">{p.name}</span>
                    <span className="ppa-meta">
                      {CITIES[p.city].name} · {p.plan === 'partner' ? 'Партнёр' : 'Старт'}
                      {p.promoCode ? ` · ${p.promoCode}` : ''}
                    </span>
                    <span className="ppa-status">{st.text}</span>
                    {p.plan === 'partner' && p.prizeWeeks.length > 0 && (
                      <span className="ppa-meta">Приз: {p.prizeWeeks.map(weekLabel).join(', ')}</span>
                    )}
                  </span>
                </button>
                <RenewBar status={st.key} busy={busy === p.id} disabled={busy !== null} onRenew={(n) => quick(p, n)} />
                <div className="ppa-renew">
                  <button type="button" className="ppa-renew-btn ppa-stats-btn" onClick={() => setStatsFor(p)}>
                    Статистика
                  </button>
                </div>
                {note?.id === p.id && <div className={note.bad ? 'ppa-warn ppa-note' : 'ppa-ok ppa-note'}>{note.text}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// The one-tap row under a point: «Включить снова на 10 / 30 / 60 / 90 дней» once its days ran out, «Продлить +10 / +30 /
// +60 / +90» while it is on the map or about to be, «Снять с паузы» while paused.
function RenewBar({ status, busy, disabled, onRenew }: { status: Status['key']; busy: boolean; disabled: boolean; onRenew: (n: number | null) => void }) {
  if (busy) return <div className="ppa-renew"><span className="ppa-renew-label">Сохраняем…</span></div>
  if (status === 'paused')
    return (
      <div className="ppa-renew">
        <button type="button" className="ppa-renew-btn ppa-renew-main" disabled={disabled} onClick={() => onRenew(null)}>
          Снять с паузы
        </button>
      </div>
    )
  const over = status === 'over'
  return (
    <div className="ppa-renew">
      <span className="ppa-renew-label">{over ? 'Включить снова на' : 'Продлить'}</span>
      {RENEW_DAYS.map((n) => (
        <button key={n} type="button" className={`ppa-renew-btn${over ? ' ppa-renew-main' : ''}`} disabled={disabled} onClick={() => onRenew(n)}>
          {over ? `${n} дн.` : `+${n}`}
        </button>
      ))}
    </div>
  )
}

function PartnerEditor({ id, initial, others, onDone }: { id: number | null; initial: Form; others: PartnerPointAdmin[]; onDone: () => void }) {
  const [f, setF] = useState<Form>(initial)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(0)
  const [locating, setLocating] = useState(false)
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const save = useSavePartnerPoint()
  const del = useDeletePartnerPoint()
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))

  const coords = parseCoords(f.coords)
  const days = Number(f.days)
  const daysOk = Number.isInteger(days) && days >= 1 && days <= 366
  const lastDay = daysOk && f.start ? addDays(f.start, days - 1) : null
  const today = cityToday(f.city)

  // The next eight weeks of the city (and the weeks already picked, even past ones), with the weeks other partners
  // of the same city already hold.
  const weeks = useMemo(() => {
    const list = Array.from({ length: 8 }, (_, i) => cityMonday(f.city, i))
    for (const w of f.prizeWeeks) if (!list.includes(w)) list.unshift(w)
    return list.sort()
  }, [f.city, f.prizeWeeks])
  const takenBy = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of others) if (o.city === f.city && o.plan === 'partner') for (const w of o.prizeWeeks) m.set(w, o.name)
    return m
  }, [others, f.city])
  const weeksOutside = lastDay ? f.prizeWeeks.filter((w) => addDays(w, 6) < f.start || w > lastDay) : []

  const input = () => toInput(f)

  const onSave = async () => {
    const v = input()
    if (typeof v === 'string') {
      setError(v)
      return
    }
    setError(null)
    try {
      await save.mutateAsync({ id, input: v })
      onDone()
    } catch (e) {
      setError(partnerErrorText(e))
    }
  }

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_PARTNER_PHOTOS - f.photos.length
    const list = Array.from(files).slice(0, Math.max(0, room))
    setError(null)
    setUploading((n) => n + list.length)
    for (const file of list) {
      try {
        const url = await uploadAnnouncementPhoto(await downscaleToJpeg(file, 1600))
        setF((x) => ({ ...x, photos: [...x.photos, url].slice(0, MAX_PARTNER_PHOTOS) }))
      } catch {
        setError('Одно из фото не загрузилось, попробуй ещё раз')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const onSvg = async (file: File | undefined) => {
    if (!file) return
    const r = cleanSvg(await file.text())
    if ('error' in r) setError(r.error)
    else {
      setError(null)
      set('icon', r.svg)
    }
  }

  const movePhoto = (i: number, to: number) =>
    setF((x) => {
      const p = [...x.photos]
      const [it] = p.splice(i, 1)
      p.splice(to, 0, it)
      return { ...x, photos: p }
    })

  const locate = async () => {
    setLocating(true)
    const c = await getCurrentCoords()
    setLocating(false)
    if (c) set('coords', `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`)
    else setError('Не удалось взять геопозицию')
  }

  const previewPoint: PartnerPoint | null = coords
    ? {
        id: id ?? -1,
        city: f.city,
        plan: f.plan,
        name: f.name.trim() || 'Название точки',
        kind: f.kind.trim() || null,
        description: f.description.trim() || null,
        hours: f.hours.trim() || null,
        address: f.address.trim() || null,
        lat: coords[0],
        lng: coords[1],
        phone: f.phone.trim() || null,
        website: f.website.trim() ? normalizeWebsite(f.website) : null,
        photos: f.photos,
        promoCode: f.promoCode.trim().toUpperCase() || null,
        promoDiscount: f.promoDiscount.trim() || null,
        promoTerms: f.promoTerms.trim() || null,
        prizeTitle: f.plan === 'partner' ? f.prizeTitle.trim() || null : null,
        prizeFrom: f.plan === 'partner' ? f.prizeFrom.trim() || f.name.trim() || null : null,
        // The preview shows the prize block whenever a week is picked, not only in that week.
        prizeWeeks: f.plan === 'partner' && f.prizeWeeks.length ? [cityMonday(f.city)] : [],
        // The card shows the day of (endsAt − 1 min) in the city's time; midday of the last day gives that day anywhere.
        endsAt: lastDay ? `${lastDay}T12:00:00Z` : new Date().toISOString(),
        icon: f.icon,
      }
    : null

  const busy = save.isPending || del.isPending || uploading > 0

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onDone} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{id ? 'Точка партнёра' : 'Новая точка'}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner ppa-form">
        <h3 className="ppa-h">Город и тариф</h3>
        <div className="ppa-chips">
          {CITY_IDS.map((c) => (
            <button
              key={c}
              type="button"
              className={`filter-chip${f.city === c ? ' active' : ''}`}
              onClick={() => setF((x) => ({ ...x, city: c, start: x.start === cityToday(x.city) ? cityToday(c) : x.start, prizeWeeks: c === x.city ? x.prizeWeeks : [] }))}
            >
              {CITIES[c].name}
            </button>
          ))}
        </div>
        <div className="ppa-plans">
          <button type="button" className={`ppa-plan${f.plan === 'start' ? ' on' : ''}`} onClick={() => set('plan', 'start')}>
            <b>Старт</b>
            <span>Точка на карте и промокод</span>
          </button>
          <button type="button" className={`ppa-plan${f.plan === 'partner' ? ' on' : ''}`} onClick={() => set('plan', 'partner')}>
            <b>Партнёр</b>
            <span>Всё из «Старта» плюс приз недели</span>
          </button>
        </div>

        <h3 className="ppa-h">Значок на карте</h3>
        <div className="ppa-icon-row">
          <div className="ppa-pin-preview" aria-label="Так метка выглядит на карте" dangerouslySetInnerHTML={{ __html: partnerPinHtml({ name: f.name.trim() || 'Название', icon: f.icon, promoCode: f.promoCode, promoDiscount: f.promoDiscount }) }} />
          <div className="ppa-icons">
            {PARTNER_ICONS.map((ic) => (
              <button key={ic.id} type="button" className={`ppa-icon${f.icon === ic.id ? ' on' : ''}`} onClick={() => set('icon', ic.id)} title={ic.label}>
                <span dangerouslySetInnerHTML={{ __html: presetIconSvg(ic.id, 20) }} />
                <em>{ic.label}</em>
              </button>
            ))}
            <label className={`ppa-icon${isCustomIcon(f.icon) ? ' on' : ''}`} title="Свой значок (SVG)">
              {isCustomIcon(f.icon) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(f.icon)}`} alt="" />
              ) : (
                <span className="ppa-icon-plus">+</span>
              )}
              <em>SVG</em>
              <input type="file" accept=".svg,image/svg+xml" onChange={(e) => onSvg(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
        <div className="stats-note" style={{ marginTop: 6 }}>
          Свой значок — файл .svg до 20 КБ (логотип или фирменная метка партнёра). На карте он стоит вместо оранжевой метки, нижним краем на точке. Скрипты из файла вырезаются.
        </div>

        <h3 className="ppa-h">Что увидят игроки</h3>
        <div className="auth-field">
          <label htmlFor="pp-name">Название *</label>
          <input id="pp-name" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={60} placeholder="Рыболовный «Клёвое место»" />
        </div>
        <div className="auth-field">
          <label htmlFor="pp-kind">Подпись под названием</label>
          <input id="pp-kind" value={f.kind} onChange={(e) => set('kind', e.target.value)} maxLength={60} placeholder="Магазин снастей и наживки" />
        </div>
        <div className="auth-field">
          <label htmlFor="pp-hours">Часы работы</label>
          <input id="pp-hours" value={f.hours} onChange={(e) => set('hours', e.target.value)} maxLength={80} placeholder="Ежедневно 8:00–21:00" />
        </div>
        <div className="auth-field">
          <label htmlFor="pp-desc">Описание</label>
          <textarea id="pp-desc" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={600} rows={4} placeholder="Что есть в магазине, чем удобен рыбакам" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          <span className="ppa-count">{f.description.length} / 600</span>
        </div>

        <h3 className="ppa-h">Где</h3>
        <div className="auth-field">
          <label htmlFor="pp-coords">Координаты * (широта, долгота или ссылка из Google Карт)</label>
          <input id="pp-coords" value={f.coords} onChange={(e) => set('coords', e.target.value)} placeholder="55.70870, 37.62270" inputMode="text" />
          {f.coords.trim() && !coords && <span className="ppa-warn">Не распознано. Нужны два числа через запятую.</span>}
          {coords && <span className="ppa-ok">Точка: {coords[0].toFixed(6)}, {coords[1].toFixed(6)}</span>}
        </div>
        <div className="ppa-row2">
          <button type="button" className="stats-more" onClick={locate} disabled={locating}>
            {locating ? 'Ищем…' : 'Я сейчас здесь'}
          </button>
          <button
            type="button"
            className="stats-more"
            disabled={!coords}
            onClick={() => coords && openExternal(`https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`)}
          >
            Проверить на карте
          </button>
        </div>
        <div className="auth-field" style={{ marginTop: 14 }}>
          <label htmlFor="pp-address">Адрес (игрок сможет скопировать)</label>
          <input id="pp-address" value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={160} placeholder="Москва, Большая Тульская ул., 2" />
        </div>

        <h3 className="ppa-h">Кнопки</h3>
        <div className="stats-note" style={{ marginTop: 0 }}>«Маршрут» есть всегда (по координатам). «Позвонить» и «Сайт» появятся, если их заполнить.</div>
        <div className="auth-field">
          <label htmlFor="pp-phone">Телефон</label>
          <input id="pp-phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} placeholder="+7 900 000-00-00" inputMode="tel" />
        </div>
        <div className="auth-field">
          <label htmlFor="pp-site">Сайт</label>
          <input id="pp-site" value={f.website} onChange={(e) => set('website', e.target.value)} maxLength={300} placeholder="fishing-shop.ru" inputMode="url" />
        </div>

        <h3 className="ppa-h">Фото</h3>
        <div className="stats-note" style={{ marginTop: 0 }}>
          До {MAX_PARTNER_PHOTOS} штук, первое — главное. Лучше горизонтальные: вход с вывеской, зал, витрина.
        </div>
        <div className="ppa-photos">
          {f.photos.map((src, i) => (
            <div key={src} className="ppa-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              <div className="ppa-photo-bar">
                {i > 0 && (
                  <button type="button" onClick={() => movePhoto(i, 0)} aria-label="Сделать главным">
                    ★
                  </button>
                )}
                <button type="button" onClick={() => setF((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))} aria-label="Убрать фото">
                  ✕
                </button>
              </div>
              {i === 0 && <span className="ppa-photo-main">Главное</span>}
            </div>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up${i}`} className="ppa-photo ppa-photo-up">
              Загрузка…
            </div>
          ))}
          {f.photos.length + uploading < MAX_PARTNER_PHOTOS && (
            <label className="ppa-photo ppa-photo-add">
              + Фото
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => onPhotos(e.target.files)} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <h3 className="ppa-h">Промокод</h3>
        <div className="ppa-row2">
          <div className="auth-field">
            <label htmlFor="pp-code">Код</label>
            <input id="pp-code" value={f.promoCode} onChange={(e) => set('promoCode', e.target.value.toUpperCase())} maxLength={32} placeholder="RANGE10" autoCapitalize="characters" />
          </div>
          <div className="auth-field">
            <label htmlFor="pp-disc">Скидка (значок на метке)</label>
            <input id="pp-disc" value={f.promoDiscount} onChange={(e) => set('promoDiscount', e.target.value)} maxLength={20} placeholder="−10%" />
          </div>
        </div>
        <div className="auth-field">
          <label htmlFor="pp-terms">Условия</label>
          <input id="pp-terms" value={f.promoTerms} onChange={(e) => set('promoTerms', e.target.value)} maxLength={300} placeholder="Скидка 10% на всё, кроме акционных товаров" />
        </div>

        {f.plan === 'partner' && (
          <>
            <h3 className="ppa-h">Приз недели</h3>
            <div className="stats-note" style={{ marginTop: 0 }}>
              Получает лидер рейтинга недели в городе (больше всех секторов за неделю). В отмеченные недели приз видно в рейтинге, на метке
              корона, в карточке блок «Приз недели». В одну неделю в городе может быть только один приз.
            </div>
            <div className="auth-field">
              <label htmlFor="pp-prize">Что за приз</label>
              <input id="pp-prize" value={f.prizeTitle} onChange={(e) => set('prizeTitle', e.target.value)} maxLength={80} placeholder="Набор воблеров" />
            </div>
            <div className="auth-field">
              <label htmlFor="pp-from">От кого (если не заполнить — название точки)</label>
              <input id="pp-from" value={f.prizeFrom} onChange={(e) => set('prizeFrom', e.target.value)} maxLength={60} placeholder={f.name || 'Клёвое место'} />
            </div>
            <label className="ppa-sub">Недели приза</label>
            <div className="ppa-weeks">
              {weeks.map((w) => {
                const on = f.prizeWeeks.includes(w)
                const taken = takenBy.get(w)
                const past = addDays(w, 6) < today
                return (
                  <button
                    key={w}
                    type="button"
                    className={`ppa-week${on ? ' on' : ''}${taken ? ' taken' : ''}`}
                    disabled={(!!taken && !on) || (past && !on)}
                    onClick={() => set('prizeWeeks', on ? f.prizeWeeks.filter((x) => x !== w) : [...f.prizeWeeks, w].sort())}
                  >
                    <b>{weekLabel(w)}</b>
                    <span>{taken ? `занята: ${taken}` : w === cityMonday(f.city) ? 'эта неделя' : past ? 'прошла' : on ? 'выбрана' : 'свободна'}</span>
                  </button>
                )
              })}
            </div>
            {weeksOutside.length > 0 && <span className="ppa-warn">Недели {weeksOutside.map(weekLabel).join(', ')} вне срока показа: в эти дни точки на карте не будет.</span>}
          </>
        )}

        <h3 className="ppa-h">Срок показа</h3>
        <div className="ppa-row2">
          <div className="auth-field">
            <label htmlFor="pp-start">С какого дня</label>
            <input id="pp-start" type="date" value={f.start} onChange={(e) => set('start', e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="pp-days">Сколько дней</label>
            <input id="pp-days" value={f.days} onChange={(e) => set('days', e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="30" />
          </div>
        </div>
        <div className="ppa-chips">
          {[10, 30, 60, 90].map((n) => (
            <button key={n} type="button" className={`filter-chip${days === n ? ' active' : ''}`} onClick={() => set('days', String(n))}>
              {n === 10 ? '10 (пилот)' : n}
            </button>
          ))}
        </div>
        {lastDay ? (
          <span className="ppa-ok">
            На карте с {dm(f.start)} по {dm(lastDay)} включительно, потом пропадёт сама.
            {f.start > today ? ' До начала её не видно.' : ''}
            {addDays(lastDay, 1) <= today ? ' Этот срок уже прошёл: точку не увидят.' : ''}
          </span>
        ) : (
          <span className="ppa-warn">Срок: от 1 до 366 дней</span>
        )}
        {lastDay && addDays(lastDay, 1) <= today && (
          <button type="button" className="stats-more" onClick={() => set('start', today)}>
            Начать заново с сегодня
          </button>
        )}
        {id && (
          <label className="ppa-toggle">
            <input type="checkbox" checked={f.paused} onChange={(e) => set('paused', e.target.checked)} />
            <span>Пауза: убрать с карты, не трогая срок</span>
          </label>
        )}

        {error && <div className="auth-error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="ppa-actions">
          <button type="button" className="btn-secondary" disabled={!previewPoint} onClick={() => setPreview(true)}>
            Предпросмотр: метка и карточка
          </button>
          <button type="button" className="btn-primary" onClick={onSave} disabled={busy}>
            {save.isPending ? 'Сохраняем…' : uploading ? 'Ждём фото…' : id ? 'Сохранить' : 'Добавить на карту'}
          </button>
          {id &&
            (confirmDelete ? (
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                onClick={async () => {
                  try {
                    await del.mutateAsync(id)
                    onDone()
                  } catch (e) {
                    setError(partnerErrorText(e))
                    setConfirmDelete(false)
                  }
                }}
              >
                Точно удалить «{f.name}»? Нажми ещё раз
              </button>
            ) : (
              <button type="button" className="stats-more" onClick={() => setConfirmDelete(true)}>
                Удалить точку
              </button>
            ))}
        </div>
      </div>
      {preview && previewPoint && <PartnerPreview point={previewPoint} onClose={() => setPreview(false)} />}
    </>
  )
}
