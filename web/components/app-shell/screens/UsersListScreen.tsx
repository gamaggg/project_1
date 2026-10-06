'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAdminGift, useCanViewAllUsers, useAllUsers, useFindUserByPublicId, useIsSuperAdmin } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'
import type { UserListEntry } from '@/lib/data/types'
import { BackButton } from '@/components/app-shell/BackButton'

type SortKey = 'new' | 'catches' | 'territories' | 'name'

const SORTERS: Record<SortKey, (a: UserListEntry, b: UserListEntry) => number> = {
  new: (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
  catches: (a, b) => b.catchesCount - a.catchesCount,
  territories: (a, b) => b.territoriesCount - a.territoriesCount,
  name: (a, b) => a.displayName.localeCompare(b.displayName, 'ru'),
}

// Admin-only directory reached from TerritoriesListScreen's "Все
// пользователи" button — self-guards below in case of direct navigation,
// same reasoning as every other admin screen in this app-shell.
export function UsersListScreen({
  onBack,
  onOpenUser,
  onToast,
}: {
  onBack: () => void
  onOpenUser: (id: string) => void
  onToast?: (msg: string) => void
}) {
  const canViewAllUsers = useCanViewAllUsers()
  const isSuperAdmin = useIsSuperAdmin()
  // «Подарок» (super admin): tick players — or everyone — then coins and/or
  // bonus spins with a message of their own (admin_gift). `all` means every
  // player, not just the ticked ones: the server picks them, blocked excluded.
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [all, setAll] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const { data: users = [], isLoading } = useAllUsers()
  const [sort, setSort] = useState<SortKey>('new')
  const [search, setSearch] = useState('')
  const [notFound, setNotFound] = useState(false)
  const findUser = useFindUserByPublicId()

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.length !== 5) return
    setNotFound(false)
    const foundId = await findUser.mutateAsync(search)
    if (foundId) {
      setSearch('')
      onOpenUser(foundId)
    } else {
      setNotFound(true)
    }
  }

  if (!canViewAllUsers) return null

  const sorted = [...users].sort(SORTERS[sort])
  const chosen = all ? users.length : picked.size
  const toggle = (id: string) => {
    setAll(false)
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const stopPicking = () => {
    setPicking(false)
    setPicked(new Set())
    setAll(false)
  }

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Все пользователи{!isLoading && ` · ${users.length}`}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <form className="search-row" onSubmit={handleSearch}>
          <input
            className="search-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value.replace(/\D/g, '').slice(0, 5))
              setNotFound(false)
            }}
            placeholder="ID пользователя (00000)"
            inputMode="numeric"
            maxLength={5}
          />
          <button className="btn-primary" style={{ width: 'auto', padding: '0 20px' }} type="submit" disabled={search.length !== 5 || findUser.isPending}>
            Найти
          </button>
        </form>
        {notFound && (
          <div style={{ fontSize: 12.5, color: '#D33', marginTop: -10, marginBottom: 14 }}>Пользователь с таким ID не найден</div>
        )}

        {isSuperAdmin &&
          (picking ? (
            <div className="gift-pick-bar">
              <span>{all ? `Все игроки · ${users.length}` : `Выбрано: ${picked.size}`}</span>
              <button type="button" onClick={() => (all ? setAll(false) : (setAll(true), setPicked(new Set())))}>
                {all ? 'Снять всех' : 'Выбрать всех'}
              </button>
              <button type="button" onClick={stopPicking}>
                Отмена
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary gift-start" onClick={() => setPicking(true)}>
              🎁 Подарить монеты или прокруты
            </button>
          ))}

        <div className="filter-row">
          <div className={`filter-chip${sort === 'new' ? ' active' : ''}`} onClick={() => setSort('new')}>
            Новые
          </div>
          <div className={`filter-chip${sort === 'catches' ? ' active' : ''}`} onClick={() => setSort('catches')}>
            Уловы
          </div>
          <div className={`filter-chip${sort === 'territories' ? ' active' : ''}`} onClick={() => setSort('territories')}>
            Территории
          </div>
          <div className={`filter-chip${sort === 'name' ? ' active' : ''}`} onClick={() => setSort('name')}>
            Имя
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
          ) : sorted.length ? (
            sorted.map((u, i) => {
              const initials = u.displayName.slice(0, 2).toUpperCase()
              return (
                <button
                  key={u.id}
                  className="terr-list-item"
                  style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--line)' : 'none' }}
                  onClick={() => (picking ? toggle(u.id) : onOpenUser(u.id))}
                  aria-pressed={picking ? all || picked.has(u.id) : undefined}
                >
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 12.5 }}>
                    {u.avatarUrl ? <img src={thumbUrl(u.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{u.displayName}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      ID: {u.publicId} · Уловов {u.catchesCount} · Территорий {u.territoriesCount} · {formatWhen(u.createdAt)}
                    </div>
                  </div>
                  {picking ? (
                    <span className={`gift-check${all || picked.has(u.id) ? ' on' : ''}`} aria-hidden>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              )
            })
          ) : (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет пользователей</div>
          )}
        </div>
      </div>
      {picking && chosen > 0 && (
        <div className="gift-go">
          <button type="button" className="btn-primary" onClick={() => setGiftOpen(true)}>
            {all ? `Подарить всем · ${users.length}` : `Подарить · ${picked.size}`}
          </button>
        </div>
      )}
      {giftOpen && (
        <GiftSheet
          userIds={all ? null : [...picked]}
          count={chosen}
          onClose={() => setGiftOpen(false)}
          onDone={(n) => {
            setGiftOpen(false)
            stopPicking()
            onToast?.(`Подарок отправлен: ${n}`)
          }}
        />
      )}
    </>
  )
}

// The gift itself: coins and/or bonus spins (either can be 0, not both) and
// the message the players see in «Активность» — empty means «Подарок от RANGE».
// Shows what will arrive before it's sent.
function GiftSheet({ userIds, count, onClose, onDone }: { userIds: string[] | null; count: number; onClose: () => void; onDone: (n: number) => void }) {
  const [coins, setCoins] = useState('')
  const [spins, setSpins] = useState('')
  const [note, setNote] = useState('')
  const gift = useAdminGift()
  const c = Number(coins) || 0
  const sp = Number(spins) || 0
  const valid = c >= 0 && c <= 10000 && sp >= 0 && sp <= 100 && c + sp > 0
  const amounts = [c > 0 ? `+${c} монет` : null, sp > 0 ? `${sp} бонусных прокрутов` : null].filter(Boolean).join(' · ')
  const message = String((gift.error as { message?: string } | null)?.message ?? '')

  return createPortal(
    <div className="move-sheet-overlay" onClick={gift.isPending ? undefined : onClose}>
      <div className="move-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Подарок">
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">Подарок</div>
            <div className="move-title">{userIds === null ? `Всем игрокам · ${count}` : `Игрокам: ${count}`}</div>
          </div>
        </div>
        <div className="move-body">
          <div className="gift-amounts">
            <label>
              <span>Монеты</span>
              <input value={coins} onChange={(e) => setCoins(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="0" />
            </label>
            <label>
              <span>Бонусные прокруты</span>
              <input value={spins} onChange={(e) => setSpins(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="0" />
            </label>
          </div>
          <div className="support-field" style={{ marginTop: 12 }}>
            <textarea value={note} maxLength={200} rows={3} placeholder="Сообщение игрокам — например: Спасибо, что ловите с нами!" onChange={(e) => setNote(e.target.value)} />
            <span className="support-count">{note.length}/200</span>
          </div>
          <div className="gift-preview">
            <span className="gift-preview-kicker">Так увидят в «Активности»</span>
            <b>{note.trim() || 'Подарок от RANGE'}</b>
            <span>{amounts ? (note.trim() ? `Подарок от RANGE: ${amounts}` : amounts) : 'Укажи монеты или прокруты'}</span>
          </div>
          {gift.isError && (
            <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
              {message.includes('GIFT:amount') ? 'Монеты — до 10 000, прокруты — до 100, хотя бы что-то одно' : message || 'Не удалось отправить'}
            </div>
          )}
          <button
            className="btn-primary"
            style={{ margin: '14px 0 18px' }}
            disabled={!valid || gift.isPending}
            onClick={() => gift.mutate({ userIds, coins: c, spins: sp, note }, { onSuccess: (n) => onDone(n) })}
          >
            {gift.isPending ? 'Отправляем…' : `Подарить ${count} ${count === 1 ? 'игроку' : 'игрокам'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
