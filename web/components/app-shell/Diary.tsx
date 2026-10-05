'use client'

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CatchConditions } from '@/components/app-shell/CatchConditions'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  useAddDiaryCatch,
  useDeleteDiaryCatch,
  useDeleteDiaryDay,
  useDiary,
  useMyCatches,
  useProfile,
  useSaveDiaryDay,
  useSpecies,
  useTerritories,
  type DiaryCatch,
} from '@/lib/supabase/queries'
import { uploadDiaryPhoto } from '@/lib/supabase/storage'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { CATEGORIES_BY_CITY, CATEGORY_LABEL } from '@/lib/data/species'
import { CITIES, cityForSectorId } from '@/lib/data/city'
import { formatCatchMeta } from '@/lib/format'
import { downscaleToJpeg, readPhotoMeta } from '@/lib/exif'
import { getCurrentCoords, nearestTerritory } from '@/lib/geolocation'
import { useI18n } from '@/lib/i18n'
import type { Catch } from '@/lib/data/types'

// Дневник рыбака: fishing days, newest first. A day gathers the real
// catches made that day (in the sector's city time), gallery catches that
// live only here, and the owner's note — a note on a day without catches is
// a «рыбалка без улова». Everything diary-only is visible to the owner alone.

type Day = {
  day: string
  catches: Catch[]
  gallery: DiaryCatch[]
  note: string | null
  hasEntry: boolean
  places: string[]
}

const isoDay = (d: Date, timeZone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const localInputValue = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function DiaryView({ onOpenPhoto, onToast }: { onOpenPhoto: (catchId: number) => void; onToast: (msg: string) => void }) {
  const { t, lang } = useI18n()
  const { data: myCatches = [] } = useMyCatches()
  const { data: diary } = useDiary(true)
  const { data: species = [] } = useSpecies()
  const [adding, setAdding] = useState<'trip' | 'gallery' | null>(null)
  const [openGallery, setOpenGallery] = useState<DiaryCatch | null>(null)
  const nameOf = (key: string) => species.find((s) => s.key === key)?.name ?? key

  const days = useMemo<Day[]>(() => {
    const byDay = new Map<string, Day>()
    const get = (day: string) => {
      let d = byDay.get(day)
      if (!d) {
        d = { day, catches: [], gallery: [], note: null, hasEntry: false, places: [] }
        byDay.set(day, d)
      }
      return d
    }
    const addPlace = (d: Day, id: string | null) => {
      if (id && !d.places.includes(id)) d.places.push(id)
    }
    for (const c of myCatches) {
      const d = get(isoDay(new Date(c.caughtAt), CITIES[cityForSectorId(c.territoryId)].timezone))
      d.catches.push(c)
      addPlace(d, c.territoryId)
    }
    for (const g of diary?.catches ?? []) {
      const d = get(g.day)
      d.gallery.push(g)
      addPlace(d, g.territoryId)
    }
    for (const e of diary?.days ?? []) {
      const d = get(e.day)
      d.note = e.note
      d.hasEntry = true
      addPlace(d, e.territoryId)
    }
    return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1))
  }, [myCatches, diary])

  const thisYear = new Date().getFullYear()
  const dayFmt = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' })
  const dayFmtYear = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dayLabel = (day: string) => {
    const date = new Date(`${day}T12:00:00`)
    const s = (date.getFullYear() === thisYear ? dayFmt : dayFmtYear).format(date)
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  return (
    <>
      <div className="diary-actions">
        <button className="diary-action tap-scale" onClick={() => setAdding('trip')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('diary.addTrip')}
        </button>
        <button className="diary-action tap-scale" onClick={() => setAdding('gallery')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="M21 16l-5-5L5 20" />
          </svg>
          {t('diary.addGallery')}
        </button>
      </div>
      <div className="diary-hint">{t('diary.privateHint')}</div>

      {days.length === 0 ? (
        <div className="diary-empty">{t('diary.empty')}</div>
      ) : (
        days.map((d) => (
          <DiaryDayCard key={d.day} day={d} label={dayLabel(d.day)} nameOf={nameOf} onOpenPhoto={onOpenPhoto} onOpenGallery={setOpenGallery} onToast={onToast} />
        ))
      )}

      {adding === 'trip' && <TripSheet onClose={() => setAdding(null)} onToast={onToast} />}
      {adding === 'gallery' && <GallerySheet onClose={() => setAdding(null)} onToast={onToast} />}
      {openGallery && <GalleryCatchSheet item={openGallery} name={nameOf(openGallery.species)} onClose={() => setOpenGallery(null)} onToast={onToast} />}
    </>
  )
}

function DiaryDayCard({
  day,
  label,
  nameOf,
  onOpenPhoto,
  onOpenGallery,
  onToast,
}: {
  day: Day
  label: string
  nameOf: (key: string) => string
  onOpenPhoto: (catchId: number) => void
  onOpenGallery: (item: DiaryCatch) => void
  onToast: (msg: string) => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(day.note ?? '')
  const save = useSaveDiaryDay()
  const remove = useDeleteDiaryDay()
  const firstCatch = day.catches[day.catches.length - 1]
  const total = day.catches.length + day.gallery.length

  function submit() {
    const note = draft.trim() || null
    save.mutate(
      { day: day.day, note },
      {
        onSuccess: () => setEditing(false),
        onError: () => onToast(t('common.tryAgain')),
      }
    )
  }

  return (
    <section className="diary-day">
      <div className="diary-day-head">
        <span className="diary-day-date">{label}</span>
        {total === 0 && <span className="diary-day-tag">{t('diary.noCatch')}</span>}
      </div>
      {day.places.length > 0 && (
        <div className="diary-day-places">
          {day.places.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      )}
      {firstCatch && <CatchConditions catchId={firstCatch.id} caughtAt={firstCatch.caughtAt} territoryId={firstCatch.territoryId} compact />}
      {total > 0 && (
        <div className="diary-day-catches">
          {day.catches.map((c) => (
            <button key={`c${c.id}`} className="diary-thumb tap-scale" onClick={() => onOpenPhoto(c.id)} aria-label={c.speciesName}>
              {/* eslint-disable-next-line @next/next/no-img-element -- catch thumbnail */}
              <img src={thumbUrl(c.photoUrl, 200)} alt="" loading="lazy" decoding="async" />
              <span>{c.speciesName}</span>
            </button>
          ))}
          {day.gallery.map((g) => (
            <button key={`g${g.id}`} className="diary-thumb tap-scale" onClick={() => onOpenGallery(g)} aria-label={nameOf(g.species)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- diary photo thumbnail */}
              <img src={thumbUrl(g.photoUrl, 200)} alt="" loading="lazy" decoding="async" />
              <em>{t('diary.fromGallery')}</em>
              <span>{nameOf(g.species)}</span>
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <div className="diary-note-edit">
          <textarea value={draft} maxLength={1000} rows={3} placeholder={t('diary.notePlaceholder')} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="diary-note-buttons">
            {day.hasEntry && (
              <button
                className="diary-link danger"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(day.day, {
                    onSuccess: () => {
                      setEditing(false)
                      setDraft('')
                    },
                  })
                }
              >
                {t('diary.deleteEntry')}
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button className="diary-link" onClick={() => setEditing(false)}>
              {t('diary.cancel')}
            </button>
            <button className="diary-save tap-scale" disabled={save.isPending} onClick={submit}>
              {save.isPending ? t('diary.saving') : t('diary.save')}
            </button>
          </div>
        </div>
      ) : day.note ? (
        <button
          className="diary-note"
          onClick={() => {
            setDraft(day.note ?? '')
            setEditing(true)
          }}
        >
          {day.note}
        </button>
      ) : (
        <button
          className="diary-link"
          onClick={() => {
            setDraft('')
            setEditing(true)
          }}
        >
          {t('diary.addNote')}
        </button>
      )}
    </section>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet diary-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div className="move-title">{title}</div>
        </div>
        <div className="move-body diary-sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

// «Рыбалка без улова»: a date, optionally where, and a note.
function TripSheet({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const save = useSaveDiaryDay()
  const { data: territories = [] } = useTerritories()
  const [day, setDay] = useState(() => isoDay(new Date()))
  const [note, setNote] = useState('')
  const [place, setPlace] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [placeMsg, setPlaceMsg] = useState<string | null>(null)

  async function locate() {
    setLocating(true)
    const coords = await getCurrentCoords()
    setLocating(false)
    const sector = coords ? nearestTerritory(coords.lat, coords.lng, territories) : null
    setPlace(sector?.id ?? null)
    setPlaceMsg(sector ? null : t('diary.placeNotFound'))
  }

  return (
    <Sheet title={t('diary.addTrip')} onClose={onClose}>
      <label className="diary-field">
        <span>{t('diary.date')}</span>
        <input type="date" value={day} max={isoDay(new Date())} onChange={(e) => setDay(e.target.value)} />
      </label>
      <div className="diary-field">
        <span>{t('diary.place')}</span>
        <div className="diary-place">
          <b>{place ? t('diary.placeSector', { id: place }) : (placeMsg ?? t('diary.placeNone'))}</b>
          <button className="diary-link" disabled={locating} onClick={() => void locate()}>
            {t('diary.placeHere')}
          </button>
        </div>
      </div>
      <label className="diary-field">
        <span>{t('diary.addNote')}</span>
        <textarea value={note} maxLength={1000} rows={4} placeholder={t('diary.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button
        className="btn-primary"
        disabled={!day || save.isPending}
        onClick={() =>
          save.mutate(
            { day, note: note.trim() || null, territoryId: place },
            {
              onSuccess: () => {
                onToast(t('diary.saved'))
                onClose()
              },
              onError: () => onToast(t('common.tryAgain')),
            }
          )
        }
      >
        {save.isPending ? t('diary.saving') : t('diary.save')}
      </button>
    </Sheet>
  )
}

// «Улов из галереи»: date and place come from the photo itself when it has
// them; it lands in the diary only — no sector, no coins, no rating.
function GallerySheet({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const { data: species = [] } = useSpecies()
  const { data: territories = [] } = useTerritories()
  const add = useAddDiaryCatch()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null)
  const [takenAt, setTakenAt] = useState(() => localInputValue(new Date()))
  const [fromPhoto, setFromPhoto] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [sector, setSector] = useState<string | null>(null)
  const [speciesKey, setSpeciesKey] = useState('')
  const [length, setLength] = useState('')
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState(false)
  const city = profile?.city ?? 'batumi'
  const categories = CATEGORIES_BY_CITY[city]

  async function onFile(file: File) {
    const meta = await readPhotoMeta(file)
    const blob = await downscaleToJpeg(file).catch(() => null)
    if (!blob) {
      onToast(t('common.tryAgain'))
      return
    }
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { blob, preview: URL.createObjectURL(blob) }
    })
    setFromPhoto(!!meta.takenAt)
    if (meta.takenAt) setTakenAt(localInputValue(meta.takenAt))
    if (meta.lat != null && meta.lng != null) {
      setCoords({ lat: meta.lat, lng: meta.lng })
      setSector(nearestTerritory(meta.lat, meta.lng, territories)?.id ?? null)
    } else {
      setCoords(null)
      setSector(null)
    }
  }

  async function submit() {
    if (!photo || !speciesKey || !user) return
    setBusy(true)
    try {
      const when = new Date(takenAt)
      const photoUrl = await uploadDiaryPhoto(user.id, photo.blob)
      await add.mutateAsync({
        day: isoDay(when),
        caughtAt: when.toISOString(),
        species: speciesKey,
        lengthCm: length.trim() ? Math.round(Number(length)) : null,
        weightKg: weight.trim() ? Number(weight) / 1000 : null,
        photoUrl,
        territoryId: sector,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      onToast(t('diary.saved'))
      onClose()
    } catch {
      onToast(t('common.tryAgain'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('diary.addGallery')} onClose={onClose}>
      <div className="diary-hint" style={{ margin: 0 }}>
        {t('diary.galleryHint')}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
      {photo ? (
        <button className="diary-photo-preview" onClick={() => inputRef.current?.click()}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen photo */}
          <img src={photo.preview} alt="" />
          <span>{t('diary.otherPhoto')}</span>
        </button>
      ) : (
        <button className="diary-photo-pick tap-scale" onClick={() => inputRef.current?.click()}>
          {t('diary.pickPhoto')}
        </button>
      )}
      <label className="diary-field">
        <span>
          {t('diary.takenAt')}
          {fromPhoto && <em> · {t('diary.fromPhoto')}</em>}
        </span>
        <input type="datetime-local" value={takenAt} max={localInputValue(new Date())} onChange={(e) => setTakenAt(e.target.value)} />
      </label>
      <div className="diary-field">
        <span>{t('diary.place')}</span>
        <div className="diary-place">
          <b>{sector ? t('diary.placeSector', { id: sector }) : coords ? t('diary.placeNotFound') : t('diary.placeNone')}</b>
        </div>
      </div>
      <label className="diary-field">
        <span>{t('diary.species')}</span>
        <select value={speciesKey} onChange={(e) => setSpeciesKey(e.target.value)}>
          <option value="">{t('diary.pickSpecies')}</option>
          {categories.map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
              {species
                .filter((s) => s.category === cat)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="diary-field-row">
        <label className="diary-field">
          <span>{t('diary.length')}</span>
          <input type="number" inputMode="numeric" min={1} max={500} value={length} onChange={(e) => setLength(e.target.value)} />
        </label>
        <label className="diary-field">
          <span>{t('diary.weight')}</span>
          <input type="number" inputMode="numeric" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
      </div>
      <button className="btn-primary" disabled={!photo || !speciesKey || busy} onClick={() => void submit()}>
        {busy ? t('diary.saving') : t('diary.save')}
      </button>
    </Sheet>
  )
}

function GalleryCatchSheet({ item, name, onClose, onToast }: { item: DiaryCatch; name: string; onClose: () => void; onToast: (msg: string) => void }) {
  const { t, lang } = useI18n()
  const remove = useDeleteDiaryCatch()
  const meta = formatCatchMeta(item.lengthCm, item.weightKg)
  const when = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(item.caughtAt))
  return (
    <Sheet title={name} onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element -- diary photo */}
      <img className="diary-gallery-photo" src={thumbUrl(item.photoUrl, 960)} alt="" />
      <div className="diary-gallery-meta">{[meta, item.territoryId, when].filter(Boolean).join(' · ')}</div>
      <div className="diary-hint" style={{ margin: 0 }}>
        {t('diary.galleryHint')}
      </div>
      <button
        className="btn-secondary diary-delete"
        disabled={remove.isPending}
        onClick={() =>
          remove.mutate(item.id, {
            onSuccess: () => {
              onToast(t('diary.deleted'))
              onClose()
            },
            onError: () => onToast(t('common.tryAgain')),
          })
        }
      >
        {t('diary.deleteCatch')}
      </button>
    </Sheet>
  )
}
