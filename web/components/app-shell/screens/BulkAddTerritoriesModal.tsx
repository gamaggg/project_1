'use client'

import { useState } from 'react'
import { useAdminAddTerritory } from '@/lib/supabase/queries'
import { nextSectorId } from '@/lib/data/hexGrid'
import { KIND_LABEL } from '@/lib/data/species'
import type { TerritoryKind } from '@/lib/data/types'
import { CITIES, type CityId } from '@/lib/data/city'

const KINDS: TerritoryKind[] = ['sea', 'river', 'stream', 'lake', 'pond']

// Rendered by FishZoneApp, same reasoning as BulkDeleteTerritoriesModal — one
// admin_add_territory call per drafted sector rather than a batch RPC, each
// with its own admin_actions log entry. Ids are assigned here (not earlier,
// at placement time) so two drafts placed in the same batch can't ever
// collide even if existingIds hasn't refetched between them.
export function BulkAddTerritoriesModal({
  drafts,
  existingIds,
  city,
  onClose,
  onAdded,
}: {
  drafts: { lat: number; lng: number; corners: [number, number][] }[]
  existingIds: string[]
  city: CityId
  onClose: () => void
  onAdded: () => void
}) {
  const addTerritory = useAdminAddTerritory()
  const [kind, setKind] = useState<TerritoryKind>('sea')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ids = drafts.map((_, i) => nextSectorId(existingIds, i + 1, CITIES[city].idPrefix))

  async function handleConfirm() {
    setIsPending(true)
    setError(null)
    try {
      for (let i = 0; i < drafts.length; i++) {
        await addTerritory.mutateAsync({ id: ids[i], kind, lat: drafts[i].lat, lng: drafts[i].lng, corners: drafts[i].corners })
      }
      onClose()
      onAdded()
    } catch (err) {
      // A batch can fail partway through (e.g. a stale id collision) —
      // surfaced here rather than swallowed, since a silent no-op on retry
      // left no way to tell what was wrong (see DECISIONS.md).
      setError(err instanceof Error ? err.message : 'Не удалось создать сектор')
      setIsPending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={isPending ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon" style={{ background: 'linear-gradient(160deg,#66BB6A,#2E7D32 65%)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <div className="modal-title">Создать {drafts.length} {drafts.length === 1 ? 'сектор' : 'сектора'}?</div>
        <div className="modal-body">{ids.join(', ')}</div>
        <div className="filter-row" style={{ margin: '14px 0' }}>
          {KINDS.map((k) => (
            <div key={k} className={`filter-chip${kind === k ? ' active' : ''}`} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </div>
          ))}
        </div>
        {error && <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
        <button className="btn-primary" disabled={isPending} onClick={handleConfirm}>
          {isPending ? 'Создаём…' : `Создать ${drafts.length === 1 ? 'сектор' : 'сектора'}`}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} disabled={isPending} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
