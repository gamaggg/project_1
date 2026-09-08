'use client'

import { useAdminDeleteTerritory } from '@/lib/supabase/queries'

// Rendered by FishZoneApp itself, not nested inside TerritoryScreen's
// scrolling .screen-inner — same reason as DeleteCatchModal/EditProfileModal,
// see DECISIONS.md. Deleting a territory cascades to its catches, activity
// log entries and any open reports on it (see admin_delete_territory).
export function DeleteTerritoryModal({
  territoryId,
  onClose,
  onDeleted,
}: {
  territoryId: string
  onClose: () => void
  onDeleted: () => void
}) {
  const deleteTerritory = useAdminDeleteTerritory()

  async function handleConfirm() {
    await deleteTerritory.mutateAsync(territoryId)
    onClose()
    onDeleted()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon" style={{ background: 'linear-gradient(160deg,#FF6B6B,#D33 65%)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
          </svg>
        </div>
        <div className="modal-title">Удалить сектор {territoryId}?</div>
        <div className="modal-body">
          Сектор, все его уловы и история будут удалены без возможности восстановления.
        </div>
        <button className="btn-danger" disabled={deleteTerritory.isPending} onClick={handleConfirm}>
          {deleteTerritory.isPending ? 'Удаляем…' : 'Удалить сектор'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
