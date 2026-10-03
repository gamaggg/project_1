'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAdminEditCatch, useProfile, useSpecies } from '@/lib/supabase/queries'
import { CATEGORY_LABEL, CATEGORIES_BY_CITY, type SpeciesCategory } from '@/lib/data/species'
import { cityForSectorId } from '@/lib/data/city'
import { formatWeightGrams } from '@/lib/format'
import { useKeyboardInset } from '@/lib/useKeyboardInset'
import type { Catch } from '@/lib/data/types'

function editErrorText(error: unknown): string {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)
  if (msg.includes('EDIT:no_changes')) return 'Ничего не изменилось'
  if (msg.includes('EDIT:unknown_species')) return 'Такого вида нет в справочнике'
  if (msg.includes('EDIT:bad_length')) return 'Размер — от 1 до 300 см'
  if (msg.includes('EDIT:bad_weight')) return 'Вес — от 10 до 9999 г'
  if (msg.includes('EDIT:catch_not_found')) return 'Улов не найден — возможно, его уже удалили'
  if (msg.includes('not authorized')) return 'Менять уловы может только супер-админ'
  return 'Не удалось сохранить — попробуй ещё раз'
}

// The form's own limits (ConfirmScreen): whole centimetres 1–300, grams 10–9999.
function parseLength(value: string): number | null | 'bad' {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 300 ? n : 'bad'
}

function parseWeightGrams(value: string): number | null | 'bad' {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 10 && n <= 9999 ? n : 'bad'
}

// Super admin: correct a catch's species, length and weight — the same
// fields as the catch form, prefilled with what the angler entered.
export function EditCatchSheet({ c, onClose }: { c: Catch; onClose: () => void }) {
  const { data: species = [] } = useSpecies()
  const { data: owner } = useProfile(c.userId)
  const edit = useAdminEditCatch()
  const overlayRef = useRef<HTMLDivElement>(null)
  const keyboardInset = useKeyboardInset(overlayRef)

  const categories = CATEGORIES_BY_CITY[cityForSectorId(c.territoryId)]
  const [category, setCategory] = useState<SpeciesCategory | null>(null)
  const [speciesKey, setSpeciesKey] = useState(c.species)
  const [lengthCm, setLengthCm] = useState(c.lengthCm ? String(c.lengthCm) : '')
  const [weightG, setWeightG] = useState(c.weightKg ? String(Math.round(c.weightKg * 1000)) : '')
  const [done, setDone] = useState<string[] | null>(null)

  // The species list loads after the sheet opens; until a chip is tapped,
  // the category follows the catch's own species.
  const shownCategory = category ?? species.find((s) => s.key === c.species)?.category ?? categories[0]
  const options = species.filter((s) => s.category === shownCategory)

  const length = parseLength(lengthCm)
  const weight = parseWeightGrams(weightG)
  const oldWeightG = c.weightKg ? Math.round(c.weightKg * 1000) : null
  const invalid = length === 'bad' || weight === 'bad' || !speciesKey
  const changed = speciesKey !== c.species || length !== (c.lengthCm ?? null) || weight !== oldWeightG

  function submit() {
    if (invalid || !changed) return
    edit.mutate(
      { catchId: c.id, species: speciesKey, lengthCm: length, weightKg: weight === null ? null : weight / 1000 },
      { onSuccess: (changes) => setDone(changes) }
    )
  }

  return createPortal(
    <div ref={overlayRef} className="move-sheet-overlay" onClick={onClose} style={{ paddingBottom: keyboardInset }}>
      <div
        className="move-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Исправить улов"
        style={keyboardInset ? { maxHeight: `calc(92dvh - ${keyboardInset}px)` } : undefined}
      >
        <div className="move-sheet-handle" />
        {done ? (
          <div className="move-done">
            <div className="move-done-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </div>
            <div className="move-done-title">Улов исправлен</div>
            <div className="move-done-sub">
              {done.map((line) => (
                <div key={line}>{line[0].toUpperCase() + line.slice(1)}</div>
              ))}
            </div>
            <button className="btn-primary" style={{ marginTop: 18 }} onClick={onClose}>
              Готово
            </button>
          </div>
        ) : (
          <>
            <div className="move-head">
              <div>
                <div className="move-kicker">Супер-админ · правка улова</div>
                <div className="move-title">
                  {c.speciesName}
                  {owner?.displayName ? ` · ${owner.displayName}` : ''}
                </div>
              </div>
              <button className="icon-btn tap-scale" aria-label="Закрыть" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="move-body">
              <div className="move-note" style={{ marginTop: 0, marginBottom: 14 }}>
                Сейчас: {c.speciesName} · {c.lengthCm ? `${c.lengthCm} см` : 'размер не указан'} ·{' '}
                {c.weightKg ? `${formatWeightGrams(c.weightKg)} г` : 'вес не указан'} · сектор {c.territoryId}
              </div>

              <div className="filter-row">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className={`filter-chip${shownCategory === cat ? ' active' : ''}`}
                    onClick={() => {
                      setCategory(cat)
                      if (species.find((s) => s.key === speciesKey)?.category !== cat) setSpeciesKey('')
                    }}
                  >
                    {CATEGORY_LABEL[cat]}
                  </div>
                ))}
              </div>

              <div className="auth-field">
                <label htmlFor="edit-catch-species">Вид рыбы</label>
                <select id="edit-catch-species" value={speciesKey} onChange={(e) => setSpeciesKey(e.target.value)}>
                  <option value="" disabled>
                    Выбери вид рыбы
                  </option>
                  {options.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div className="auth-field" style={{ flex: 1 }}>
                  <label htmlFor="edit-catch-length">Размер, см</label>
                  <input id="edit-catch-length" type="number" min={1} max={300} inputMode="numeric" placeholder="не указан" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
                </div>
                <div className="auth-field" style={{ flex: 1 }}>
                  <label htmlFor="edit-catch-weight">Вес, г</label>
                  <input id="edit-catch-weight" type="number" min={10} max={9999} step={10} inputMode="numeric" placeholder="не указан" value={weightG} onChange={(e) => setWeightG(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="move-footer">
              <div className="move-note">
                {length === 'bad'
                  ? 'Размер — целое число от 1 до 300 см.'
                  : weight === 'bad'
                    ? 'Вес — целое число граммов от 10 до 9999.'
                    : 'Пустое поле — «не указан». Монеты за улов не меняются, достижения рыбака пересчитаются.'}
              </div>
              {edit.isError && <div className="move-error">{editErrorText(edit.error)}</div>}
              <button className="btn-primary" disabled={invalid || !changed || edit.isPending} onClick={submit}>
                {edit.isPending ? 'Сохраняем…' : changed ? 'Сохранить' : 'Нет изменений'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
