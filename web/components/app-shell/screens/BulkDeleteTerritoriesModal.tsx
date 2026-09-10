'use client'

import { useState } from 'react'
import { useAdminDeleteTerritory } from '@/lib/supabase/queries'
import { pluralSectors } from '@/lib/format'

// Rendered by FishZoneApp itself, same reasoning as DeleteTerritoryModal —
// loops the same admin_delete_territory RPC per sector rather than a new
// batch endpoint: each call is already its own transaction and gets its own
// admin_actions log entry, which is the more useful audit trail anyway for
// "which sectors, deleted when" versus one vague batch entry.
export function BulkDeleteTerritoriesModal({
  territoryIds,
  onClose,
  onDeleted,
}: {
  territoryIds: string[]
  onClose: () => void
  onDeleted: () => void
}) {
  const deleteTerritory = useAdminDeleteTerritory()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsPending(true)
    setError(null)
    try {
      for (const id of territoryIds) {
        await deleteTerritory.mutateAsync(id)
      }
      onClose()
      onDeleted()
    } catch (err) {
      // A batch can fail partway through — surfaced here rather than
      // swallowed, so a retry after a genuine error isn't just a silent
      // no-op (see DECISIONS.md).
      setError(err instanceof Error ? err.message : 'Не удалось удалить сектор')
      setIsPending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={isPending ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon" style={{ background: 'linear-gradient(160deg,#FF6B6B,#D33 65%)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
          </svg>
        </div>
        <div className="modal-title">Удалить {territoryIds.length} {pluralSectors(territoryIds.length)}?</div>
        <div className="modal-body">
          {territoryIds.join(', ')}
          <br />
          Сектора, все их уловы и история будут удалены без возможности восстановления.
        </div>
        {error && <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
        <button className="btn-danger" disabled={isPending} onClick={handleConfirm}>
          {isPending ? 'Удаляем…' : `Удалить ${territoryIds.length === 1 ? 'сектор' : 'сектора'}`}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} disabled={isPending} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
