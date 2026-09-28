'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useClan, useClanChat, useDeleteClanMessage, useMarkClanChatRead, usePostClanMessage, useProfile } from '@/lib/supabase/queries'
import { BackButton } from '@/components/app-shell/BackButton'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { StyledName } from '@/components/app-shell/StyledName'
import { eventText } from '@/components/app-shell/screens/ClanScreen'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { CLAN_ROLE_LABEL } from '@/lib/data/clanLevels'
import { CLAN_CHAT_MAX_LENGTH, chatModerationMessage, chatMutedMessage, moderationMessage, quickCheck } from '@/lib/moderation'
import type { ClanChatMessage, ClanEvent } from '@/lib/data/types'

// Consecutive messages from one author within this window read as one
// block: name on the first bubble, avatar beside the last.
const GROUP_WINDOW_MS = 5 * 60_000
// How close to the bottom still counts as "reading the latest" — a new
// message scrolls into view only then, never yanking someone reading history.
const NEAR_BOTTOM_PX = 140

type Item =
  | { type: 'day'; key: string; label: string }
  | { type: 'event'; key: string; text: string }
  | { type: 'message'; key: string; message: ClanChatMessage; first: boolean; last: boolean }

function dayLabel(d: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Сегодня'
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', d.getFullYear() === today.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

function pluralMembers(n: number): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return `${n} участник`
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} участника`
  return `${n} участников`
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}

// «@Имя» of a clan member, the same way post_clan_message finds them —
// the whole name (old names can hold spaces), not followed by a letter.
function mentionPattern(names: string[]): RegExp | null {
  const alts = names
    .filter((n) => n.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
  return alts.length ? new RegExp(`@(${alts.join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// Messages (oldest first) and the clan's journal events woven into one
// timeline with day separators. Journal events older than the oldest loaded
// message wait until that part of the history is loaded, so scrolling up
// never shows them out of order.
function buildItems(messages: ClanChatMessage[], events: ClanEvent[], historyComplete: boolean): Item[] {
  const floor = !historyComplete && messages.length ? new Date(messages[0].createdAt).getTime() : -Infinity
  type Entry = { at: number; message?: ClanChatMessage; event?: ClanEvent; idx: number }
  const entries: Entry[] = [
    ...messages.map((m, idx): Entry => ({ at: new Date(m.createdAt).getTime(), message: m, idx })),
    ...events.map((e, idx): Entry => ({ at: new Date(e.createdAt).getTime(), event: e, idx })).filter((e) => e.at >= floor),
  ].sort((a, b) => a.at - b.at || (a.message ? 1 : 0) - (b.message ? 1 : 0))

  const items: Item[] = []
  let lastDay = ''
  entries.forEach((entry, i) => {
    const day = new Date(entry.at).toDateString()
    if (day !== lastDay) {
      items.push({ type: 'day', key: `day:${day}`, label: dayLabel(new Date(entry.at)) })
      lastDay = day
    }
    if (entry.event) {
      items.push({ type: 'event', key: `event:${entry.at}:${entry.idx}`, text: eventText(entry.event) })
      return
    }
    const m = entry.message!
    const prev = entries[i - 1]
    const next = entries[i + 1]
    const sameBlock = (other: Entry | undefined) =>
      !!other?.message &&
      other.message.userId === m.userId &&
      Math.abs(other.at - entry.at) < GROUP_WINDOW_MS &&
      new Date(other.at).toDateString() === day
    items.push({ type: 'message', key: `msg:${m.id}`, message: m, first: !sameBlock(prev), last: !sameBlock(next) })
  })
  return items
}

export function ClanChatScreen({
  clanId,
  active,
  onBack,
  onOpenUser,
}: {
  clanId: number
  active: boolean
  onBack: () => void
  onOpenUser: (id: string) => void
}) {
  const { user } = useAuth()
  const { data: me } = useProfile(user?.id ?? null)
  const { data: clan } = useClan(clanId)
  const chat = useClanChat(clanId)
  const post = usePostClanMessage()
  const remove = useDeleteClanMessage()
  const markRead = useMarkClanChatRead()

  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [mutedUntil, setMutedUntil] = useState<string | null>(null)
  const [pending, setPending] = useState<ClanChatMessage[]>([])
  const [menuFor, setMenuFor] = useState<ClanChatMessage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ClanChatMessage | null>(null)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [keyboardInset, setKeyboardInset] = useState(0)
  // The «@…» being typed right before the caret — drives the member picker.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nearBottomRef = useRef(true)
  const initialScrollDone = useRef(false)
  const olderAnchor = useRef<{ height: number; top: number } | null>(null)
  const lastMarkedId = useRef<number | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Server pages are newest first; the screen reads oldest → newest.
  const messages = useMemo(() => {
    const loaded = (chat.data?.pages ?? []).flat().slice().reverse()
    const loadedIds = new Set(loaded.map((m) => m.id))
    return [...loaded, ...pending.filter((p) => !loadedIds.has(p.id))]
  }, [chat.data, pending])
  const items = useMemo(() => buildItems(messages, clan?.events ?? [], !chat.hasNextPage), [messages, clan?.events, chat.hasNextPage])
  const newestId = messages.filter((m) => !m.pending).at(-1)?.id ?? null
  const lastKey = items.at(-1)?.key ?? ''
  const muted = mutedUntil !== null && new Date(mutedUntil) > new Date()
  const canModerate = clan?.myRole === 'leader' || clan?.myRole === 'co_leader'
  const myName = me?.displayName ?? null
  const mentionRe = useMemo(() => mentionPattern((clan?.members ?? []).map((m) => m.displayName)), [clan?.members])
  const mentionCandidates = useMemo(() => {
    if (!mention || !clan) return []
    const q = mention.query.toLowerCase()
    return clan.members.filter((m) => m.userId !== user?.id && m.displayName.toLowerCase().startsWith(q)).slice(0, 6)
  }, [mention, clan, user?.id])

  function updateMention(el: HTMLTextAreaElement) {
    const caret = el.selectionStart ?? el.value.length
    const match = el.value.slice(0, caret).match(/(?:^|\s)@([^\s@]{0,30})$/u)
    setMention(match ? { start: caret - match[1].length - 1, query: match[1] } : null)
  }

  function pickMention(name: string) {
    const el = inputRef.current
    if (!mention || !el) return
    const caret = el.selectionStart ?? text.length
    const insert = `@${name} `
    const next = text.slice(0, mention.start) + insert + text.slice(caret)
    setText(next)
    setMention(null)
    const at = mention.start + insert.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(at, at)
      autosize(el)
    })
  }

  // Message text with members' «@Имя» picked out — yours in the accent.
  function renderBody(body: string) {
    if (!mentionRe) return body
    const parts: ReactNode[] = []
    let last = 0
    for (const m of body.matchAll(mentionRe)) {
      const at = m.index ?? 0
      if (at > last) parts.push(body.slice(last, at))
      const isMe = !!myName && m[1].toLowerCase() === myName.toLowerCase()
      parts.push(
        <span key={at} className={`clan-chat-mention${isMe ? ' me' : ''}`}>
          {m[0]}
        </span>
      )
      last = at + m[0].length
    }
    if (last < body.length) parts.push(body.slice(last))
    return parts
  }

  function mentionsMe(body: string): boolean {
    if (!myName) return false
    return new RegExp(`@${escapeRegex(myName)}(?![\\p{L}\\p{N}_])`, 'iu').test(body)
  }
  const notMember = chat.isError || (!!clan && !clan.myRole)

  // iOS keeps the layout viewport under the keyboard — lift the composer by
  // the part the keyboard covers (same approach as CommentsSheet).
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKeyboardInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // Reading the chat marks it read — only while it's actually on screen
  // (screens stay mounted), once per newest message.
  useEffect(() => {
    if (!active || !chat.isSuccess || lastMarkedId.current === newestId) return
    lastMarkedId.current = newestId
    markRead.mutate(clanId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, chat.isSuccess, newestId, clanId])

  // Scroll: land on the latest message once loaded; keep the view still
  // when older history is prepended; follow new messages only if the reader
  // was already at the bottom (or sent it).
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el || !chat.isSuccess) return
    if (olderAnchor.current) {
      el.scrollTop = el.scrollHeight - olderAnchor.current.height + olderAnchor.current.top
      olderAnchor.current = null
      return
    }
    if (!initialScrollDone.current) {
      initialScrollDone.current = true
      el.scrollTop = el.scrollHeight
      return
    }
    const last = items.at(-1)
    const mineJustSent = last?.type === 'message' && last.message.mine
    if (nearBottomRef.current || mineJustSent) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey, chat.isSuccess, chat.data?.pages.length])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    if (el.scrollTop < 80 && chat.hasNextPage && !chat.isFetchingNextPage) {
      olderAnchor.current = { height: el.scrollHeight, top: el.scrollTop }
      void chat.fetchNextPage()
    }
  }

  function fail(message: string) {
    setError(message)
    setShaking(false)
    requestAnimationFrame(() => setShaking(true))
  }

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`
  }

  async function send() {
    const body = text.trim()
    if (!user || !body || post.isPending) return
    if (muted) return fail(chatMutedMessage(mutedUntil))
    // A member's «@Имя» is a mention, not a Telegram handle — dropped before
    // the link check, exactly as post_clan_message does on the server.
    const quick = quickCheck(mentionRe ? body.replace(mentionRe, '$1') : body, CLAN_CHAT_MAX_LENGTH)
    if (quick) return fail(quick === 'too_long' ? 'Слишком длинно — до 500 символов' : moderationMessage(quick))

    const tempId = -Date.now()
    setPending((p) => [
      ...p,
      {
        id: tempId,
        userId: user.id,
        displayName: me?.displayName ?? 'Ты',
        avatarUrl: me?.avatarUrl ?? null,
        nameStyle: me?.equippedNameStyle ?? null,
        role: clan?.myRole ?? null,
        body,
        createdAt: new Date().toISOString(),
        mine: true,
        pending: true,
      },
    ])
    setText('')
    setError(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    try {
      const res = await post.mutateAsync({ clanId, body })
      if (!res.ok) {
        setText(body)
        if (res.mutedUntil) setMutedUntil(res.mutedUntil)
        fail(chatModerationMessage(res.reason, res))
      } else {
        await chat.refetch()
      }
    } catch {
      setText(body)
      fail('Не удалось отправить — проверь интернет')
    } finally {
      setPending((p) => p.filter((m) => m.id !== tempId))
    }
  }

  // Long press (or right click) on a bubble opens its actions.
  function pressStart(m: ClanChatMessage) {
    if (m.pending) return
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null
      setMenuFor(m)
    }, 450)
  }
  function pressEnd() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  async function copy(m: ClanChatMessage) {
    setMenuFor(null)
    try {
      await navigator.clipboard.writeText(m.body)
      setToast('Скопировано')
    } catch {
      setToast('Не удалось скопировать')
    }
  }

  const memberCount = clan?.members.length ?? 0

  return (
    <div className="clan-chat">
      <div className="clan-chat-header">
        <BackButton onClick={onBack} registerNative={false} />
        <div className="clan-chat-title">
          {clan && <ClanCrest crest={clan.crest} size={32} />}
          <div style={{ minWidth: 0 }}>
            <div className="clan-chat-name">{clan?.name ?? 'Чат клана'}</div>
            <div className="clan-chat-sub">Чат клана{memberCount ? ` · ${pluralMembers(memberCount)}` : ''}</div>
          </div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {clan?.announcement && (
        <button className={`clan-chat-pinned${pinnedOpen ? ' open' : ''}`} onClick={() => setPinnedOpen((o) => !o)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
          </svg>
          <span className="clan-chat-pinned-text">
            <b>Объявление</b>
            <span>{clan.announcement}</span>
          </span>
        </button>
      )}

      <div className="clan-chat-list" ref={listRef} onScroll={onScroll}>
        {chat.isFetchingNextPage && <div className="clan-chat-loading">Загружаем историю…</div>}
        {notMember ? (
          <div className="clan-chat-empty">Чат доступен только участникам клана</div>
        ) : chat.isLoading ? (
          <div className="clan-chat-loading">Загрузка…</div>
        ) : (
          <>
            {items.map((item) => {
              if (item.type === 'day') return <div key={item.key} className="clan-chat-day"><span>{item.label}</span></div>
              if (item.type === 'event') return <div key={item.key} className="clan-chat-event">{item.text}</div>
              const m = item.message
              const role = m.role && m.role !== 'member' ? CLAN_ROLE_LABEL[m.role] : null
              return (
                <div key={item.key} className={`clan-chat-row${m.mine ? ' mine' : ''}${item.first ? ' first' : ''}${item.last ? ' last' : ''}`}>
                  {!m.mine && (
                    <div className="clan-chat-avatar-slot">
                      {item.last && (
                        <button className="clan-chat-avatar" onClick={() => m.userId && onOpenUser(m.userId)} aria-label={m.displayName}>
                          {m.avatarUrl ? <img src={thumbUrl(m.avatarUrl, 64)} alt="" loading="lazy" decoding="async" /> : m.displayName.slice(0, 2).toUpperCase()}
                        </button>
                      )}
                    </div>
                  )}
                  <div
                    className={`clan-chat-bubble${m.pending ? ' pending' : ''}${!m.mine && mentionsMe(m.body) ? ' mentions-me' : ''}`}
                    onPointerDown={() => pressStart(m)}
                    onPointerUp={pressEnd}
                    onPointerLeave={pressEnd}
                    onPointerCancel={pressEnd}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      if (!m.pending) setMenuFor(m)
                    }}
                  >
                    {!m.mine && item.first && (
                      <div className="clan-chat-author">
                        <StyledName name={m.displayName} styleId={m.nameStyle} />
                        {role && <span className={`clan-chat-role role-${m.role}`}>{role}</span>}
                      </div>
                    )}
                    <div className="clan-chat-text">
                      {renderBody(m.body)}
                      <span className="clan-chat-time">{m.pending ? '···' : timeLabel(m.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {!messages.length && (
              <div className="clan-chat-empty">
                {clan && <ClanCrest crest={clan.crest} size={56} />}
                <b>Здесь пока тихо</b>
                <span>Напиши первым — например, где сегодня клюёт</span>
              </div>
            )}
          </>
        )}
      </div>

      {!notMember && (
        <div className="clan-chat-compose" style={{ marginBottom: keyboardInset }}>
          {mentionCandidates.length > 0 && (
            <div className="clan-chat-mentions" role="listbox" aria-label="Упомянуть участника">
              {mentionCandidates.map((m) => (
                <button
                  key={m.userId}
                  className="clan-chat-mention-pick tap-scale"
                  role="option"
                  aria-selected={false}
                  // mousedown, not click: keeps the textarea focused (and the
                  // phone keyboard up) while the name goes in.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickMention(m.displayName)
                  }}
                  onClick={() => pickMention(m.displayName)}
                >
                  <span className="clan-chat-mention-avatar">
                    {m.avatarUrl ? <img src={thumbUrl(m.avatarUrl, 64)} alt="" loading="lazy" decoding="async" /> : m.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  {m.displayName}
                </button>
              ))}
            </div>
          )}
          {error && <div className="comments-error">{error}</div>}
          {muted ? (
            <div className="comments-muted">{chatMutedMessage(mutedUntil)}</div>
          ) : (
            <div className={`comments-input-box${error ? ' has-error' : ''}${shaking ? ' shake' : ''}`} onAnimationEnd={() => setShaking(false)}>
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={CLAN_CHAT_MAX_LENGTH + 50}
                placeholder="Сообщение клану…"
                aria-label="Сообщение в чат клана"
                onChange={(e) => {
                  setText(e.target.value)
                  if (error) setError(null)
                  autosize(e.target)
                  updateMention(e.target)
                }}
                onSelect={(e) => updateMention(e.currentTarget)}
                onBlur={() => setMention(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              {text.length > CLAN_CHAT_MAX_LENGTH - 100 && (
                <span className={`clan-chat-counter${text.length > CLAN_CHAT_MAX_LENGTH ? ' over' : ''}`}>{CLAN_CHAT_MAX_LENGTH - text.length}</span>
              )}
              <button className="comments-send tap-scale" disabled={!text.trim() || text.length > CLAN_CHAT_MAX_LENGTH} onClick={() => void send()} aria-label="Отправить">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {menuFor && (
        <div className="comments-dialog-backdrop" onClick={() => setMenuFor(null)}>
          <div className="comments-dialog clan-chat-menu" onClick={(e) => e.stopPropagation()}>
            <div className="clan-chat-menu-quote">{menuFor.body}</div>
            <button className="clan-chat-menu-btn" onClick={() => void copy(menuFor)}>
              Скопировать текст
            </button>
            {(menuFor.mine || canModerate) && (
              <button
                className="clan-chat-menu-btn danger"
                onClick={() => {
                  setConfirmDelete(menuFor)
                  setMenuFor(null)
                }}
              >
                Удалить сообщение
              </button>
            )}
            <button className="comments-dialog-cancel" onClick={() => setMenuFor(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="comments-dialog-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="comments-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ textAlign: 'center' }}>
              Удалить сообщение?
            </div>
            <div className="clan-chat-menu-quote">{confirmDelete.body}</div>
            <button
              className="btn-primary"
              style={{ background: '#D33', marginTop: 12 }}
              onClick={() => {
                remove.mutate(
                  { messageId: confirmDelete.id, clanId },
                  { onSuccess: () => setToast('Удалено'), onError: () => setToast('Не удалось удалить') }
                )
                setConfirmDelete(null)
              }}
            >
              Удалить
            </button>
            <button className="comments-dialog-cancel" onClick={() => setConfirmDelete(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {toast && <div className="comments-toast">{toast}</div>}
    </div>
  )
}
