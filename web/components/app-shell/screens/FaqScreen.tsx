'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BackButton } from '@/components/app-shell/BackButton'
import { faqFor, type FaqAnswer } from '@/lib/data/faq'
import { useI18n } from '@/lib/i18n'
import { useCreateSupportTicket, useMySupport, type SupportTicket } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'

function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, 'е')
}

function Answer({ a }: { a: FaqAnswer }) {
  return (
    <div className="faq-answer">
      {a.map((block, i) =>
        typeof block === 'string' ? (
          <p key={i}>{block}</p>
        ) : (
          <ul key={i}>
            {block.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}

// «Вопросы и ответы» (lib/data/faq.ts): the game's rules as questions, by
// topic, one open at a time; the search box looks through questions and
// answers alike.
export function FaqScreen({ onBack, onToast }: { onBack: () => void; onToast?: (msg: string) => void }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [writing, setWriting] = useState(false)
  const { data: tickets = [] } = useMySupport()
  const q = norm(query.trim())
  const sections = faqFor(lang)
    .map((s) => ({
      ...s,
      items: q ? s.items.filter((it) => norm(it.q).includes(q) || norm(it.a.flat().join(' ')).includes(q)) : s.items,
    }))
    .filter((s) => s.items.length > 0)

  return (
    <div className="screen-inner">
      <div className="header-row">
        <BackButton onClick={onBack} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{t('faq.title')}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="faq-search">
        <input type="search" placeholder={t('faq.search')} value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
      </div>
      <button className="support-card tap-scale" onClick={() => setWriting(true)}>
        <span className="support-card-icon" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
          </svg>
        </span>
        <span className="support-card-text">
          <b>{t('support.cardTitle')}</b>
          <span>{t('support.cardSub')}</span>
        </span>
      </button>
      {tickets.length > 0 && <MyTickets tickets={tickets} />}
      {writing && <SupportSheet onClose={() => setWriting(false)} onToast={onToast} />}
      {sections.length === 0 && <div className="faq-empty">{t('faq.empty')}</div>}
      {sections.map((s) => (
        <section key={s.title} className="faq-section">
          <h2 className="faq-section-title">{s.title}</h2>
          <div className="faq-list">
            {s.items.map((it) => {
              const id = `${s.title}|${it.q}`
              const isOpen = open === id || !!q
              return (
                <div key={id} className={`faq-item${isOpen ? ' open' : ''}`}>
                  <button className="faq-q" aria-expanded={isOpen} onClick={() => setOpen(open === id ? null : id)}>
                    <span>{it.q}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && <Answer a={it.a} />}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// The player's own requests, newest first: what they wrote, and the answers.
function MyTickets({ tickets }: { tickets: SupportTicket[] }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <section className="faq-section">
      <button className="support-mine-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{t('support.mine', { count: tickets.length })}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>
      {open && (
        <div className="faq-list">
          {tickets.map((tk) => (
            <div key={tk.id} className="support-ticket">
              <div className="support-ticket-head">
                <span>{formatWhen(tk.createdAt)}</span>
                <span className={`support-status${tk.answered ? ' answered' : ''}`}>{tk.answered ? t('support.answered') : t('support.waiting')}</span>
              </div>
              <p className="support-ticket-body">{tk.body}</p>
              {tk.replies.map((r, i) => (
                <div key={i} className="support-reply">
                  <b>{t('support.replyFrom')}</b>
                  <p>{r.body}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const MAX = 1000

// «Написать в поддержку»: the text and, if they like, a screenshot (picked
// from the phone, previewed, removable). Goes to the admins' Telegram; the
// answer comes back to «Активность».
function SupportSheet({ onClose, onToast }: { onClose: () => void; onToast?: (msg: string) => void }) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const create = useCreateSupportTicket()

  // The preview is an external resource: made and revoked by the same effect.
  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors an external resource (see above)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const text = body.trim()
  const errorText = (e: unknown) => {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
    if (msg.includes('SUPPORT:too_fast')) return t('support.tooFast')
    if (msg.includes('SUPPORT:too_many')) return t('support.tooMany')
    return t('common.tryAgain')
  }

  return createPortal(
    <div className="move-sheet-overlay" onClick={create.isPending ? undefined : onClose}>
      <div className="move-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('support.title')}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">{t('support.kicker')}</div>
            <div className="move-title">{t('support.title')}</div>
          </div>
        </div>
        <div className="move-body">
          <p className="support-hint">{t('support.hint')}</p>
          <div className="support-field">
            <textarea
              value={body}
              maxLength={MAX}
              rows={5}
              placeholder={t('support.placeholder')}
              onChange={(e) => setBody(e.target.value)}
            />
            <span className="support-count">
              {body.length}/{MAX}
            </span>
          </div>
          {preview ? (
            <div className="support-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file */}
              <img src={preview} alt="" />
              <button type="button" className="support-photo-remove" aria-label={t('support.removePhoto')} onClick={() => { setPhoto(null); setPreview(null) }}>
                ×
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary support-attach" onClick={() => inputRef.current?.click()}>
              {t('support.attach')}
            </button>
          )}
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
          <button
            className="btn-primary"
            style={{ margin: '14px 0 18px' }}
            disabled={!text || create.isPending}
            onClick={() =>
              create.mutate(
                { body: text, photo },
                {
                  onSuccess: () => {
                    onToast?.(t('support.sent'))
                    onClose()
                  },
                  onError: (e) => onToast?.(errorText(e)),
                }
              )
            }
          >
            {create.isPending ? t('support.sending') : t('support.send')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
