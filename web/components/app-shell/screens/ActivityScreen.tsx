'use client'

import { useState } from 'react'
import { useActivity } from '@/lib/supabase/queries'
import { speciesInfo, SPECIES_GRADIENT, KIND_LABEL } from '@/lib/data/species'
import { formatWeight, formatWhen } from '@/lib/format'
import { FishIcon } from '@/components/app-shell/icons'

type Filter = 'all' | 'mine'

export function ActivityScreen() {
  const { data: activity = [], isLoading } = useActivity()
  const [filter, setFilter] = useState<Filter>('all')
  const list = activity.filter((a) => (filter === 'mine' ? a.mine : true))

  return (
    <div className="screen-inner">
      <div className="page-title">Активность</div>
      <div className="page-sub">Что происходит на побережье</div>
      <div className="filter-row">
        <div className={`filter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Все
        </div>
        <div className={`filter-chip${filter === 'mine' ? ' active' : ''}`} onClick={() => setFilter('mine')}>
          Мои территории
        </div>
      </div>
      <div>
        {isLoading ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : list.length ? (
          list.map((a) => {
            const sp = a.species ? speciesInfo(a.species) : null
            const text =
              a.kind === 'claim'
                ? `занял${a.mine ? '' : 'а'} территорию ${a.territoryId}`
                : `поймал${sp?.key === 'laskir' ? 'а' : ''} ${sp?.name.toLowerCase()}`
            return (
              <div className="activity-item" key={a.id}>
                <div className="avatar" style={a.mine ? {} : { background: 'var(--blue)' }}>
                  {a.who.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                    {a.who} {text}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Территория {a.territoryId} · {KIND_LABEL[a.territoryKind]}
                  </div>
                  {a.lengthCm != null && a.weightKg != null && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2, fontWeight: 600 }}>
                      {a.lengthCm} см · {formatWeight(a.weightKg)} кг
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>{formatWhen(a.createdAt)}</div>
                </div>
                {sp && (
                  <div className="fish-thumb" style={{ width: 44, height: 44, background: SPECIES_GRADIENT[sp.key] }}>
                    <FishIcon size={18} />
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет активности</div>
        )}
      </div>
    </div>
  )
}
