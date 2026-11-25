'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SkeletonRows } from '@/components/app-shell/Skeleton'
import { SortMenu } from '@/components/app-shell/SortMenu'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAllPlayers } from '@/lib/supabase/queries'
import { pluralCatches, pluralSectors } from '@/lib/format'
import type { CityPlayer } from '@/lib/data/types'
import { CITIES, launchedCountries, type CityId, type CountryId } from '@/lib/data/city'
import { Flag } from '@/components/app-shell/Flag'
import type { TKey } from '@/lib/i18n/core'
import { currentLocale, labels, tn } from '@/lib/i18n/runtime'
import { nameInitials } from '@/lib/initials'

type Order = 'rating' | 'catches' | 'name'
type CityFilter = 'all' | CityId
type CountryFilter = 'all' | CountryId
// Who to show: everyone, only those outside a clan (to invite them), only
// clan members, only players who hold sectors, only the newly joined.
type Who = 'all' | 'solo' | 'clan' | 'holders' | 'new'
// By catches (all time): any, none yet, at least one, at least 10, at least 50.
type Fished = 'all' | 'none' | 'some' | 'ten' | 'fifty'

const ORDER_LABEL = labels('playersOrder', ['rating', 'catches', 'name'] as const)
const WHO_LABEL = labels('playersWho', ['all', 'solo', 'clan', 'holders', 'new'] as const)
const FISHED_LABEL = labels('playersCatches', ['all', 'none', 'some', 'ten', 'fifty'] as const)
const FISHED_MIN: Record<Fished, (n: number) => boolean> = {
  all: () => true,
  none: (n) => n === 0,
  some: (n) => n > 0,
  ten: (n) => n >= 10,
  fifty: (n) => n >= 50,
}
const NEW_DAYS = 14

const BY_RATING = (a: CityPlayer, b: CityPlayer) =>
  b.territoriesCount - a.territoriesCount || b.catchesCount - a.catchesCount || a.displayName.localeCompare(b.displayName, currentLocale())
// «По уловам» (24.11.2026): all-time catches, then sectors, then name.
const BY_CATCHES = (a: CityPlayer, b: CityPlayer) =>
  b.catchesCount - a.catchesCount || b.territoriesCount - a.territoriesCount || a.displayName.localeCompare(b.displayName, currentLocale())
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
  // Country first, then one of its cities (24.11.2026).
  const [country, setCountry] = useState<CountryFilter>('all')
  const [who, setWho] = useState<Who>('all')
  const [fished, setFished] = useState<Fished>('all')
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
    const sorted = players.filter((p) => (country === 'all' || CITIES[p.city].country === country) && (cityFilter === 'all' || p.city === cityFilter) && matchesWho(p) && FISHED_MIN[fished](p.catchesCount)).sort(order === 'rating' ? BY_RATING : order === 'catches' ? BY_CATCHES : BY_NAME)
    return query ? sorted.filter((p) => p.displayName.toLowerCase().replace(/ё/g, 'е').includes(query)) : sorted
  }, [players, country, cityFilter, who, fished, order, query, openedAt])
  // Place numbers only mean something in a ranked order (rating, catches), over the whole list.
  const numbered = order !== 'name' && !query

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
          country={country}
          fished={fished}
          count={list.length}
          onFished={(x) => {
            setFished(x)
            setShown(PAGE)
          }}
          onWho={(w) => {
            setWho(w)
            setShown(PAGE)
          }}
          onCity={(c) => {
            setCityFilter(c)
            setShown(PAGE)
          }}
          onCountry={(c) => {
            setCountry(c)
            setCityFilter('all')
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
                  {p.avatarUrl ? <img src={thumbUrl(p.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : nameInitials(p.displayName, 2)}
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

// The funnel button at the end of the search box opens a bottom sheet (24.11.2026; was a long drop-down that ran
// under the bottom menu): who, catches and city as rows of chips, any of them at once, the list updating behind;
// «Сбросить» and «Показать N игроков» below. A dot on the button while anything is narrowed.
function PlayersFilter({
  who,
  city,
  country,
  fished,
  count,
  onWho,
  onCity,
  onCountry,
  onFished,
}: {
  who: Who
  city: CityFilter
  country: CountryFilter
  fished: Fished
  count: number
  onWho: (w: Who) => void
  onCity: (c: CityFilter) => void
  onCountry: (c: CountryFilter) => void
  onFished: (x: Fished) => void
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const active = who !== 'all' || city !== 'all' || country !== 'all' || fished !== 'all'
  const countries = launchedCountries()
  const chip = (on: boolean, label: string, pick: () => void, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`filter-chip${on ? ' active' : ''}`} onClick={pick}>
      {label}
    </button>
  )
  return (
    <div className="players-filter">
      <button type="button" className={`players-filter-btn tap-scale${active ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-label={tn('players.filterLabel')} onClick={() => setOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {active && <span className="players-filter-dot" />}
      </button>
      {open &&
        createPortal(
          <div className="move-sheet-overlay" onClick={() => setOpen(false)}>
            <div className="move-sheet players-filter-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={tn('players.filterLabel')}>
              <div className="move-sheet-handle" />
              <div className="move-head">
                <div className="move-title">{tn('players.filterTitle')}</div>
              </div>
              <div className="move-body">
                <div className="players-filter-title">{tn('players.who')}</div>
                <div className="players-filter-chips" role="radiogroup" aria-label={tn('players.who')}>
                  {(Object.keys(WHO_LABEL) as Who[]).map((key) => chip(key === who, WHO_LABEL[key], () => onWho(key), key))}
                </div>
                <div className="players-filter-title">{tn('players.catches')}</div>
                <div className="players-filter-chips" role="radiogroup" aria-label={tn('players.catches')}>
                  {(Object.keys(FISHED_LABEL) as Fished[]).map((key) => chip(key === fished, FISHED_LABEL[key], () => onFished(key), key))}
                </div>
                <div className="players-filter-title">{tn('players.country')}</div>
                {/* Countries as a list; the picked one opens its cities right under it (a smooth unfold, the sheet's
                    height stays — it no longer jumps when a country is picked). A one-city country opens nothing. */}
                <div className="pf-countries" role="radiogroup" aria-label={tn('players.country')}>
                  <button type="button" role="radio" aria-checked={country === 'all'} className={`pf-country-btn${country === 'all' ? ' on' : ''}`} onClick={() => onCountry('all')}>
                    <span className="pf-country-name">{tn('players.allCountries')}</span>
                  </button>
                  {countries.map((c) => {
                    const on = country === c.id
                    return (
                      <div key={c.id} className={`pf-country${on ? ' open' : ''}`}>
                        <button type="button" role="radio" aria-checked={on} className={`pf-country-btn${on ? ' on' : ''}`} onClick={() => onCountry(on ? 'all' : c.id)}>
                          <Flag country={c.id} height={14} />
                          <span className="pf-country-name">{tn(`country.${c.id}` as TKey)}</span>
                          <span className="pf-country-count">{tn('country.cities', { count: c.cities.length })}</span>
                        </button>
                        {c.cities.length > 1 && (
                          <div className="pf-country-cities" aria-hidden={!on}>
                            <div className="pf-country-cities-clip">
                              <div className="players-filter-chips pf-country-cities-in" role="radiogroup" aria-label={tn('players.city')}>
                                {chip(on && city === 'all', tn('players.allCities'), () => onCity('all'), 'all')}
                                {c.cities.map((x) => chip(on && city === x.id, x.name, () => onCity(x.id), x.id))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="players-filter-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!active}
                  onClick={() => {
                    onWho('all')
                    onFished('all')
                    onCountry('all')
                  }}
                >
                  {tn('players.reset')}
                </button>
                <button type="button" className="btn-primary" onClick={() => setOpen(false)}>
                  {tn('players.showCount', { count })} {tn('plural.player', { count })}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
