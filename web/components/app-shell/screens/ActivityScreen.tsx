'use client'

import { useState } from 'react'
import { useActivity } from '@/lib/supabase/queries'
import { CATEGORY_GRADIENT, KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { FishIcon } from '@/components/app-shell/icons'

type Filter = 'all' | 'mine'

export function ActivityScreen({
  onOpenUser,
  onOpenTerritory,
  onOpenPhoto,
  unreadIds,
  onMarkAllRead,
}: {
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onOpenPhoto: (src: string) => void
  unreadIds: Set<string>
  onMarkAllRead: () => void
}) {
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
        {unreadIds.size > 0 && (
          <button className="mark-read-btn tap-scale" onClick={onMarkAllRead}>
            Прочитать все
          </button>
        )}
      </div>
      <div>
        {isLoading ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : list.length ? (
          list.map((a) => {
            if (a.kind === 'moderation') {
              return (
                <div className="activity-item" key={a.id}>
                  <div className="avatar" style={{ background: '#D33' }}>!</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                      Улов на территории{' '}
                      <button className="activity-who-btn" onClick={() => onOpenTerritory(a.territoryId!)}>
                        {a.territoryId}
                      </button>{' '}
                      удалён модератором
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      Нарушены правила площадки. При повторных нарушениях аккаунт будет заблокирован.
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            const meta = formatCatchMeta(a.lengthCm, a.weightKg)
            const text =
              a.kind === 'claim'
                ? `занял территорию ${a.territoryId}`
                : a.kind === 'follow'
                  ? 'подписался на тебя'
                  : `поймал ${a.speciesName?.toLowerCase() ?? 'рыбу'}`
            return (
              <div className="activity-item" key={a.id}>
                <div className="avatar" style={a.mine ? {} : { background: 'var(--blue)' }}>
                  {a.avatarUrl ? <img src={a.avatarUrl} alt="" /> : a.who.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                    {a.mine ? (
                      a.who
                    ) : (
                      <button className="activity-who-btn" onClick={() => onOpenUser(a.userId)}>
                        {a.who}
                      </button>
                    )}{' '}
                    {text}
                  </div>
                  {a.territoryId && a.territoryKind && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      <button className="activity-who-btn" onClick={() => onOpenTerritory(a.territoryId!)}>
                        Территория {a.territoryId}
                      </button>{' '}
                      · {KIND_LABEL[a.territoryKind]}
                    </div>
                  )}
                  {meta && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2, fontWeight: 600 }}>{meta}</div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {unreadIds.has(a.id) && <span className="unread-dot" />}
                    {formatWhen(a.createdAt)}
                  </div>
                </div>
                {a.speciesName && (
                  <div
                    className="fish-thumb"
                    style={{ width: 44, height: 44, cursor: a.photoUrl ? 'pointer' : undefined, background: a.photoUrl ? undefined : CATEGORY_GRADIENT[a.speciesCategory ?? 'marine'] }}
                    onClick={() => a.photoUrl && onOpenPhoto(a.photoUrl)}
                  >
                    {a.photoUrl ? <img src={a.photoUrl} alt={a.speciesName} /> : <FishIcon size={18} />}
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
