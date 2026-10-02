'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  useCatchById,
  useCatchComments,
  useCatchCommentsLive,
  usePostComment,
  useDeleteComment,
  useReportComment,
  useIsSuperAdmin,
  useCanModerateReports,
  useProfile,
} from '@/lib/supabase/queries'
import { StyledName } from '@/components/app-shell/StyledName'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { formatShortAgo } from '@/lib/format'
import { COMMENT_MAX_LENGTH, moderationMessage, mutedMessage, quickCheck } from '@/lib/moderation'
import { renderWithAppLinks } from '@/components/app-shell/AppLinkText'
import { useKeyboardInset } from '@/lib/useKeyboardInset'
import { COMMENT_REPORT_REASONS } from '@/lib/data/reportReasons'
import type { CatchComment } from '@/lib/data/types'

type ReplyTarget = { rootId: number; userId: string; name: string }

// A thread shows this many replies before collapsing the rest behind
// «Показать ещё» — long threads otherwise push every later root far down.
const VISIBLE_REPLIES = 2
// The counter ring only appears near the limit; below that it's noise.
const COUNTER_FROM = 250
const RING_LENGTH = 2 * Math.PI * 9

// Rendered by FishZoneApp at the app-shell level like every other modal
// (see DECISIONS.md) — a bottom sheet over whatever screen opened it
// (the catch card, or a comment notification in Activity).
export function CommentsSheet({
  catchId,
  highlightCommentId,
  onClose,
  onOpenUser,
}: {
  catchId: number
  highlightCommentId: number | null
  onClose: () => void
  onOpenUser: (id: string) => void
}) {
  const { user } = useAuth()
  const isSuperAdmin = useIsSuperAdmin()
  const canModerate = useCanModerateReports()
  const { data: theCatch } = useCatchById(catchId)
  const { data: me } = useProfile(user?.id ?? null)
  const { data: comments = [], isLoading, refetch } = useCatchComments(catchId)
  useCatchCommentsLive(catchId)
  const postComment = usePostComment()
  const deleteComment = useDeleteComment()
  const reportComment = useReportComment()

  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [mutedUntil, setMutedUntil] = useState<string | null>(null)
  const [pending, setPending] = useState<CatchComment[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [reportFor, setReportFor] = useState<number | null>(null)
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  // Lifts the input bar above the on-screen keyboard.
  const overlayRef = useRef<HTMLDivElement>(null)
  const keyboardInset = useKeyboardInset(overlayRef)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragStartY = useRef<number | null>(null)
  // Ids already on screen when the sheet opened: only comments arriving
  // after that play the slide-in, not the whole list at once.
  const [initialIds, setInitialIds] = useState<Set<number> | null>(null)
  if (initialIds === null && !isLoading) setInitialIds(new Set(comments.map((c) => c.id)))

  // Opened from a notification: that comment's thread renders open (see
  // highlightRootId below), it flashes once, and this scrolls it into view.
  const highlightTarget = highlightCommentId ? comments.find((c) => c.id === highlightCommentId) : undefined
  const highlightRootId = highlightTarget ? (highlightTarget.parentId ?? highlightTarget.id) : null
  const scrolledToHighlight = useRef(false)
  useEffect(() => {
    if (scrolledToHighlight.current || !highlightTarget) return
    scrolledToHighlight.current = true
    requestAnimationFrame(() => {
      const list = listRef.current
      const el = document.getElementById(`comment-${highlightTarget.id}`)
      if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2
    })
  }, [highlightTarget])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const all = useMemo(() => [...comments, ...pending], [comments, pending])
  const roots = all.filter((c) => c.parentId === null)
  const repliesByRoot = new Map<number, CatchComment[]>()
  for (const c of all) {
    if (c.parentId === null) continue
    const list = repliesByRoot.get(c.parentId) ?? []
    list.push(c)
    repliesByRoot.set(c.parentId, list)
  }
  const liveCount = comments.filter((c) => !c.deleted).length
  const muted = mutedUntil !== null && new Date(mutedUntil) > new Date()

  function close() {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 220)
  }

  // Restarts the shake even when the previous one hasn't finished — the
  // class comes off for a frame, then back on. Never remounts the textarea,
  // which would drop focus and close the phone keyboard.
  function fail(message: string) {
    setError(message)
    setShaking(false)
    requestAnimationFrame(() => setShaking(true))
  }

  function openUser(id: string) {
    onClose()
    onOpenUser(id)
  }

  function startReply(c: CatchComment) {
    setReplyTo({ rootId: c.parentId ?? c.id, userId: c.userId, name: c.displayName })
    setMenuFor(null)
    setError(null)
    inputRef.current?.focus()
  }

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  async function send() {
    const body = text.trim()
    if (!user || !body || postComment.isPending) return
    if (muted) return fail(mutedMessage(mutedUntil))
    const quick = quickCheck(body)
    if (quick) return fail(moderationMessage(quick))

    const target = replyTo
    const tempId = -Date.now()
    setPending((p) => [
      ...p,
      {
        id: tempId,
        parentId: target?.rootId ?? null,
        userId: user.id,
        displayName: me?.displayName ?? 'Ты',
        avatarUrl: me?.avatarUrl ?? null,
        nameStyle: me?.equippedNameStyle ?? null,
        replyToUserId: target?.userId ?? null,
        replyToName: target?.name ?? null,
        body,
        createdAt: new Date().toISOString(),
        deleted: false,
        mine: true,
        clanCrest: me?.clanCrest ?? null,
        clanName: me?.clanName ?? null,
        pending: true,
      },
    ])
    if (target) setExpanded((prev) => new Set(prev).add(target.rootId))
    setText('')
    setReplyTo(null)
    setError(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'
    if (!target) requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }))

    try {
      const res = await postComment.mutateAsync({ catchId, body, parentId: target?.rootId ?? null })
      if (!res.ok) {
        setText(body)
        setReplyTo(target)
        if (res.mutedUntil) setMutedUntil(res.mutedUntil)
        fail(moderationMessage(res.reason, res))
      } else {
        await refetch()
      }
    } catch {
      setText(body)
      setReplyTo(target)
      fail('Не удалось отправить — проверь интернет')
    } finally {
      setPending((p) => p.filter((c) => c.id !== tempId))
    }
  }

  function canDelete(c: CatchComment) {
    return c.mine || !!theCatch?.mine || isSuperAdmin || canModerate
  }

  function renderComment(c: CatchComment, isReply: boolean) {
    const isNew = initialIds !== null && !initialIds.has(c.id) && !c.pending
    const classes = [
      'comment-row',
      isNew || c.pending ? 'comment-enter' : '',
      c.pending ? 'comment-pending' : '',
      highlightCommentId === c.id ? 'comment-flash' : '',
      menuFor === c.id ? 'menu-open' : '',
    ]
    if (c.deleted) {
      return (
        <div key={c.id} id={`comment-${c.id}`} className={classes.join(' ')}>
          <div className="avatar comment-avatar comment-avatar-deleted" aria-hidden />
          <div className="comment-deleted">Комментарий удалён</div>
        </div>
      )
    }
    return (
      <div key={c.id} id={`comment-${c.id}`} className={classes.join(' ')}>
        <button className="avatar comment-avatar tap-scale" onClick={() => openUser(c.userId)} aria-label={c.displayName}>
          {c.avatarUrl ? <img src={thumbUrl(c.avatarUrl, 64)} alt="" loading="lazy" decoding="async" /> : c.displayName.slice(0, 1).toUpperCase()}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="comment-head">
            <button className="comment-name" onClick={() => openUser(c.userId)}>
              <StyledName name={c.displayName} styleId={c.nameStyle} />
            </button>
            {c.clanCrest != null && <ClanCrest crest={c.clanCrest} size={16} title={c.clanName ?? undefined} />}
            <span className="comment-time">{c.pending ? 'отправка…' : formatShortAgo(c.createdAt)}</span>
            {!c.pending && user && (
              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <button className="comment-more" aria-label="Действия" onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
                {menuFor === c.id && (
                  <div className="comment-menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => startReply(c)}>Ответить</button>
                    {!c.mine && (
                      <button
                        onClick={() => {
                          setMenuFor(null)
                          setReportFor(c.id)
                        }}
                      >
                        Пожаловаться
                      </button>
                    )}
                    {canDelete(c) && (
                      <button
                        className="danger"
                        onClick={() => {
                          setMenuFor(null)
                          setConfirmDeleteFor(c.id)
                        }}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="comment-body">
            {isReply && c.replyToName && <span className="comment-mention">@{c.replyToName} </span>}
            {c.body ? renderWithAppLinks(c.body) : null}
          </div>
          {!c.pending && user && (
            <div className="comment-actions">
              <button onClick={() => startReply(c)}>Ответить</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const counterVisible = text.length >= COUNTER_FROM
  const over = text.length > COMMENT_MAX_LENGTH

  return (
    <div ref={overlayRef} className={`comments-overlay${closing ? ' is-closing' : ''}`} onClick={close}>
      <div
        className={`comments-sheet${closing ? ' is-closing' : ''}`}
        style={{
          marginBottom: keyboardInset,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (menuFor !== null) setMenuFor(null)
        }}
      >
        {/* Drag the header down to dismiss — the familiar sheet gesture. */}
        <div
          className="comments-grab"
          onTouchStart={(e) => {
            dragStartY.current = e.touches[0].clientY
            setDragging(true)
          }}
          onTouchMove={(e) => {
            if (dragStartY.current === null) return
            setDragY(Math.max(0, e.touches[0].clientY - dragStartY.current))
          }}
          onTouchEnd={() => {
            dragStartY.current = null
            setDragging(false)
            if (dragY > 110) close()
            setDragY(0)
          }}
        >
          <div className="comments-handle" />
          <div className="comments-head">
            <div className="comments-title">
              Комментарии {liveCount > 0 && <span className="comments-count">{liveCount}</span>}
            </div>
            <button className="comments-close tap-scale" onClick={close} aria-label="Закрыть">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="comments-list" ref={listRef}>
          {isLoading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="comment-row comment-skeleton">
                <div className="avatar comment-avatar" />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-line" style={{ width: '38%' }} />
                  <div className="skeleton-line" style={{ width: `${80 - i * 15}%`, marginTop: 8 }} />
                </div>
              </div>
            ))
          ) : roots.length === 0 ? (
            <div className="comments-empty">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4a8.4 8.4 0 0 1-1.1-4.5A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z" />
              </svg>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', marginTop: 10 }}>Пока без комментариев</div>
              <div style={{ marginTop: 4 }}>Будь первым — спроси, на что клюнуло</div>
            </div>
          ) : (
            roots.map((root) => {
              const replies = repliesByRoot.get(root.id) ?? []
              const isOpen = expanded.has(root.id) || highlightRootId === root.id || replies.length <= VISIBLE_REPLIES
              const shown = isOpen ? replies : replies.slice(0, VISIBLE_REPLIES)
              return (
                <div key={root.id} className="comment-thread">
                  {renderComment(root, false)}
                  {replies.length > 0 && (
                    <div className="comment-replies">
                      {shown.map((r) => renderComment(r, true))}
                      {!isOpen && (
                        <button className="comment-more-replies" onClick={() => setExpanded((prev) => new Set(prev).add(root.id))}>
                          Показать ещё ответы ({replies.length - VISIBLE_REPLIES})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="comments-compose">
          {replyTo && (
            <div className="comments-reply-chip">
              Ответ {replyTo.name}
              <button onClick={() => setReplyTo(null)} aria-label="Отменить ответ">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          )}
          {muted ? (
            <div className="comments-muted">{mutedMessage(mutedUntil)}</div>
          ) : (
            <div className={`comments-input-box${error ? ' has-error' : ''}${shaking ? ' shake' : ''}`} onAnimationEnd={() => setShaking(false)}>
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={COMMENT_MAX_LENGTH + 20}
                placeholder={replyTo ? `Ответ ${replyTo.name}` : 'Напиши комментарий'}
                onChange={(e) => {
                  setText(e.target.value)
                  if (error) setError(null)
                  autosize(e.target)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              {counterVisible && (
                <svg width="24" height="24" viewBox="0 0 24 24" className="comments-counter" aria-label={`Осталось ${COMMENT_MAX_LENGTH - text.length}`}>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="var(--line)" strokeWidth="2.5" />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke={over ? '#D33' : text.length > 285 ? '#E8A33D' : 'var(--accent)'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={RING_LENGTH}
                    strokeDashoffset={RING_LENGTH * (1 - Math.min(1, text.length / COMMENT_MAX_LENGTH))}
                    transform="rotate(-90 12 12)"
                  />
                  {text.length > 285 && (
                    <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="800" fill={over ? '#D33' : 'var(--ink-soft)'}>
                      {COMMENT_MAX_LENGTH - text.length}
                    </text>
                  )}
                </svg>
              )}
              <button className="comments-send tap-scale" disabled={!text.trim() || over || postComment.isPending} onClick={send} aria-label="Отправить">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          )}
          {error && !muted && <div className="comments-error">{error}</div>}
        </div>

        {toast && <div className="comments-toast">{toast}</div>}

        {reportFor !== null && (
          <div className="comments-dialog-backdrop" onClick={() => setReportFor(null)}>
            <div className="comments-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Пожаловаться на комментарий</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {COMMENT_REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    className="btn-secondary"
                    disabled={reportComment.isPending}
                    onClick={() => {
                      const id = reportFor
                      reportComment.mutate(
                        { commentId: id, reason },
                        {
                          onSuccess: () => setToast('Жалоба отправлена — модератор посмотрит'),
                          onError: () => setToast('Не удалось отправить жалобу'),
                        }
                      )
                      setReportFor(null)
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button className="comments-dialog-cancel" onClick={() => setReportFor(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {confirmDeleteFor !== null && (
          <div className="comments-dialog-backdrop" onClick={() => setConfirmDeleteFor(null)}>
            <div className="comments-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Удалить комментарий?</div>
              <div className="modal-body" style={{ margin: '8px 0 16px' }}>
                Если на него уже ответили, вместо текста останется «Комментарий удалён».
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" onClick={() => setConfirmDeleteFor(null)}>
                  Отмена
                </button>
                <button
                  className="btn-primary"
                  style={{ background: '#D33', boxShadow: 'none' }}
                  disabled={deleteComment.isPending}
                  onClick={() => {
                    deleteComment.mutate(
                      { commentId: confirmDeleteFor, catchId },
                      { onSuccess: () => setToast('Комментарий удалён'), onError: () => setToast('Не удалось удалить') }
                    )
                    setConfirmDeleteFor(null)
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
