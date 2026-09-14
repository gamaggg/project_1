'use client'

import { useState } from 'react'
import { useAdminSetPublicId } from '@/lib/supabase/queries'

// Rendered by FishZoneApp itself, same reasoning as DeleteUserModal — super
// admin only, admin_set_public_id also re-checks server-side and rejects a
// taken id with a friendly message shown below the input.
export function ChangeUserIdModal({
  userId,
  currentPublicId,
  onClose,
}: {
  userId: string
  currentPublicId: string
  onClose: () => void
}) {
  const [publicId, setPublicId] = useState(currentPublicId)
  const setPublicIdMutation = useAdminSetPublicId()
  const valid = /^\d{5}$/.test(publicId)

  async function handleConfirm() {
    if (!valid) return
    await setPublicIdMutation.mutateAsync({ userId, publicId })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={setPublicIdMutation.isPending ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Изменить ID</div>
        <div className="auth-field" style={{ marginTop: 8 }}>
          <label htmlFor="edit-public-id">Новый ID (5 цифр)</label>
          <input
            id="edit-public-id"
            value={publicId}
            onChange={(e) => setPublicId(e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            maxLength={5}
          />
        </div>
        {setPublicIdMutation.isError && (
          <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
            {setPublicIdMutation.error instanceof Error ? setPublicIdMutation.error.message : 'Не удалось сохранить'}
          </div>
        )}
        <button className="btn-primary" style={{ marginTop: 14 }} disabled={!valid || setPublicIdMutation.isPending} onClick={handleConfirm}>
          {setPublicIdMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} disabled={setPublicIdMutation.isPending} onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
