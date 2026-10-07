'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BackButton } from '@/components/app-shell/BackButton'
import { answerText, faqFor, type FaqAnswer } from '@/lib/data/faq'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useI18n } from '@/lib/i18n'
import { useAddSupportMessage, useCreateSupportTicket, useMySupport, type SupportTicket } from '@/lib/supabase/queries'
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
        ) : Array.isArray(block) ? (
          <ul key={i}>
            {block.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          // The frame sits on a wrapper: WebKit (Telegram on iPhone) clips a
          // rounded, overflow-hidden <table> and its <caption> off at the left.
          <div key={i} className="faq-table">
            <div className="faq-table-title">{block.title}</div>
            <div className="faq-table-box">
              <table>
                <tbody>
                  {block.rows.map(([coins, what]) => (
                    <tr key={coins}>
                      <th scope="row">
                        <CoinIcon size={16} />
                        {coins}
                      </th>
                      <td>{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// «Вопросы и ответы» (lib/data/faq.ts): the game's rules as questions, by
// topic, one open at a time; the search box looks through questions and
// answers alike. Below the search: «Напиши в поддержку» and the player's own
// requests, each a chat. Which chat is open is FishZoneApp's (chatTicketId)
// — «Активность» and the bot's «Перейти» open one straight away.
export function FaqScreen({
  onBack,
  onToast,
  chatTicketId = null,
  onChatChange,
}: {
  onBack: () => void
  onToast?: (msg: string) => void
  chatTicketId?: number | null
  onChatChange?: (ticketId: number | null) => void
}) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [writing, setWriting] = useState(false)
  const { data: tickets = [] } = useMySupport(chatTicketId !== null)
  const chatTicket = chatTicketId !== null ? tickets.find((tk) => tk.id === chatTicketId) : undefined
  const q = norm(query.trim())
  const sections = faqFor(lang)
    .map((s) => ({
      ...s,
      items: q ? s.items.filter((it) => norm(it.q).includes(q) || norm(answerText(it.a)).includes(q)) : s.items,
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
      {tickets.length > 0 && <MyTickets tickets={tickets} onOpen={(id) => onChatChange?.(id)} />}
      {writing && <SupportSheet onClose={() => setWriting(false)} onToast={onToast} />}
      {chatTicket && <SupportChatSheet ticket={chatTicket} onClose={() => onChatChange?.(null)} onToast={onToast} />}
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

// The player's own requests, newest first: status and the latest message;
// a tap opens the chat.
function MyTickets({ tickets, onOpen }: { tickets: SupportTicket[]; onOpen: (id: number) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(true)
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
          {tickets.map((tk) => {
            const last = tk.messages[tk.messages.length - 1]
            return (
              <button key={tk.id} className="support-ticket tap-scale" onClick={() => onOpen(tk.id)}>
                <div className="support-ticket-head">
                  <span>{t('support.ticket', { id: tk.id })} · {formatWhen(last.createdAt)}</span>
                  <span className={`support-status${tk.answered ? ' answered' : ''}`}>{tk.answered ? t('support.answered') : t('support.waiting')}</span>
                </div>
                <p className="support-ticket-body">
                  {last.from === 'support' && <b>{t('support.replyFrom')}: </b>}
                  {last.body}
                </p>
                <span className="support-ticket-open">{t('support.openChat')}</span>
              </button>
            )
          })}
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

// One request as a chat: everything said, oldest first (the player's on the
// right, the support's on the left), and a box at the bottom to add to it —
// text and, if they like, a screenshot. Stays scrolled to the newest.
function SupportChatSheet({ ticket, onClose, onToast }: { ticket: SupportTicket; onClose: () => void; onToast?: (msg: string) => void }) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const add = useAddSupportMessage()
  const count = ticket.messages.length

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count])

  const text = body.trim()
  const send = () => {
    if (!text || add.isPending) return
    add.mutate(
      { ticketId: ticket.id, body: text, photo },
      {
        onSuccess: () => {
          setBody('')
          setPhoto(null)
        },
        onError: (e) => {
          const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
          onToast?.(msg.includes('SUPPORT:too_fast') ? t('support.chatTooFast') : msg.includes('SUPPORT:too_many') ? t('support.chatTooMany') : t('common.tryAgain'))
        },
      }
    )
  }

  return createPortal(
    <div className="move-sheet-overlay" onClick={add.isPending ? undefined : onClose}>
      <div className="move-sheet support-chat" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('support.ticket', { id: ticket.id })}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">{t('support.kicker')}</div>
            <div className="move-title">{t('support.ticket', { id: ticket.id })}</div>
          </div>
          <span className={`support-status${ticket.answered ? ' answered' : ''}`}>{ticket.answered ? t('support.answered') : t('support.waiting')}</span>
        </div>
        <div className="support-thread" ref={threadRef}>
          {ticket.messages.map((m, i) => (
            <div key={i} className={`support-msg ${m.from}`}>
              {m.from === 'support' && <b>{t('support.replyFrom')}</b>}
              <p>{m.body}</p>
              {m.photo && <span className="support-msg-photo">{t('support.screenshot')}</span>}
              <time>{formatWhen(m.createdAt)}</time>
            </div>
          ))}
        </div>
        <div className="support-compose">
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
            <button type="button" className="support-compose-send" disabled={!text || add.isPending} aria-label={t('support.send')} onClick={send}>
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
