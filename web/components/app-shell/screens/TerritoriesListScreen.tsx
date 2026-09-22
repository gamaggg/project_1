'use client'

import { useEffect, useRef, useState } from 'react'
import type { Territory, TerritoryStatus } from '@/lib/data/types'
import { KIND_LABEL } from '@/lib/data/species'
import { formatWhen, pluralSectors } from '@/lib/format'
import { useCanViewAllUsers } from '@/lib/supabase/queries'
import { resolveTerritoryColor } from '@/lib/data/territoryColors'
import { CITIES, type CityId } from '@/lib/data/city'
import { WeeklyLeaderboard } from '@/components/app-shell/screens/WeeklyLeaderboard'

type Filter = 'all' | TerritoryStatus
export type Mode = 'territories' | 'rating'

// How many sector rows are added each time the end of the list comes into
// view. Comfortably more than one screenful, so scrolling never catches up
// with the loader.
const TERRITORY_PAGE = 40

export function TerritoriesListScreen({
  territories,
  myTerritoryColor,
  city,
  initialFilter,
  initialMode,
  onOpenTerritory,
  onOpenUsersList,
  onOpenUser,
}: {
  territories: Territory[]
  myTerritoryColor: string
  city: CityId
  initialFilter?: Filter
  initialMode?: Mode
  onOpenTerritory: (id: string) => void
  onOpenUsersList: () => void
  onOpenUser: (id: string) => void
}) {
  const [mode, setMode] = useState<Mode>('territories')
  const [filter, setFilter] = useState<Filter>(initialFilter ?? 'all')
  // This screen (like every other one in the app-shell) never unmounts — only
  // its CSS 'active' class toggles — so the useState initial values above only
  // ever apply to the very first app load. Re-sync whenever a fresh
  // initialFilter/initialMode comes in (e.g. "Все мои территории" from the
  // profile, or "Перейти к текущему рейтингу" from the last-week recap), so
  // it isn't stuck showing whatever was picked last time.
  useEffect(() => {
    if (initialFilter) setFilter(initialFilter)
  }, [initialFilter])
  useEffect(() => {
    if (initialMode) setMode(initialMode)
  }, [initialMode])
  const list = territories.filter((t) => (filter === 'all' ? true : t.status === filter))
  const canViewAllUsers = useCanViewAllUsers()

  // Rendered in pages rather than all at once: this screen stays mounted for
  // the whole session (see the note above), so the full ~660-sector list was
  // ~4000 permanently live DOM nodes for a list you scroll a few rows of.
  // The sentinel below pulls the next page in as it comes into view — while
  // the screen is hidden it can't intersect, so nothing grows in the
  // background.
  const [visibleCount, setVisibleCount] = useState(TERRITORY_PAGE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const listLengthRef = useRef(list.length)
  listLengthRef.current = list.length
  useEffect(() => {
    setVisibleCount(TERRITORY_PAGE)
  }, [filter, mode])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        setVisibleCount((c) => (c < listLengthRef.current ? c + TERRITORY_PAGE : c))
      },
      { rootMargin: '300px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="screen-inner">
      <div className="page-title">Территории</div>
      <div className="page-sub">{CITIES[city].boundaryLabel} · {territories.length} {pluralSectors(territories.length)}</div>

      <div className="rating-tabs">
        <button className={`rating-tab${mode === 'territories' ? ' active' : ''}`} onClick={() => setMode('territories')}>
          Территории
        </button>
        <button className={`rating-tab${mode === 'rating' ? ' active' : ''}`} onClick={() => setMode('rating')}>
          Рейтинг
        </button>
      </div>

      {mode === 'rating' ? (
        <WeeklyLeaderboard city={city} onOpenUser={onOpenUser} />
      ) : (
        <>
          {canViewAllUsers && (
            <button className="btn-secondary" style={{ margin: '14px 0' }} onClick={onOpenUsersList}>
              Все пользователи
            </button>
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
              list.slice(0, visibleCount).map((t, i) => (
                <button
                  key={t.id}
                  className="terr-list-item"
                  style={{ borderBottom: i < list.length - 1 ? '1px solid var(--line)' : 'none' }}
                  onClick={() => onOpenTerritory(t.id)}
                >
                  <div
                    className="hex-aspect hex-shape"
                    style={{
                      width: 12,
                      background: resolveTerritoryColor(t.status, myTerritoryColor),
                      flex: '0 0 auto',
                      alignSelf: 'flex-start',
                      marginTop: 4,
                    }}
                  />
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
          <div ref={sentinelRef} aria-hidden />
        </>
      )}
    </div>
  )
}
