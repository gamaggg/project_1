'use client'

import { useState } from 'react'
import { useReportCatch } from '@/lib/supabase/queries'
import { REPORT_REASONS } from '@/lib/data/reportReasons'

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// .screen-inner — same reason as PhotoLightbox/EditProfileModal, see DECISIONS.md.
export function ReportPhotoModal({
  catchId,
  onClose,
  onSubmitted,
}: {
  catchId: number
  onClose: () => void
  onSubmitted: () => void
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const reportCatch = useReportCatch()

  async function handleSubmit() {
    await reportCatch.mutateAsync({ catchId, reason })
    onClose()
    onSubmitted()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          Пожаловаться на фото
        </div>
        <div className="modal-body" style={{ margin: '8px 0 16px' }}>
          Расскажи, что не так с этим фото — мы проверим сектор.
        </div>

        <div className="auth-field">
          <label htmlFor="report-reason">Причина</label>
          <select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-primary" style={{ marginTop: 6 }} onClick={handleSubmit} disabled={reportCatch.isPending}>
          {reportCatch.isPending ? 'Отправляем…' : 'Отправить жалобу'}
        </button>
      </div>
    </div>
  )
}
