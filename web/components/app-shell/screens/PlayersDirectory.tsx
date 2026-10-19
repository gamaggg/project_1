'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SkeletonRows } from '@/components/app-shell/Skeleton'
import { SortMenu } from '@/components/app-shell/SortMenu'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAllPlayers } from '@/lib/supabase/queries'
import { pluralCatches, pluralSectors } from '@/lib/format'
import type { CityPlayer } from '@/lib/data/types'
import { CITIES, CITY_LIST, type CityId } from '@/lib/data/city'
import { currentLocale, labels, tn } from '@/lib/i18n/runtime'

type Order = 'rating' | 'name'
type CityFilter = 'all' | CityId
// Who to show: everyone, only those outside a clan (to invite them), only
// clan members, only players who hold sectors, only the newly joined.
type Who = 'all' | 'solo' | 'clan' | 'holders' | 'new'

const ORDER_LABEL = labels('playersOrder', ['rating', 'name'] as const)
const WHO_LABEL = labels('playersWho', ['all', 'solo', 'clan', 'holders', 'new'] as const)
const NEW_DAYS = 14

const BY_RATING = (a: CityPlayer, b: CityPlayer) =>
  b.territoriesCount - a.territoriesCount || b.catchesCount - a.catchesCount || a.displayName.localeCompare(b.displayName, currentLocale())
const BY_NAME = (a: CityPlayer, b: CityPlayer) => a.displayName.localeCompare(b.displayName, currentLocale())

// How many rows are shown until «Показать ещё» — a few hundred players would
// otherwise mean a few hundred avatars at once.
const PAGE = 40

// «Все игроки» of the Рейтинг tab: everyone playing, in every city (or one of
// them), by rating (sectors held, then catches — all time) or by name, with a
// search box.
export function PlayersDirectory({ onOpenUser }: { onOpenUser: (id: string) => void }) {
  const { data: players = [], isLoading } = useAllPlayers(true)
  const [cityFilter, setCityFilter] = useState<CityFilter>('all')
  const [who, setWho] = useState<Who>('all')
  // «New» is counted from when the list was opened.
  const [openedAt] = useState(() => Date.now())
  const [order, setOrder] = useState<Order>('rating')
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE)

  const query = search.trim().toLowerCase().replace(/ё/g, 'е')
  const list = useMemo(() => {
    const since = openedAt - NEW_DAYS * 86_400_000
    const matchesWho = (p: CityPlayer) =>
      who === 'all' ||
      (who === 'solo' && p.clanCrest == null) ||
      (who === 'clan' && p.clanCrest != null) ||
      (who === 'holders' && p.territoriesCount > 0) ||
      (who === 'new' && new Date(p.createdAt).getTime() >= since)
    const sorted = players.filter((p) => (cityFilter === 'all' || p.city === cityFilter) && matchesWho(p)).sort(order === 'rating' ? BY_RATING : BY_NAME)
    return query ? sorted.filter((p) => p.displayName.toLowerCase().replace(/ё/g, 'е').includes(query)) : sorted
  }, [players, cityFilter, who, order, query, openedAt])
  // Place numbers only mean something in the rating order, over the whole list.
  const numbered = order === 'rating' && !query

  return (
    <>
      <div className="search-row" style={{ marginTop: 4 }}>
        <input
          className="search-input"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setShown(PAGE)
          }}
          placeholder={tn('players.search')}
          enterKeyHint="search"
        />
        <PlayersFilter
          who={who}
          city={cityFilter}
          onWho={(w) => {
            setWho(w)
            setShown(PAGE)
          }}
          onCity={(c) => {
            setCityFilter(c)
            setShown(PAGE)
          }}
        />
      </div>
      <div className="filter-row with-sort">
        <span className="players-count">{isLoading ? ' ' : `${list.length} ${tn('plural.player', { count: list.length })}`}</span>
        <SortMenu
          value={order}
          options={ORDER_LABEL}
          onChange={(o) => {
            setOrder(o)
            setShown(PAGE)
          }}
          label={tn('players.orderLabel')}
        />
      </div>

      {isLoading ? (
        <SkeletonRows count={6} thumb={40} round />
      ) : list.length === 0 ? (
        <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>{query ? tn('players.nobody') : tn('players.none')}</div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            {list.slice(0, shown).map((p, i, visible) => (
              <button
                key={p.id}
                className="terr-list-item"
                style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--line)' : 'none' }}
                onClick={() => onOpenUser(p.id)}
              >
                {numbered && <div className="rating-list-rank">{i + 1}</div>}
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 12.5 }}>
                  {p.avatarUrl ? <img src={thumbUrl(p.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : p.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {p.clanCrest != null && <ClanCrest crest={p.clanCrest} size={16} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{CITIES[p.city].name}</div>
                </div>
                <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--accent)' }}>
                    {p.territoriesCount} {pluralSectors(p.territoriesCount)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>
                    {p.catchesCount} {pluralCatches(p.catchesCount)}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {shown < list.length && (
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => setShown((n) => n + PAGE)}>
              {tn('players.more')}
            </button>
          )}
        </>
      )}
    </>
  )
}

// The funnel button at the end of the search box: who to show and from which
// city, in one small card. A dot on the button while anything is narrowed.
function PlayersFilter({ who, city, onWho, onCity }: { who: Who; city: CityFilter; onWho: (w: Who) => void; onCity: (c: CityFilter) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const active = who !== 'all' || city !== 'all'
  return (
    <div className="sort-menu players-filter" ref={rootRef}>
      <button type="button" className={`players-filter-btn tap-scale${active ? ' on' : ''}`} aria-haspopup="listbox" aria-expanded={open} aria-label={tn('players.filterLabel')} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {active && <span className="players-filter-dot" />}
      </button>
      {open && (
        <div className="sort-menu-list players-filter-list" role="listbox" aria-label={tn('players.filterLabel')}>
          <div className="players-filter-title">{tn('players.who')}</div>
          {(Object.keys(WHO_LABEL) as Who[]).map((key) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={key === who}
              className={`sort-menu-opt${key === who ? ' on' : ''}`}
              onClick={() => {
                onWho(key)
                setOpen(false)
              }}
            >
              {WHO_LABEL[key]}
            </button>
          ))}
          <div className="players-filter-title">{tn('players.city')}</div>
          {(['all', ...CITY_LIST.map((c) => c.id)] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={key === city}
              className={`sort-menu-opt${key === city ? ' on' : ''}`}
              onClick={() => {
                onCity(key)
                setOpen(false)
              }}
            >
              {key === 'all' ? tn('players.allCities') : CITIES[key].name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
