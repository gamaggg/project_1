'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { nearestTerritory } from '@/lib/geolocation'
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(day.note ?? '')
  const save = useSaveDiaryDay()
  const remove = useDeleteDiaryDay()
  const firstCatch = day.catches[day.catches.length - 1]
  const total = day.catches.length + day.gallery.length
  // The sectors the counted catches went to — named next to their group, not
  // as a separate row above everything.
  const gameSectors = [...new Set(day.catches.map((c) => c.territoryId))]
  // What «Удалить запись» can take away: the day's note / fishing-day mark and
  // its gallery photos. Catches counted in the game stay — they're the game's.
  const deletable = day.hasEntry || day.gallery.length > 0

  function startEditing() {
    setDraft(day.note ?? '')
    setEditing(true)
  }

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
    // A day reads top-down: when and what the weather was, then what counted
    // in the game, then what lives only in the diary (gallery photos), then
    // the note. A fishing day without a catch is a tinted card of its own.
    <section className={`diary-day${total === 0 ? ' trip' : ''}`}>
      <div className="diary-day-head">
        <span className="diary-day-date">{label}</span>
        {total === 0 ? <span className="diary-day-tag">{t('diary.noCatch')}</span> : <span className="diary-day-count">{t('diary.catchCount', { count: total })}</span>}
        {!editing && (
          <DiaryMenu
            label={t('diary.actions')}
            items={[
              { label: day.note ? t('diary.editNote') : t('diary.addNote'), onClick: startEditing },
              ...(deletable ? [{ label: t('diary.deleteEntry'), danger: true, onClick: () => setConfirmingDelete(true) }] : []),
            ]}
          />
        )}
      </div>
      {firstCatch && <CatchConditions catchId={firstCatch.id} caughtAt={firstCatch.caughtAt} territoryId={firstCatch.territoryId} compact />}
      {day.catches.length > 0 && (
        <div className="diary-group">
          <div className="diary-group-head">
            <i className="diary-group-dot" aria-hidden />
            {t('diary.inGame')}
            {gameSectors.map((p) => (
              <span key={p} className="diary-sector">
                {p}
              </span>
            ))}
          </div>
          <div className="diary-day-catches">
            {day.catches.map((c) => (
              <button key={`c${c.id}`} className="diary-thumb tap-scale" onClick={() => onOpenPhoto(c.id)} aria-label={c.speciesName}>
                {/* eslint-disable-next-line @next/next/no-img-element -- catch thumbnail */}
                <img src={thumbUrl(c.photoUrl, 200)} alt="" loading="lazy" decoding="async" />
                <span>{c.speciesName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {day.gallery.length > 0 && (
        <div className="diary-group">
          <div className="diary-group-head">{t('diary.diaryOnly')}</div>
          <div className="diary-day-catches">
            {day.gallery.map((g) => (
              <button key={`g${g.id}`} className="diary-thumb private tap-scale" onClick={() => onOpenGallery(g)} aria-label={nameOf(g.species)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- diary photo thumbnail */}
                <img src={thumbUrl(g.photoUrl, 200)} alt="" loading="lazy" decoding="async" />
                <span>{nameOf(g.species)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {editing ? (
        <div className="diary-note-edit">
          <textarea value={draft} maxLength={1000} rows={3} placeholder={t('diary.notePlaceholder')} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="diary-note-buttons">
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
        <button className="diary-note" data-label={t('diary.noteLabel')} onClick={startEditing}>
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
      {confirmingDelete &&
        createPortal(
          // Asked first: nothing here can be got back. Without game catches
          // the whole card goes; with them, the card stays with just those.
          <div className="modal-overlay" onClick={() => !remove.isPending && setConfirmingDelete(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">{t('diary.deleteEntryTitle')}</div>
              <div className="modal-body">{day.catches.length === 0 ? t('diary.deleteEntryText') : t('diary.deleteEntryKeepsGame')}</div>
              <button
                className="btn-danger"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(day.day, {
                    onSuccess: () => {
                      setConfirmingDelete(false)
                      setEditing(false)
                      setDraft('')
                      onToast(t('diary.entryDeleted'))
                    },
                    onError: () => onToast(t('common.tryAgain')),
                  })
                }
              >
                {remove.isPending ? t('diary.deleting') : t('diary.delete')}
              </button>
              <button className="btn-secondary" style={{ marginTop: 10 }} disabled={remove.isPending} onClick={() => setConfirmingDelete(false)}>
                {t('diary.cancel')}
              </button>
            </div>
          </div>,
          document.body
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

// «Рыбалка без улова»: a date and a note. No place: it's written down later,
// usually at home, so the phone's position says nothing about where the
// fishing was — anything about the spot goes into the note.
// «⋯» in the corner of a day's card: add or edit the note, delete the day's
// entry. Closes on a tap anywhere else or Escape.
function DiaryMenu({ label, items }: { label: string; items: { label: string; danger?: boolean; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="diary-menu" ref={ref}>
      <button className="diary-menu-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <div className="diary-menu-list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              className={it.danger ? 'danger' : undefined}
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TripSheet({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const save = useSaveDiaryDay()
  const [day, setDay] = useState(() => isoDay(new Date()))
  const [note, setNote] = useState('')

  return (
    <Sheet title={t('diary.addTrip')} onClose={onClose}>
      <label className="diary-field">
        <span>{t('diary.date')}</span>
        <input type="date" value={day} max={isoDay(new Date())} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="diary-field">
        <span>{t('diary.addNote')}</span>
        <textarea value={note} maxLength={1000} rows={4} placeholder={t('diary.tripNotePlaceholder')} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button
        className="btn-primary"
        disabled={!day || save.isPending}
        onClick={() =>
          save.mutate(
            { day, note: note.trim() || null, territoryId: null },
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

// «Уловы из галереи»: several photos at once, each its own fish card —
// species, size and when (the photo's own date when it has one, editable
// right in the card); a sector only when the photo carries coordinates, else
// none (no empty «Место» to tap). They land in the diary only — no sector
// capture, no coins, no rating.
const GALLERY_MAX = 10

type GalleryFish = {
  id: string
  blob: Blob
  preview: string
  takenAt: string
  fromPhoto: boolean
  coords: { lat: number; lng: number } | null
  sector: string | null
  species: string
  length: string
  weight: string
}

function GallerySheet({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const { data: species = [] } = useSpecies()
  const { data: territories = [] } = useTerritories()
  const add = useAddDiaryCatch()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fish, setFish] = useState<GalleryFish[]>([])
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const city = profile?.city ?? 'batumi'
  const categories = CATEGORIES_BY_CITY[city]
  const latest = localInputValue(new Date())
  const ready = fish.length > 0 && fish.every((f) => f.species)

  async function onFiles(files: File[]) {
    const room = GALLERY_MAX - fish.length
    if (room <= 0) return
    setReading(true)
    const added: GalleryFish[] = []
    for (const file of files.slice(0, room)) {
      const meta = await readPhotoMeta(file).catch(() => ({ takenAt: null, lat: null, lng: null }))
      const blob = await downscaleToJpeg(file).catch(() => null)
      if (!blob) continue
      const coords = meta.lat != null && meta.lng != null ? { lat: meta.lat, lng: meta.lng } : null
      added.push({
        id: crypto.randomUUID(),
        blob,
        preview: URL.createObjectURL(blob),
        takenAt: localInputValue(meta.takenAt ?? new Date()),
        fromPhoto: !!meta.takenAt,
        coords,
        sector: coords ? (nearestTerritory(coords.lat, coords.lng, territories)?.id ?? null) : null,
        species: '',
        length: '',
        weight: '',
      })
    }
    setReading(false)
    if (files.length > room) onToast(t('diary.photosMax', { max: GALLERY_MAX }))
    else if (added.length < files.length) onToast(t('diary.somePhotosFailed'))
    setFish((prev) => [...prev, ...added])
  }

  const update = (id: string, patch: Partial<GalleryFish>) => setFish((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const remove = (id: string) =>
    setFish((prev) => {
      const gone = prev.find((f) => f.id === id)
      if (gone) URL.revokeObjectURL(gone.preview)
      return prev.filter((f) => f.id !== id)
    })

  // One by one, so a photo that fails doesn't take the others with it: the
  // ones that went in leave the list, the rest stay for another try.
  async function submit() {
    if (!ready || !user) return
    const total = fish.length
    const failed: GalleryFish[] = []
    setProgress({ done: 0, total })
    for (const [i, f] of fish.entries()) {
      try {
        const when = new Date(f.takenAt)
        const photoUrl = await uploadDiaryPhoto(user.id, f.blob)
        await add.mutateAsync({
          day: isoDay(when),
          caughtAt: when.toISOString(),
          species: f.species,
          lengthCm: f.length.trim() ? Math.round(Number(f.length)) : null,
          weightKg: f.weight.trim() ? Number(f.weight) / 1000 : null,
          photoUrl,
          territoryId: f.sector,
          lat: f.coords?.lat ?? null,
          lng: f.coords?.lng ?? null,
        })
        URL.revokeObjectURL(f.preview)
      } catch {
        failed.push(f)
      }
      setProgress({ done: i + 1, total })
    }
    setProgress(null)
    if (failed.length === 0) {
      onToast(t('diary.savedCount', { count: total }))
      onClose()
      return
    }
    setFish(failed)
    onToast(t('diary.savedPartly', { saved: total - failed.length, total }))
  }

  const pick = () => inputRef.current?.click()

  return (
    <Sheet title={t('diary.addGallery')} onClose={onClose}>
      <div className="diary-hint" style={{ margin: 0 }}>
        {t('diary.galleryHint')}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) void onFiles(files)
          e.target.value = ''
        }}
      />
      {fish.length === 0 ? (
        <button className="diary-photo-pick tap-scale" disabled={reading} onClick={pick}>
          <b>{reading ? t('diary.readingPhotos') : t('diary.pickPhoto')}</b>
          <span>{t('diary.pickPhotosHint', { max: GALLERY_MAX })}</span>
        </button>
      ) : (
        <div className="diary-fish-list">
          {fish.map((f) => (
            <div className="diary-fish" key={f.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen photo */}
              <img className="diary-fish-photo" src={f.preview} alt="" />
              <div className="diary-fish-body">
                <select value={f.species} aria-label={t('diary.species')} onChange={(e) => update(f.id, { species: e.target.value })}>
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
                <div className="diary-fish-size">
                  <label className="diary-unit">
                    <input type="number" inputMode="numeric" min={1} max={500} placeholder={t('diary.lengthShort')} value={f.length} onChange={(e) => update(f.id, { length: e.target.value })} />
                    <span>{t('diary.unitCm')}</span>
                  </label>
                  <label className="diary-unit">
                    <input type="number" inputMode="numeric" min={1} placeholder={t('diary.weightShort')} value={f.weight} onChange={(e) => update(f.id, { weight: e.target.value })} />
                    <span>{t('diary.unitG')}</span>
                  </label>
                </div>
                <div className="diary-fish-meta">
                  <input type="datetime-local" aria-label={t('diary.takenAt')} value={f.takenAt} max={latest} onChange={(e) => e.target.value && update(f.id, { takenAt: e.target.value, fromPhoto: false })} />
                  {f.fromPhoto && <em>{t('diary.fromPhoto')}</em>}
                  {f.sector && <span>{t('diary.placeSector', { id: f.sector })}</span>}
                </div>
              </div>
              <button className="diary-fish-remove" aria-label={t('diary.removePhoto')} disabled={!!progress} onClick={() => remove(f.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
          {fish.length < GALLERY_MAX && !progress && (
            <button className="diary-more" disabled={reading} onClick={pick}>
              {reading ? t('diary.readingPhotos') : t('diary.morePhotos')}
            </button>
          )}
        </div>
      )}
      <button className="btn-primary" disabled={!ready || reading || !!progress} onClick={() => void submit()}>
        {progress ? t('diary.savingCount', { done: progress.done, total: progress.total }) : fish.length > 1 ? t('diary.saveCount', { count: fish.length }) : t('diary.save')}
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
