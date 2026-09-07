'use client'

import { speciesInfo, SPECIES_GRADIENT } from '@/lib/data/species'
import { KIND_LABEL } from '@/lib/data/species'
import { formatWeight } from '@/lib/format'
import { FishIcon } from '@/components/app-shell/icons'
import type { PendingCatch, Territory } from '@/lib/data/types'

export function ConfirmScreen({
  pendingCatch,
  territory,
  wasFree,
  step,
  pending,
  onConfirm,
  onFinish,
  onBack,
  onShare,
}: {
  pendingCatch: PendingCatch
  territory: Territory
  wasFree: boolean
  step: 'review' | 'success'
  pending: boolean
  onConfirm: () => void
  onFinish: () => void
  onBack: () => void
  onShare: () => void
}) {
  const sp = speciesInfo(pendingCatch.species)

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
        {step === 'review' ? (
          <>
            <div className="confirm-photo" style={{ background: SPECIES_GRADIENT[pendingCatch.species] }}>
              <FishIcon size={96} />
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{sp.name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', letterSpacing: 0.2, marginTop: 2 }}>{sp.latin}</div>
            </div>
            <div className="divider" />
            <div className="info-grid">
              <div>
                <div className="label">Размер</div>
                <div className="value">{pendingCatch.lengthCm} см</div>
              </div>
              <div>
                <div className="label">Вес</div>
                <div className="value">{formatWeight(pendingCatch.weightKg)} кг</div>
              </div>
              <div>
                <div className="label">Территория</div>
                <div className="value">
                  {territory.id} · {KIND_LABEL[territory.kind]}
                </div>
              </div>
              <div>
                <div className="label">Способ ловли</div>
                <div className="value">{pendingCatch.method}</div>
              </div>
              <div>
                <div className="label">Приманка</div>
                <div className="value">{pendingCatch.bait}</div>
              </div>
            </div>
            <div style={{ marginTop: 26 }}>
              <button className="btn-primary" onClick={onConfirm} disabled={pending}>
                {pending ? 'Сохраняем…' : 'Подтвердить улов'}
              </button>
            </div>
          </>
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
