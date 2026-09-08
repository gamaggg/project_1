'use client'

import { useAdminDeleteUser } from '@/lib/supabase/queries'

// Rendered by FishZoneApp itself, not nested inside UserProfileScreen's
// scrolling .screen-inner — same reason as DeleteCatchModal/DeleteTerritoryModal,
// see DECISIONS.md. Only super admins can delete users (admin_delete_user also
// refuses admin/super-admin targets — demote them first).
export function DeleteUserModal({
  userId,
  userName,
  onClose,
  onDeleted,
}: {
  userId: string
  userName: string
  onClose: () => void
  onDeleted: () => void
}) {
  const deleteUser = useAdminDeleteUser()

  async function handleConfirm() {
    await deleteUser.mutateAsync(userId)
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
        <div className="modal-title">Удалить пользователя {userName}?</div>
        <div className="modal-body">
          Аккаунт, его уловы и территории будут удалены без возможности восстановления.
        </div>
        <button className="btn-danger" disabled={deleteUser.isPending} onClick={handleConfirm}>
          {deleteUser.isPending ? 'Удаляем…' : 'Удалить пользователя'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
