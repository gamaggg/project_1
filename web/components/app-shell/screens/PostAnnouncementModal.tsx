'use client'

import { useState } from 'react'
import { useAdminPostAnnouncement } from '@/lib/supabase/queries'
import { uploadAnnouncementPhoto } from '@/lib/supabase/storage'

const MAX_LENGTH = 2000
const MAX_PHOTO_BYTES = 8 * 1024 * 1024

// Rendered by FishZoneApp itself, same reasoning as every other app-shell
// modal (see DECISIONS.md). Super admin only — admin_post_announcement
// re-checks server-side too. Posts straight into every user's activity feed
// (see useActivity/ActivityScreen), with plain http(s) links auto-linkified
// there, so no special syntax is needed here beyond pasting a real URL.
export function PostAnnouncementModal({ onClose }: { onClose: () => void }) {
  const [body, setBody] = useState('')
  const [buttonLabel, setButtonLabel] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [broadcastTelegram, setBroadcastTelegram] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoStatus, setPhotoStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const postAnnouncement = useAdminPostAnnouncement()
  const trimmed = body.trim()
  const trimmedLabel = buttonLabel.trim()
  const trimmedUrl = buttonUrl.trim()
  // Button is optional, but if either half is filled the other is required —
  // matches admin_post_announcement's own check, checked here too so the bad
  // combo never reaches the network round trip.
  const buttonHalfFilled = !!trimmedLabel !== !!trimmedUrl
  const valid = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !buttonHalfFilled && photoStatus !== 'uploading'

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoStatus('error')
      return
    }
    setPhotoStatus('uploading')
    try {
      const url = await uploadAnnouncementPhoto(file)
      setPhotoUrl(url)
      setPhotoStatus('idle')
    } catch {
      setPhotoStatus('error')
    }
  }

  async function handlePost() {
    if (!valid) return
    await postAnnouncement.mutateAsync({
      body: trimmed,
      buttonLabel: trimmedLabel || undefined,
      buttonUrl: trimmedUrl || undefined,
      broadcastTelegram,
      photoUrl: photoUrl || undefined,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={postAnnouncement.isPending ? undefined : onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          Новый пост
        </div>
        <div className="modal-body" style={{ textAlign: 'center', margin: '4px 0 16px' }}>
          Увидят все пользователи в ленте "Активность". Ссылки (http/https) станут кликабельными автоматически.
        </div>
        <div className="auth-field">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={6}
            placeholder="Что нового в RANGE?"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
            autoFocus
          />
        </div>
        <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--ink-faint)', marginTop: -8, marginBottom: 8 }}>
          {trimmed.length}/{MAX_LENGTH}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="auth-field" style={{ flex: 1 }}>
            <label htmlFor="announcement-btn-label">Кнопка (необязательно)</label>
            <input id="announcement-btn-label" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} maxLength={30} placeholder="Подробнее" />
          </div>
          <div className="auth-field" style={{ flex: 1 }}>
            <label htmlFor="announcement-btn-url">Ссылка</label>
            <input id="announcement-btn-url" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          </div>
        </div>
        {buttonHalfFilled && (
          <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: -8, marginBottom: 8 }}>
            Заполни и текст кнопки, и ссылку
          </div>
        )}

        <div className="perm-switch-row" style={{ marginTop: 4 }}>
          <div className="perm-switch-label">Отправить также в Telegram-бот</div>
          <button
            type="button"
            className={`perm-switch${broadcastTelegram ? ' on' : ''}`}
            aria-label="Отправить также в Telegram-бот"
            aria-pressed={broadcastTelegram}
            onClick={() => setBroadcastTelegram((v) => !v)}
          />
        </div>

        {broadcastTelegram && (
          <div style={{ marginTop: 4, marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>
              Уйдёт сообщением каждому, кто хоть раз запускал бота. Фото — необязательно, но в Telegram оно смотрится
              заметно живее, чем просто текст.
            </div>
            {photoUrl ? (
              <div style={{ position: 'relative', width: 120 }}>
                <img src={photoUrl} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12 }} />
                <div
                  className="modal-close tap-scale"
                  style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26 }}
                  onClick={() => setPhotoUrl(null)}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.6" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </div>
              </div>
            ) : (
              <label className="btn-secondary tap-scale" style={{ width: 'auto', display: 'inline-flex', padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>
                {photoStatus === 'uploading' ? 'Загружаем…' : 'Добавить фото'}
                <input type="file" accept="image/*" onChange={handlePhotoPick} style={{ display: 'none' }} disabled={photoStatus === 'uploading'} />
              </label>
            )}
            {photoStatus === 'error' && (
              <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
                Не удалось загрузить фото (максимум 8 МБ), попробуй ещё раз
              </div>
            )}
          </div>
        )}

        {postAnnouncement.isError && (
          <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
            {postAnnouncement.error instanceof Error ? postAnnouncement.error.message : 'Не удалось опубликовать'}
          </div>
        )}
        <button className="btn-primary" onClick={handlePost} disabled={!valid || postAnnouncement.isPending}>
          {postAnnouncement.isPending ? 'Публикуем…' : 'Опубликовать'}
        </button>
      </div>
    </div>
  )
}
