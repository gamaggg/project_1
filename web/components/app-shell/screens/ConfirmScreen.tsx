'use client'

import { HexLoader } from '@/components/app-shell/HexLoader'
import { useEffect, useRef, useState } from 'react'
import { useSpecies, useLastCatchChoices } from '@/lib/supabase/queries'
import { CATEGORIES_BY_CITY, KIND_LABEL, METHODS, BAITS_BY_CITY } from '@/lib/data/species'
import { matchFishialSpecies } from '@/lib/data/fishSpeciesMatch'
import { cityForSectorId } from '@/lib/data/city'
import { formatWeightGrams } from '@/lib/format'
import { HexBadge } from '@/components/app-shell/HexBadge'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useDoubleCoinsUntil } from '@/components/app-shell/DoubleCoinsChip'
import { StoryButton } from '@/components/app-shell/StoryButton'
import { BaitPicker, MethodPicker, SpeciesPicker } from '@/components/app-shell/SpeciesPicker'
import { DefenseShields } from '@/components/app-shell/SectorDefense'
import { useT } from '@/lib/i18n'
import type { PendingCatch, Territory } from '@/lib/data/types'
import { tn } from '@/lib/i18n'

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
  attackDefense = null,
  captureNoCoins = false,
  step,
  pending,
  capturedPhoto,
  photoStatus,
  onRetryUpload,
  onGiveUpUpload,
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
  // «Защита сектора»: the sector's defense after this catch wore it down
  // (an attack, not a capture), or null.
  attackDefense?: number | null
  // Took the sector, but its +25 was already paid today (once a day).
  captureNoCoins?: boolean
  step: 'form' | 'success'
  pending: boolean
  capturedPhoto: Blob
  photoStatus: PhotoStatus
  onRetryUpload: () => void
  // The photo is taking too long and the person chose not to wait: save the catch
  // without it going out now (the offline queue sends it later).
  onGiveUpUpload: () => void
  onSubmit: (form: CatchFormData) => void
  onFinish: () => void
  onBack: () => void
  onShare: () => void
}) {
  const t = useT()
  // the coins below are already doubled — say so, players couldn't tell
  const doubled = useDoubleCoinsUntil() !== null
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
  const [methodFromLast, setMethodFromLast] = useState(false)
  const [bait, setBait] = useState('')
  const [baitFromLast, setBaitFromLast] = useState(false)
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
    if (lastMethod && !method) {
      setMethod(lastMethod)
      setMethodFromLast(true)
    }
    if (lastBait && !bait) {
      setBait(lastBait)
      setBaitFromLast(true)
    }
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
      pendingCatch?.lengthCm ? `${pendingCatch.lengthCm} ${tn('fmt.cm')}` : null,
      pendingCatch?.weightKg ? `${formatWeightGrams(pendingCatch.weightKg)} ${tn('fmt.g')}` : null,
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
              {previewUrl && <img src={previewUrl} alt={caughtSpeciesName ?? tn('catch.title')} className="catch-trophy-photo" />}
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
        <div className="catch-trophy-title">
          {attackDefense !== null ? t('defense.attackTitle') : wasFree ? tn('catch.newTerritory') : tn('catch.saved')}
        </div>
        {attackDefense !== null && (
          <div className="catch-trophy-attack">
            <DefenseShields value={attackDefense} size={18} />
            <span>{attackDefense > 0 ? t('defense.attackAfter', { value: attackDefense, count: attackDefense + 1 }) : t('defense.attackOpened')}</span>
          </div>
        )}
        {captureNoCoins && <div className="catch-trophy-support">{t('defense.captureOncePerDay')}</div>}
        {clanSupport && (
          <div className="catch-trophy-support">
            {clanShare
              ? tn('catch.clanShare')
              : tn('catch.clanSupport')}
          </div>
        )}
        {(speciesCoins > 0 || captureCoins > 0) && (
          <div data-tour="catch-reward" className="catch-trophy-reward">
            {doubled && <div className="catch-trophy-double">{tn('catch.doubleCoins')}</div>}
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
                <span>{tn('catch.claimReward')}</span>
                <span className="catch-trophy-reward-amount">
                  +{captureCoins} <CoinIcon size={16} />
                </span>
              </div>
            )}
          </div>
        )}
        <div className="catch-trophy-ctas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary" onClick={onShare}>
            {tn('catch.shareCatch')}
          </button>
          {savedCatchId && onToast && (
            <StoryButton big catchId={savedCatchId} caption={[caughtSpeciesName ?? pendingCatch?.species, meta.split(' · ').slice(0, -1).join(' · ')].filter(Boolean).join(' ')} onToast={onToast} />
          )}
          <button className="btn-secondary" onClick={onFinish}>
            {tn('common.done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{tn('catch.newCatch')}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <form onSubmit={handleSubmit}>
          <div className="confirm-photo">
            {previewUrl && <img src={previewUrl} alt={tn('catch.title')} className="confirm-photo-img" />}
            {/* Back to the camera for another shot — the same as the back arrow, said out loud. */}
            {!pending && (
              <button type="button" className="confirm-photo-retake tap-scale" onClick={onBack}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.5-2h6.4l1.5 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" />
                  <circle cx="12" cy="13" r="3.6" />
                </svg>
                {tn('catch.retake')}
              </button>
            )}
            {photoStatus === 'uploading' && <UploadingStatus onGiveUp={onGiveUpUpload} />}
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
                  {tn('catch.retry')}
                </button>
              </div>
            )}
            {photoStatus === 'error' && !offlineMode && (
              <div className="confirm-photo-status">
                <div className="msg">{tn('catch.uploadFailed')}</div>
                <button type="button" className="confirm-photo-retry tap-scale" onClick={onRetryUpload}>
                  {tn('catch.retry')}
                </button>
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>
            {tn('catch.territoryKind', { id: territory.id, kind: KIND_LABEL[territory.kind] })}
          </div>

          <div className="auth-field" style={{ marginTop: 18 }}>
            <label htmlFor="species">
              {tn('catch.species')}
              {speciesGuessed && <span className="species-guess-badge">{tn('catch.guessed')}</span>}
              {speciesFromLast && <span className="species-guess-badge">{tn('catch.fromLast')}</span>}
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
              <label htmlFor="length">{tn('catch.lengthCm')}</label>
              <input id="length" type="number" min={1} max={300} inputMode="numeric" placeholder={tn('catch.optionalLower')} value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
            </div>
            <div className="auth-field" style={{ flex: 1 }}>
              <label htmlFor="weight">{tn('catch.weightG')}</label>
              <input id="weight" type="number" min={10} max={9999} step={10} inputMode="numeric" placeholder={tn('catch.optionalLower')} value={weightG} onChange={(e) => setWeightG(e.target.value)} />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="method">
              {tn('catch.method')}
              {methodFromLast && <span className="species-guess-badge">{tn('catch.fromLast')}</span>}
            </label>
            <MethodPicker
              methods={METHODS}
              value={method}
              frequent={(lastChoices?.frequentMethods ?? []).filter((m) => METHODS.includes(m))}
              onChange={(m) => {
                setMethodFromLast(false)
                setMethod(m)
              }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="bait">
              {tn('catch.bait')}
              {baitFromLast && <span className="species-guess-badge">{tn('catch.fromLast')}</span>}
            </label>
            <BaitPicker
              baits={baits}
              value={bait}
              frequent={(lastChoices?.frequentBaits ?? []).filter((b) => baits.includes(b))}
              onChange={(b) => {
                setBaitFromLast(false)
                setBait(b)
              }}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <button className="btn-primary" type="submit" disabled={!speciesKey || (photoStatus !== 'success' && !offlineMode) || pending}>
              {pending ? tn('common.saving') : offlineMode ? t('offline.saveOffline') : tn('catch.confirm')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// What the photo's overlay says while it uploads: «Загружаем фото…», and when it
// drags on — a word about the connection after 8 seconds, and after 25 a way out:
// save the catch offline instead of waiting (it goes out by itself later).
function UploadingStatus({ onGiveUp }: { onGiveUp: () => void }) {
  const [waited, setWaited] = useState(0)
  useEffect(() => {
    const slow = window.setTimeout(() => setWaited(1), 8000)
    const long = window.setTimeout(() => setWaited(2), 25000)
    return () => {
      clearTimeout(slow)
      clearTimeout(long)
    }
  }, [])
  return (
    <div className="confirm-photo-status">
      <HexLoader size={0.6} />
      <div className="msg">{waited > 0 ? tn('catch.uploadingSlow') : tn('catch.uploading')}</div>
      {waited > 1 && (
        <button type="button" className="confirm-photo-retry tap-scale" onClick={onGiveUp}>
          {tn('catch.saveWithoutNet')}
        </button>
      )}
    </div>
  )
}
