'use client'

import { useEffect, useState } from 'react'
import { useSpecies } from '@/lib/supabase/queries'
import { CATEGORY_LABEL, KIND_LABEL, METHODS, BAITS, categoryForKind, type SpeciesCategory } from '@/lib/data/species'
import { formatWeight } from '@/lib/format'
import { HexBadge } from '@/components/app-shell/HexBadge'
import type { PendingCatch, Territory } from '@/lib/data/types'

export type CatchFormData = {
  species: string
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
}

export type PhotoStatus = 'uploading' | 'success' | 'error'

export function ConfirmScreen({
  territory,
  pendingCatch,
  wasFree,
  step,
  pending,
  capturedPhoto,
  photoStatus,
  onRetryUpload,
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
  capturedPhoto: Blob
  photoStatus: PhotoStatus
  onRetryUpload: () => void
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(capturedPhoto)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [capturedPhoto])

  const speciesOptions = species.filter((s) => s.category === category)
  const caughtSpeciesName = pendingCatch ? species.find((s) => s.key === pendingCatch.species)?.name : undefined

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!speciesKey || photoStatus !== 'success') return
    onSubmit({
      species: speciesKey,
      lengthCm: lengthCm.trim() ? Number(lengthCm) : null,
      weightKg: weightKg.trim() ? Number(weightKg) : null,
      method: method || null,
      bait: bait || null,
    })
  }

  if (step === 'success') {
    const meta = [
      pendingCatch?.lengthCm ? `${pendingCatch.lengthCm} см` : null,
      pendingCatch?.weightKg ? `${formatWeight(pendingCatch.weightKg)} кг` : null,
      territory.id,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <div className="catch-trophy-scene">
        <div className="catch-trophy-glow" />
        <div className="catch-trophy-stage">
          <div className="catch-trophy-card">
            <div className="catch-trophy-face">
              {previewUrl && <img src={previewUrl} alt={caughtSpeciesName ?? 'Улов'} className="catch-trophy-photo" />}
              <div className="catch-trophy-shine" />
              <div className="catch-trophy-stats">
                <div className="catch-trophy-species">{caughtSpeciesName ?? pendingCatch?.species}</div>
                <div className="catch-trophy-meta">{meta}</div>
              </div>
            </div>
            <div className="catch-trophy-stamp">
              <div className="catch-trophy-stamp-ring" />
              <HexBadge
                unlocked
                strokeWidth={2.5}
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
        <div className="catch-trophy-title">{wasFree ? 'Теперь это твоя территория' : 'Улов зафиксирован'}</div>
        <div className="catch-trophy-ctas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary" onClick={onShare}>
            Поделиться уловом
          </button>
          <button className="btn-secondary" onClick={onFinish}>
            Готово
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Новый улов</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <form onSubmit={handleSubmit}>
          <div className="confirm-photo">
            {previewUrl && <img src={previewUrl} alt="Улов" className="confirm-photo-img" />}
            {photoStatus === 'uploading' && (
              <div className="confirm-photo-status">
                <div className="spinner" />
                <div className="msg">Загружаем фото…</div>
              </div>
            )}
            {photoStatus === 'error' && (
              <div className="confirm-photo-status">
                <div className="msg">Не удалось загрузить фото. Без фото улов сохранить нельзя.</div>
                <button type="button" className="confirm-photo-retry tap-scale" onClick={onRetryUpload}>
                  Повторить попытку
                </button>
              </div>
            )}
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
            <button className="btn-primary" type="submit" disabled={!speciesKey || photoStatus !== 'success' || pending}>
              {pending ? 'Сохраняем…' : 'Подтвердить улов'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
