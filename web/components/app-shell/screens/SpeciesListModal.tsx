'use client'

import { CATEGORY_LABEL, CATEGORY_GRADIENT } from '@/lib/data/species'
import type { SpeciesEntry } from '@/lib/format'

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// `.screen-inner` — same clipping reasoning as every other app-shell-level
// modal (see DECISIONS.md). The breakdown is already computed by the caller
// (see speciesBreakdown) from a catches list it already has loaded.
export function SpeciesListModal({
  species,
  onClose,
  onOpenCatch,
}: {
  species: SpeciesEntry[]
  onClose: () => void
  onOpenCatch: (catchId: number) => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" style={{ maxHeight: '72vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          Виды рыб
        </div>
        <div style={{ overflowY: 'auto', flex: 1, marginTop: 14 }}>
          {species.length ? (
            species.map((s) => (
              <button
                key={s.key}
                onClick={() => onOpenCatch(s.lastCatchId)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 3, background: CATEGORY_GRADIENT[s.category], flex: '0 0 auto' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 1 }}>{CATEGORY_LABEL[s.category]}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-faint)', flex: '0 0 auto' }}>×{s.count}</div>
              </button>
            ))
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>Пока нет уловов</div>
          )}
        </div>
      </div>
    </div>
  )
}
