'use client'

import { useState } from 'react'
import { useIsAdmin, useAllUsers, useFindUserByPublicId } from '@/lib/supabase/queries'
import { formatWhen } from '@/lib/format'
import type { UserListEntry } from '@/lib/data/types'

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
}: {
  onBack: () => void
  onOpenUser: (id: string) => void
}) {
  const isAdmin = useIsAdmin()
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

  if (!isAdmin) return null

  const sorted = [...users].sort(SORTERS[sort])

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Все пользователи</div>
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
                  onClick={() => onOpenUser(u.id)}
                >
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 12.5 }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{u.displayName}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      ID: {u.publicId} · Уловов {u.catchesCount} · Территорий {u.territoriesCount} · {formatWhen(u.createdAt)}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              )
            })
          ) : (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет пользователей</div>
          )}
        </div>
      </div>
    </>
  )
}
