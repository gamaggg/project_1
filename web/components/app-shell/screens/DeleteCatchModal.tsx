'use client'

import { useAdminDeleteCatch } from '@/lib/supabase/queries'

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// .screen-inner — same reason as ReportPhotoModal/EditProfileModal, see
// DECISIONS.md. Reuses admin_delete_catch (same RPC as the reports queue),
// so the owner still gets the "moderation" activity-log warning either way.
export function DeleteCatchModal({
  catchId,
  onClose,
  onDeleted,
}: {
  catchId: number
  onClose: () => void
  onDeleted: () => void
}) {
  const deleteCatch = useAdminDeleteCatch()

  async function handleConfirm() {
    await deleteCatch.mutateAsync(catchId)
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
        <div className="modal-title">Удалить улов?</div>
        <div className="modal-body">
          Улов будет удалён без возможности восстановления. Владельцу придёт уведомление в активность.
        </div>
        <button className="btn-danger" disabled={deleteCatch.isPending} onClick={handleConfirm}>
          {deleteCatch.isPending ? 'Удаляем…' : 'Удалить'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
