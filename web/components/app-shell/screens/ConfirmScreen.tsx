'use client'

import { useState } from 'react'
import { useSpecies } from '@/lib/supabase/queries'
import { CATEGORY_GRADIENT, CATEGORY_LABEL, KIND_LABEL, METHODS, BAITS, categoryForKind, type SpeciesCategory } from '@/lib/data/species'
import { formatWeight } from '@/lib/format'
import { FishIcon } from '@/components/app-shell/icons'
import type { PendingCatch, Territory } from '@/lib/data/types'

export type CatchFormData = {
  species: string
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
}

export function ConfirmScreen({
  territory,
  pendingCatch,
  wasFree,
  step,
  pending,
  onSubmit,
  onFinish,
  onBack,
  onShare,
}: {
  territory: Territory
  pendingCatch: PendingCatch | null
  wasFree: boolean
  step: 'form' | 'success'
  pending: boolean
  onSubmit: (form: CatchFormData) => void
  onFinish: () => void
  onBack: () => void
  onShare: () => void
}) {
  const { data: species = [] } = useSpecies()
  const [category, setCategory] = useState<SpeciesCategory>(categoryForKind(territory.kind))
  const [speciesKey, setSpeciesKey] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [method, setMethod] = useState('')
  const [bait, setBait] = useState('')

  const speciesOptions = species.filter((s) => s.category === category)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!speciesKey) return
    onSubmit({
      species: speciesKey,
      lengthCm: lengthCm.trim() ? Number(lengthCm) : null,
      weightKg: weightKg.trim() ? Number(weightKg) : null,
      method: method || null,
      bait: bait || null,
    })
  }

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Новый улов</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {step === 'form' ? (
          <form onSubmit={handleSubmit}>
            <div className="confirm-photo" style={{ background: CATEGORY_GRADIENT[category] }}>
              <FishIcon size={96} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>
              Территория {territory.id} · {KIND_LABEL[territory.kind]}
            </div>

            <div className="filter-row" style={{ marginTop: 18 }}>
              {(['marine', 'freshwater'] as const).map((c) => (
                <div
                  key={c}
                  className={`filter-chip${category === c ? ' active' : ''}`}
                  onClick={() => {
                    setCategory(c)
                    setSpeciesKey('')
                  }}
                >
                  {CATEGORY_LABEL[c]}
                </div>
              ))}
            </div>

            <div className="auth-field">
              <label htmlFor="species">Вид рыбы</label>
              <select id="species" required value={speciesKey} onChange={(e) => setSpeciesKey(e.target.value)}>
                <option value="" disabled>
                  Выбери вид рыбы
                </option>
                {speciesOptions.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div className="auth-field" style={{ flex: 1 }}>
                <label htmlFor="length">Размер, см</label>
                <input id="length" type="number" min={1} max={300} inputMode="numeric" placeholder="необязательно" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
              </div>
              <div className="auth-field" style={{ flex: 1 }}>
                <label htmlFor="weight">Вес, кг</label>
                <input id="weight" type="number" min={0.01} max={100} step={0.01} inputMode="decimal" placeholder="необязательно" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="method">Способ ловли</label>
              <select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="">Не указано</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="bait">Приманка</label>
              <select id="bait" value={bait} onChange={(e) => setBait(e.target.value)}>
                <option value="">Не указано</option>
                {BAITS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <button className="btn-primary" type="submit" disabled={!speciesKey || pending}>
                {pending ? 'Сохраняем…' : 'Подтвердить улов'}
              </button>
            </div>
          </form>
        ) : (
          <div className="success-wrap">
            <div className="success-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div style={{ fontSize: 21, fontWeight: 800 }}>{wasFree ? 'Теперь это твоя территория' : 'Улов зафиксирован'}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 8 }}>
              Территория {territory.id} · {KIND_LABEL[territory.kind]}
              {pendingCatch?.lengthCm || pendingCatch?.weightKg ? (
                <>
                  <br />
                  {[pendingCatch.lengthCm ? `${pendingCatch.lengthCm} см` : null, pendingCatch.weightKg ? `${formatWeight(pendingCatch.weightKg)} кг` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </>
              ) : null}
            </div>
            <div style={{ marginTop: 26, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-primary" onClick={onFinish}>
                Готово
              </button>
              <button className="btn-secondary" onClick={onShare}>
                Поделиться уловом
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
