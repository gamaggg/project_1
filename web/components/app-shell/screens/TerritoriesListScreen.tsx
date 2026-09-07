'use client'

import { useState } from 'react'
import type { Territory, TerritoryStatus } from '@/lib/data/types'
import { KIND_LABEL } from '@/lib/data/species'
import { formatWhen } from '@/lib/format'
import { useIsAdmin, useFindUserByPublicId } from '@/lib/supabase/queries'

const STATUS_COLOR: Record<TerritoryStatus, string> = {
  mine: '#2FA84F',
  other: '#3E7BFA',
  free: '#7C7E86',
}

type Filter = 'all' | TerritoryStatus

export function TerritoriesListScreen({
  territories,
  onOpenTerritory,
  onOpenUser,
}: {
  territories: Territory[]
  onOpenTerritory: (id: string) => void
  onOpenUser: (id: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const list = territories.filter((t) => (filter === 'all' ? true : t.status === filter))
  const isAdmin = useIsAdmin()
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

  return (
    <div className="screen-inner">
      <div className="page-title">Территории</div>
      <div className="page-sub">Море, реки и озёра Батуми · {territories.length} участков</div>
      {isAdmin && (
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
      )}
      {notFound && (
        <div style={{ fontSize: 12.5, color: '#D33', marginTop: -10, marginBottom: 14 }}>Пользователь с таким ID не найден</div>
      )}
      <div className="filter-row">
        <div className={`filter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Все
        </div>
        <div className={`filter-chip${filter === 'mine' ? ' active' : ''}`} onClick={() => setFilter('mine')}>
          Мои
        </div>
        <div className={`filter-chip${filter === 'free' ? ' active' : ''}`} onClick={() => setFilter('free')}>
          Свободные
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {list.length ? (
          list.map((t, i) => (
            <button
              key={t.id}
              className="terr-list-item"
              style={{ borderBottom: i < list.length - 1 ? '1px solid var(--line)' : 'none' }}
              onClick={() => onOpenTerritory(t.id)}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLOR[t.status], flex: '0 0 auto' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>Сектор {t.id}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {KIND_LABEL[t.kind]} · Уловов {t.catchCount} · {t.lastCatchAt ? formatWhen(t.lastCatchAt) : '—'}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))
        ) : (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Нет территорий в этой категории</div>
        )}
      </div>
    </div>
  )
}
