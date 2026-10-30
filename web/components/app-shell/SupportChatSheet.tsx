'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n'
import { useSupportPhotoUrl } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'

const MAX = 1000

// One line of a support chat as the viewer sees it: their own on the right,
// the other side's on the left, with a name over it if given.
export type SupportChatLine = { mine: boolean; label?: string | null; body: string; createdAt: string; photoPath: string | null }

// A support photo from the private bucket: the picture once its signed link
// comes (a tap opens it whole), the «скриншот» mark until then or if it
// can't be read.
function SupportPhoto({ path }: { path: string }) {
  const { t } = useI18n()
  const { data: url } = useSupportPhotoUrl(path)
  if (!url) return <span className="support-msg-photo">{t('support.screenshot')}</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="support-msg-img">
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed link to a private file, not an optimisable asset */}
      <img src={url} alt="" loading="lazy" decoding="async" />
    </a>
  )
}

// One request as a chat: everything said, oldest first, and a box at the
// bottom to add to it — text and, if they like, a photo. Stays scrolled to
// the newest. The player's own chat (FaqScreen) and the support admin's chat
// with a player (AdminSupportChatSheet) both use it; `onSend` does the saving
// and throws on failure, `onSendError` says what went wrong (a toast, or
// `notice` over the box).
export function SupportChatSheet({
  kicker,
  title,
  status,
  headExtra,
  empty,
  notice,
  lines,
  onSend,
  onSendError,
  onClose,
}: {
  kicker: string
  title: string
  status?: { answered: boolean } | null
  headExtra?: ReactNode
  empty?: ReactNode
  notice?: ReactNode
  lines: SupportChatLine[]
  onSend: (body: string, photo: File | null) => Promise<unknown>
  onSendError: (e: unknown) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const count = lines.length

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count])

  const text = body.trim()
  const send = async () => {
    if (!text || pending) return
    setPending(true)
    try {
      await onSend(text, photo)
      setBody('')
      setPhoto(null)
    } catch (e) {
      onSendError(e)
    } finally {
      setPending(false)
    }
  }

  return createPortal(
    <div className="move-sheet-overlay" onClick={pending ? undefined : onClose}>
      <div className="move-sheet support-chat" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">{kicker}</div>
            <div className="move-title">{title}</div>
          </div>
          {headExtra}
          {status && <span className={`support-status${status.answered ? ' answered' : ''}`}>{status.answered ? t('support.answered') : t('support.waiting')}</span>}
        </div>
        <div className="support-thread" ref={threadRef}>
          {lines.length === 0 && empty}
          {lines.map((m, i) => (
            <div key={i} className={`support-msg ${m.mine ? 'me' : 'support'}`}>
              {m.label && <b>{m.label}</b>}
              <p>{m.body}</p>
              {m.photoPath && <SupportPhoto path={m.photoPath} />}
              <time>{formatWhen(m.createdAt)}</time>
            </div>
          ))}
        </div>
        <div className="support-compose">
          {notice && <div className="support-compose-notice">{notice}</div>}
          {photo && (
            <div className="support-compose-photo">
              <span>{t('support.screenshot')}</span>
              <button type="button" aria-label={t('support.removePhoto')} onClick={() => setPhoto(null)}>
                ×
              </button>
            </div>
          )}
          <div className="support-compose-row">
            <button type="button" className="support-compose-attach" aria-label={t('support.attach')} onClick={() => inputRef.current?.click()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="M21 16l-5-5-8 8" />
              </svg>
            </button>
            <textarea
              value={body}
              maxLength={MAX}
              rows={1}
              placeholder={t('support.write')}
              onChange={(e) => setBody(e.target.value)}
            />
            <button type="button" className="support-compose-send" disabled={!text || pending} aria-label={t('support.send')} onClick={send}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              if (f) setPhoto(f)
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
