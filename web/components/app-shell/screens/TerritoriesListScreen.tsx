'use client'

import { useState } from 'react'
import type { Territory, TerritoryStatus } from '@/lib/data/types'
import { KIND_LABEL } from '@/lib/data/species'
import { formatWhen } from '@/lib/format'

const STATUS_COLOR: Record<TerritoryStatus, string> = {
  mine: '#2FA84F',
  other: '#3E7BFA',
  free: '#7C7E86',
}

type Filter = 'all' | TerritoryStatus

export function TerritoriesListScreen({
  territories,
  onOpenTerritory,
}: {
  territories: Territory[]
  onOpenTerritory: (id: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const list = territories.filter((t) => (filter === 'all' ? true : t.status === filter))

  return (
    <div className="screen-inner">
      <div className="page-title">Территории</div>
      <div className="page-sub">Море, реки и озёра Аджарии · {territories.length} участков</div>
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
