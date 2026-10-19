'use client'

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditMyCatch, useLastCatchChoices, useSpecies } from '@/lib/supabase/queries'
import { BAITS_BY_CITY, METHODS, speciesOfCity } from '@/lib/data/species'
import { cityForSectorId } from '@/lib/data/city'
import { formatWeightGrams } from '@/lib/format'
import { useKeyboardInset } from '@/lib/useKeyboardInset'
import { BaitPicker, MethodPicker, SpeciesPicker } from '@/components/app-shell/SpeciesPicker'
import type { Catch } from '@/lib/data/types'
import { tn } from '@/lib/i18n'

function editErrorText(error: unknown): string {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)
  if (msg.includes('EDIT:no_changes')) return tn('editCatch.noChanges')
  if (msg.includes('EDIT:bad_length')) return tn('editCatch.badLength')
  if (msg.includes('EDIT:bad_weight')) return tn('editCatch.badWeight')
  if (msg.includes('EDIT:bad_text')) return tn('editCatch.badText')
  if (msg.includes('EDIT:not_yours')) return tn('editCatch.notYours')
  if (msg.includes('EDIT:species_once')) return tn('editCatch.speciesOnce')
  if (msg.includes('EDIT:measures_once')) return tn('editCatch.measuresOnce')
  if (msg.includes('EDIT:unknown_species')) return tn('editCatch.unknownSpecies')
  if (msg.includes('EDIT:catch_not_found')) return tn('editCatch.notFound')
  return tn('editCatch.failed')
}

// The catch form's own limits: whole centimetres 1–300, grams 10–9999.
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

// The angler's own correction of a catch later — weighed and measured at
// home, or remembered the bait afterwards. The same optional fields as the
// catch form, filled with what was entered. The species can be changed ONCE,
// and so can the size and weight (together — one change, and filling them in
// for the first time counts as it); the bait and the method as often as needed.
// The coins paid at the catch stay, and the photo and place can't change.
export function EditMyCatchSheet({ c, onClose, onSaved }: { c: Catch; onClose: () => void; onSaved?: () => void }) {
  const edit = useEditMyCatch()
  const { data: lastChoices } = useLastCatchChoices()
  const { data: speciesList = [] } = useSpecies()
  const overlayRef = useRef<HTMLDivElement>(null)
  const keyboardInset = useKeyboardInset(overlayRef)

  const [speciesKey, setSpeciesKey] = useState(c.species)
  const [lengthCm, setLengthCm] = useState(c.lengthCm ? String(c.lengthCm) : '')
  const [weightG, setWeightG] = useState(c.weightKg ? String(Math.round(c.weightKg * 1000)) : '')
  const [method, setMethod] = useState(c.method ?? '')
  const [bait, setBait] = useState(c.bait ?? '')
  const [done, setDone] = useState(false)

  // The city's list — plus whatever this catch already carries, in case the
  // list has changed since.
  const baits = useMemo(() => {
    const list = BAITS_BY_CITY[cityForSectorId(c.territoryId)]
    return c.bait && !list.includes(c.bait) ? [...list, c.bait] : list
  }, [c.territoryId, c.bait])
  const methods = useMemo(() => (c.method && !METHODS.includes(c.method) ? [...METHODS, c.method] : METHODS), [c.method])

  // The whole city's fish, as in the catch form.
  const speciesOptions = useMemo(() => {
    const ofCity = speciesOfCity(speciesList, cityForSectorId(c.territoryId))
    return ofCity.some((s) => s.key === c.species) ? ofCity : [...ofCity, ...speciesList.filter((s) => s.key === c.species)]
  }, [speciesList, c.territoryId, c.species])
  const newSpeciesName = speciesList.find((s) => s.key === speciesKey)?.name
  // The one change of size and weight is used: both are locked.
  const measuresLocked = c.measuresChanged

  const length = parseLength(lengthCm)
  const weight = parseWeightGrams(weightG)
  const oldWeightG = c.weightKg ? Math.round(c.weightKg * 1000) : null
  const invalid = length === 'bad' || weight === 'bad'
  const speciesPicked = speciesKey !== c.species
  const changed = speciesPicked || length !== (c.lengthCm ?? null) || weight !== oldWeightG || (method || null) !== (c.method ?? null) || (bait || null) !== (c.bait ?? null)

  function submit() {
    if (invalid || !changed) return
    edit.mutate(
      { catchId: c.id, lengthCm: length, weightKg: weight === null ? null : weight / 1000, bait: bait || null, method: method || null, species: speciesPicked ? speciesKey : undefined },
      {
        onSuccess: () => {
          setDone(true)
          onSaved?.()
        },
      }
    )
  }

  return createPortal(
    <div ref={overlayRef} className="move-sheet-overlay" onClick={onClose} style={{ paddingBottom: keyboardInset }}>
      <div
        className="move-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={tn('editCatch.aria')}
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
            <div className="move-done-title">{tn('editCatch.saved')}</div>
            <button className="btn-primary" style={{ marginTop: 18 }} onClick={onClose}>
              {tn('common.done')}
            </button>
          </div>
        ) : (
          <>
            <div className="move-head">
              <div>
                <div className="move-kicker">{tn('editCatch.kicker')}</div>
                <div className="move-title">{c.speciesName}</div>
              </div>
              <button className="icon-btn tap-scale" aria-label={tn('common.close')} onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="move-body">
              <div className="move-note" style={{ marginTop: 0, marginBottom: 14 }}>
                {tn('editCatch.intro', { length: c.lengthCm ? `${c.lengthCm} ${tn('fmt.cm')}` : tn('editCatch.lengthNone'), weight: c.weightKg ? `${formatWeightGrams(c.weightKg)} ${tn('fmt.g')}` : tn('editCatch.weightNone') })}
              </div>

              <div className="auth-field">
                <label htmlFor="species">{tn('editCatch.speciesLabel')}</label>
                {c.speciesChanged ? (
                  <input id="species" value={c.speciesName} disabled readOnly />
                ) : (
                  <SpeciesPicker options={speciesOptions} value={speciesKey} frequent={(lastChoices?.frequentSpecies ?? []).filter((k) => speciesOptions.some((s) => s.key === k))} onChange={setSpeciesKey} />
                )}
                <div className="edit-once-note">{c.speciesChanged ? tn('editCatch.speciesUsedNote') : speciesPicked ? tn('editCatch.speciesChosen', { from: c.speciesName, to: newSpeciesName ?? '' }) : tn('editCatch.speciesOnceNote')}</div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div className="auth-field" style={{ flex: 1 }}>
                  <label htmlFor="mine-catch-length">{tn('catch.lengthCm')}</label>
                  <input id="mine-catch-length" type="number" min={1} max={300} inputMode="numeric" placeholder={tn('catch.optionalLower')} value={lengthCm} disabled={measuresLocked} onChange={(e) => setLengthCm(e.target.value)} />
                </div>
                <div className="auth-field" style={{ flex: 1 }}>
                  <label htmlFor="mine-catch-weight">{tn('catch.weightG')}</label>
                  <input id="mine-catch-weight" type="number" min={10} max={9999} step={10} inputMode="numeric" placeholder={tn('catch.optionalLower')} value={weightG} disabled={measuresLocked} onChange={(e) => setWeightG(e.target.value)} />
                </div>
              </div>
              <div className="edit-once-note" style={{ marginTop: -6, marginBottom: 12 }}>{measuresLocked ? tn('editCatch.measuresUsedNote') : tn('editCatch.measuresOnceNote')}</div>

              <div className="auth-field">
                <label htmlFor="method">{tn('catch.method')}</label>
                <MethodPicker methods={methods} value={method} frequent={(lastChoices?.frequentMethods ?? []).filter((m) => methods.includes(m))} onChange={setMethod} />
              </div>
              <div className="auth-field">
                <label htmlFor="bait">{tn('catch.bait')}</label>
                <BaitPicker baits={baits} value={bait} frequent={(lastChoices?.frequentBaits ?? []).filter((b) => baits.includes(b))} onChange={setBait} />
              </div>
            </div>

            <div className="move-footer">
              <div className="move-note">
                {length === 'bad'
                  ? tn('editCatch.lengthHint')
                  : weight === 'bad'
                    ? tn('editCatch.weightHint')
                    : tn('editCatch.footOnce')}
              </div>
              {edit.isError && <div className="move-error">{editErrorText(edit.error)}</div>}
              <button className="btn-primary" disabled={invalid || !changed || edit.isPending} onClick={submit}>
                {edit.isPending ? tn('common.saving') : changed ? tn('common.save') : tn('editCatch.noChangesBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
