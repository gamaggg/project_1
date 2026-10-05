'use client'

import { useEffect, useRef, useState } from 'react'
import { useSpecies, useLastCatchChoices } from '@/lib/supabase/queries'
import { CATEGORIES_BY_CITY, KIND_LABEL, METHODS, BAITS_BY_CITY } from '@/lib/data/species'
import { matchFishialSpecies } from '@/lib/data/fishSpeciesMatch'
import { cityForSectorId } from '@/lib/data/city'
import { formatWeightGrams } from '@/lib/format'
import { HexBadge } from '@/components/app-shell/HexBadge'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { StoryButton } from '@/components/app-shell/StoryButton'
import { SpeciesPicker } from '@/components/app-shell/SpeciesPicker'
import { useT } from '@/lib/i18n'
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
  savedCatchId,
  onToast,
  offlineMode = false,
  wasFree,
  speciesCoins,
  captureCoins,
  clanSupport,
  clanShare,
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
  // Id of the catch just saved, once known — shows «В историю».
  savedCatchId?: number | null
  // The photo couldn't upload for want of a connection: the catch can still
  // be saved on the phone and sent by itself later.
  offlineMode?: boolean
  onToast?: (msg: string) => void
  wasFree: boolean
  speciesCoins: number
  captureCoins: number
  clanSupport?: boolean
  clanShare?: boolean
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
  const t = useT()
  const city = cityForSectorId(territory.id)
  const categories = CATEGORIES_BY_CITY[city]
  const baits = BAITS_BY_CITY[city]
  const { data: species = [] } = useSpecies()
  // The whole city's fish in one list (see SpeciesPicker).
  const speciesOptions = species.filter((s) => categories.includes(s.category))
  const [speciesKey, setSpeciesKey] = useState('')
  const [speciesGuessed, setSpeciesGuessed] = useState(false)
  const [speciesFromLast, setSpeciesFromLast] = useState(false)
  const [openedAt] = useState(() => Date.now())
  const [lengthCm, setLengthCm] = useState('')
  const [weightG, setWeightG] = useState('')
  const [method, setMethod] = useState('')
  const [bait, setBait] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const touchedSpeciesRef = useRef(false)

  // Opens on whatever method/bait this person used last (see
  // useLastCatchChoices) — most people fish the same way catch after catch —
  // and on the last fish too if that was within the same outing (6 hours):
  // when it bites, it's the same fish again and again. Once only, and never
  // over a choice they already made while this was still loading.
  const { data: lastChoices } = useLastCatchChoices()
  // Adjusted during render (not in an effect) the moment the choices arrive,
  // so the form never paints a frame with empty fields first.
  const [prefilled, setPrefilled] = useState(false)
  if (!prefilled && lastChoices && speciesOptions.length > 0) {
    setPrefilled(true)
    const lastMethod = lastChoices.methods.find((m) => METHODS.includes(m))
    const lastBait = lastChoices.baits.find((b) => baits.includes(b))
    if (lastMethod && !method) setMethod(lastMethod)
    if (lastBait && !bait) setBait(lastBait)
    const last = lastChoices.lastSpecies
    if (
      last &&
      !speciesKey &&
      openedAt - new Date(last.caughtAt).getTime() < 6 * 60 * 60 * 1000 &&
      speciesOptions.some((s) => s.key === last.key)
    ) {
      setSpeciesKey(last.key)
      setSpeciesFromLast(true)
    }
  }

  // The blob URL is an external resource: it's created and revoked by the
  // same effect so React's dev double-mount can't revoke one still on screen.
  useEffect(() => {
    const url = URL.createObjectURL(capturedPhoto)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors an external resource (see above)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [capturedPhoto])

  // Best-effort species suggestion (see recognize-fish/route.ts and
  // fishSpeciesMatch.ts) — never blocks the form, and backs off the moment
  // the angler touches the species field themselves.
  useEffect(() => {
    // Waits for the species list so a fired-too-early call (matching against
    // an empty set) can't burn a credit for nothing — Fishial's free tier is
    // only 100/month for the whole app, shared across every angler.
    if (species.length === 0) return
    let cancelled = false
    fetch('/api/recognize-fish', { method: 'POST', headers: { 'Content-Type': capturedPhoto.type || 'image/jpeg' }, body: capturedPhoto })
      .then((res) => (res.ok ? res.json() : { candidates: [] }))
      .then((data: { candidates: { scientificName: string; confidence: number }[] }) => {
        if (cancelled || touchedSpeciesRef.current) return
        const allKeys = new Set(species.filter((s) => categories.includes(s.category)).map((s) => s.key))
        const matchedKey = matchFishialSpecies(data.candidates ?? [], allKeys)
        if (!matchedKey) return
        setSpeciesKey(matchedKey)
        setSpeciesFromLast(false)
        setSpeciesGuessed(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedPhoto, species.length])

  const caughtSpeciesName = pendingCatch ? species.find((s) => s.key === pendingCatch.species)?.name : undefined

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!speciesKey || (photoStatus !== 'success' && !offlineMode)) return
    onSubmit({
      species: speciesKey,
      lengthCm: lengthCm.trim() ? Number(lengthCm) : null,
      weightKg: weightG.trim() ? Number(weightG) / 1000 : null,
      method: method || null,
      bait: bait || null,
    })
  }

  if (step === 'success') {
    const meta = [
      pendingCatch?.lengthCm ? `${pendingCatch.lengthCm} см` : null,
      pendingCatch?.weightKg ? `${formatWeightGrams(pendingCatch.weightKg)} г` : null,
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
        {clanSupport && (
          <div className="catch-trophy-support">
            {clanShare
              ? 'Ты в доле сектора соклановца — теперь он поделён между вами'
              : 'У сектора уже 4 владельца — улов засчитан как поддержка клана'}
          </div>
        )}
        {(speciesCoins > 0 || captureCoins > 0) && (
          <div className="catch-trophy-reward">
            {speciesCoins > 0 && (
              <div className="catch-trophy-reward-row">
                <span>{caughtSpeciesName ?? pendingCatch?.species}</span>
                <span className="catch-trophy-reward-amount">
                  +{speciesCoins} <CoinIcon size={16} />
                </span>
              </div>
            )}
            {captureCoins > 0 && (
              <div className="catch-trophy-reward-row">
                <span>Захват сектора</span>
                <span className="catch-trophy-reward-amount">
                  +{captureCoins} <CoinIcon size={16} />
                </span>
              </div>
            )}
          </div>
        )}
        <div className="catch-trophy-ctas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary" onClick={onShare}>
            Поделиться уловом
          </button>
          {savedCatchId && onToast && (
            <StoryButton big catchId={savedCatchId} caption={[caughtSpeciesName ?? pendingCatch?.species, meta.split(' · ').slice(0, -1).join(' · ')].filter(Boolean).join(' ')} onToast={onToast} />
          )}
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
        <BackButton onClick={onBack} registerNative={false} />
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
            {photoStatus === 'error' && offlineMode && (
              <div className="confirm-photo-status confirm-photo-offline">
                <div className="confirm-offline-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 8.8a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16.2a5 5 0 0 1 6 0M12 20h.01M3 3l18 18" />
                  </svg>
                  {t('offline.noNetwork')}
                </div>
                <div className="msg">{t('offline.confirmHint')}</div>
                <button type="button" className="confirm-photo-retry tap-scale" onClick={onRetryUpload}>
                  Повторить попытку
                </button>
              </div>
            )}
            {photoStatus === 'error' && !offlineMode && (
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

          <div className="auth-field" style={{ marginTop: 18 }}>
            <label htmlFor="species">
              Вид рыбы
              {speciesGuessed && <span className="species-guess-badge">определено по фото</span>}
              {speciesFromLast && <span className="species-guess-badge">как в прошлый раз</span>}
            </label>
            <SpeciesPicker
              options={speciesOptions}
              value={speciesKey}
              frequent={lastChoices?.frequentSpecies ?? []}
              onChange={(key) => {
                touchedSpeciesRef.current = true
                setSpeciesGuessed(false)
                setSpeciesFromLast(false)
                setSpeciesKey(key)
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="auth-field" style={{ flex: 1 }}>
              <label htmlFor="length">Размер, см</label>
              <input id="length" type="number" min={1} max={300} inputMode="numeric" placeholder="необязательно" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
            </div>
            <div className="auth-field" style={{ flex: 1 }}>
              <label htmlFor="weight">Вес, г</label>
              <input id="weight" type="number" min={10} max={9999} step={10} inputMode="numeric" placeholder="необязательно" value={weightG} onChange={(e) => setWeightG(e.target.value)} />
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
              {baits.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10 }}>
            <button className="btn-primary" type="submit" disabled={!speciesKey || (photoStatus !== 'success' && !offlineMode) || pending}>
              {pending ? 'Сохраняем…' : offlineMode ? t('offline.saveOffline') : 'Подтвердить улов'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
