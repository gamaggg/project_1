'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Territory, TerritoryStatus } from '@/lib/data/types'
import { pluralSectors } from '@/lib/format'
import { useCanViewAllUsers } from '@/lib/supabase/queries'
import { CITIES, cityForSectorId, type CityId } from '@/lib/data/city'
import { WeeklyLeaderboard } from '@/components/app-shell/screens/WeeklyLeaderboard'
import { PlayersDirectory } from '@/components/app-shell/screens/PlayersDirectory'
import { ClanRating } from '@/components/app-shell/screens/ClanRating'
import { compareSectors, SECTOR_SORT_LABEL, type SectorSort } from '@/lib/data/sectorOrder'
import { SortMenu } from '@/components/app-shell/SortMenu'
import { SwipeSectorRow } from '@/components/app-shell/ProfileSectors'
import { RouteModal } from '@/components/app-shell/RouteModal'
import { tn } from '@/lib/i18n'
import { useAuth } from '@/components/providers/AuthProvider'
import { PullIndicator, pullShift, usePullToRefresh } from '@/components/app-shell/PullToRefresh'

type Filter = 'all' | TerritoryStatus
export type Mode = 'territories' | 'rating' | 'clans'

// How many sector rows are added each time the end of the list comes into
// view. Comfortably more than one screenful, so scrolling never catches up
// with the loader.
const TERRITORY_PAGE = 40

// «Мои» is every sector the viewer holds — their own and their share in a
// clan-mate's (Territory.coHolders) — in both cities, this one's first: the
// same list and count as the profile (heldTerritories, lib/data/achievements.ts).
const heldByMe = (t: Territory) => t.status === 'mine' || t.coHolders.some((h) => h.isMe)

export function TerritoriesListScreen({
  territories,
  city,
  initialFilter,
  initialMode,
  onOpenTerritory,
  onOpenUsersList,
  onOpenUser,
  onOpenClan,
  onOpenClans,
  onShowOnMap,
  heldElsewhere,
}: {
  territories: Territory[]
  // Not drawn any more (the rows are ProfileSectorRow, no colour mark); kept so callers need no change.
  myTerritoryColor: string
  city: CityId
  initialFilter?: Filter
  initialMode?: Mode
  onOpenTerritory: (id: string) => void
  onOpenUsersList: () => void
  onOpenUser: (id: string) => void
  onOpenClan: (id: number) => void
  onOpenClans: () => void
  // «На карте» behind a swiped row (sectors of the city on the map only).
  onShowOnMap: (id: string) => void
  // The viewer's sectors in the other city — «Мои» lists them after this city's.
  heldElsewhere?: Territory[]
}) {
  const [mode, setMode] = useState<Mode>('territories')
  // The row swiped open, and the sector whose «Маршрут» sheet is up.
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [routeTo, setRouteTo] = useState<Territory | null>(null)
  // The Рейтинг tab: this week's leaderboard, or everyone in the city.
  const [ratingView, setRatingView] = useState<'week' | 'players'>('week')
  const [filter, setFilter] = useState<Filter>(initialFilter ?? 'all')
  // This screen (like every other one in the app-shell) never unmounts — only
  // its CSS 'active' class toggles — so the useState initial values above only
  // ever apply to the very first app load. Re-sync whenever a fresh
  // initialFilter/initialMode comes in (e.g. "Все мои территории" from the
  // profile, or "Перейти к текущему рейтингу" from the last-week recap), so
  // it isn't stuck showing whatever was picked last time.
  // Adjusted during render, the moment a new value arrives.
  const [syncedInitial, setSyncedInitial] = useState({ filter: initialFilter, mode: initialMode })
  if (initialFilter !== syncedInitial.filter || initialMode !== syncedInitial.mode) {
    setSyncedInitial({ filter: initialFilter, mode: initialMode })
    if (initialFilter && initialFilter !== syncedInitial.filter) setFilter(initialFilter)
    if (initialMode && initialMode !== syncedInitial.mode) setMode(initialMode)
  }
  const [sort, setSort] = useState<SectorSort>('lastCatch')
  const list = useMemo(() => {
    const filtered = territories.filter((t) => (filter === 'all' ? true : filter === 'mine' ? heldByMe(t) : t.status === filter))
    // territories already comes freshest catch first (see useTerritories).
    const sorted = (l: Territory[]) => (sort === 'lastCatch' ? l : [...l].sort(compareSectors(sort)))
    return filter === 'mine' && heldElsewhere?.length ? [...sorted(filtered), ...sorted(heldElsewhere)] : sorted(filtered)
  }, [territories, filter, sort, heldElsewhere])
  const canViewAllUsers = useCanViewAllUsers()
  const { user } = useAuth()
  // Pull down from the top: refetches what the open tab shows. Sectors come live
  // (useRealtimeSync), but the rating, the players and the clans only reload on
  // their own after a couple of minutes.
  const queryClient = useQueryClient()
  const { ref: ptrRef, pull, dragging, refreshing } = usePullToRefresh(() => {
    const keys =
      mode === 'clans' ? [['clans']] : mode === 'rating' ? (ratingView === 'week' ? [['weekly-leaderboard'], ['clan-badges']] : [['all-players']]) : [['territories']]
    return Promise.all(keys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'active' })))
  })

  // Rendered in pages rather than all at once: this screen stays mounted for
  // the whole session (see the note above), so the full ~660-sector list was
  // ~4000 permanently live DOM nodes for a list you scroll a few rows of.
  // The sentinel below pulls the next page in as it comes into view — while
  // the screen is hidden it can't intersect, so nothing grows in the
  // background.
  const [visibleCount, setVisibleCount] = useState(TERRITORY_PAGE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const listLengthRef = useRef(list.length)
  useEffect(() => {
    listLengthRef.current = list.length
  })
  // A new filter, order or mode starts from the first page again.
  const [pagedFor, setPagedFor] = useState(`${filter}|${sort}|${mode}`)
  if (pagedFor !== `${filter}|${sort}|${mode}`) {
    setPagedFor(`${filter}|${sort}|${mode}`)
    setVisibleCount(TERRITORY_PAGE)
  }
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
    <div className="screen-inner" ref={ptrRef} style={pullShift(pull, dragging)}>
      <PullIndicator pull={pull} refreshing={refreshing} />
      <div className="page-title">{tn('terr.title')}</div>
      <div className="page-sub">{CITIES[city].boundaryLabel} · {territories.length} {pluralSectors(territories.length)}</div>

      <div className="rating-tabs">
        <button className={`rating-tab${mode === 'territories' ? ' active' : ''}`} onClick={() => setMode('territories')}>
          {tn('terr.title')}
        </button>
        <button className={`rating-tab${mode === 'rating' ? ' active' : ''}`} onClick={() => setMode('rating')}>
          {tn('terr.tabRating')}
        </button>
        <button className={`rating-tab${mode === 'clans' ? ' active' : ''}`} onClick={() => setMode('clans')}>
          {tn('terr.tabClans')}
        </button>
      </div>

      {mode === 'clans' ? (
        <ClanRating city={city} onOpenClan={onOpenClan} onOpenClans={onOpenClans} />
      ) : mode === 'rating' ? (
        <>
          <div className="rating-views" data-tour="players-list" role="tablist" aria-label={tn('terr.tabRating')}>
            <button role="tab" aria-selected={ratingView === 'week'} className={`rating-view${ratingView === 'week' ? ' on' : ''}`} onClick={() => setRatingView('week')}>
              {tn('terr.week')}
            </button>
            <button role="tab" aria-selected={ratingView === 'players'} className={`rating-view${ratingView === 'players' ? ' on' : ''}`} onClick={() => setRatingView('players')}>
              {tn('terr.allPlayers')}
            </button>
          </div>
          {ratingView === 'week' ? <WeeklyLeaderboard city={city} onOpenUser={onOpenUser} /> : <PlayersDirectory onOpenUser={onOpenUser} />}
        </>
      ) : (
        <>
          {canViewAllUsers && (
            <button className="btn-secondary" style={{ margin: '14px 0' }} onClick={onOpenUsersList}>
              Все пользователи
            </button>
          )}
          <div className="filter-row with-sort">
            <div className={`filter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
              {tn('terr.filterAll')}
            </div>
            <div className={`filter-chip${filter === 'mine' ? ' active' : ''}`} onClick={() => setFilter('mine')}>
              {tn('terr.filterMine')}
            </div>
            <div className={`filter-chip${filter === 'free' ? ' active' : ''}`} onClick={() => setFilter('free')}>
              {tn('terr.filterFree')}
            </div>
            <SortMenu value={sort} options={SECTOR_SORT_LABEL} onChange={setSort} label={tn('terr.sortLabel')} />
          </div>
          {/* Keyed by the filter and order, so a new pick deals the rows in again. */}
          <div key={`${filter}|${sort}`} className="card sector-list" style={{ overflow: 'hidden' }}>
            {list.length ? (
              // Same row as the sectors on the profile (ProfileSectorRow): water tag, catches and
              // when the last one was, marks for shared / shield / hot — here swipeable for route / map.
              list.slice(0, visibleCount).map((t, i) => (
                <SwipeSectorRow
                  key={t.id}
                  t={t}
                  last={i === Math.min(list.length, visibleCount) - 1}
                  open={swipedId === t.id}
                  onSwipe={setSwipedId}
                  onOpen={onOpenTerritory}
                  onRoute={setRouteTo}
                  onShowOnMap={cityForSectorId(t.id) === city ? onShowOnMap : undefined}
                  legendUserId={user?.id}
                  style={i < 14 ? { animationDelay: `${i * 28}ms` } : { animation: 'none' }}
                />
              ))
            ) : (
              <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>{tn('terr.empty')}</div>
            )}
          </div>
          <div ref={sentinelRef} aria-hidden />
          {routeTo && <RouteModal lat={routeTo.lat} lng={routeTo.lng} onClose={() => setRouteTo(null)} />}
        </>
      )}
    </div>
  )
}
