'use client'

import { useMemo, useState } from 'react'
import type { CityId } from '@/lib/data/city'
import { CATEGORY_LABEL, speciesOfCity, type SpeciesCategory } from '@/lib/data/species'
import { formatWeightGrams, type SpeciesEntry } from '@/lib/format'
import { currentLocale, tn } from '@/lib/i18n/runtime'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useSpecies } from '@/lib/supabase/queries'

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// `.screen-inner` — same clipping reasoning as every other app-shell-level
// modal (see DECISIONS.md). The breakdown is already computed by the caller
// (see speciesBreakdown) from a catches list it already has loaded; the
// species table (cached, read by the catch form too) only gives the size of
// the whole collection and the names still missing from it.

const CATEGORY_COLOR: Record<SpeciesCategory, string> = {
  marine: '#1E8FB5',
  freshwater: '#2E9B73',
  predator: '#E0592A',
  peaceful: '#5BA03A',
}
type Sort = 'count' | 'size' | 'recent'

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric' })

export function SpeciesListModal({
  species,
  city,
  onClose,
  onOpenCatch,
}: {
  species: SpeciesEntry[]
  // The city the screens are showing: its fish are the collection.
  city: CityId
  onClose: () => void
  onOpenCatch: (catchId: number) => void
}) {
  const { data: allSpecies = [] } = useSpecies()
  const [sort, setSort] = useState<Sort>('count')
  const [category, setCategory] = useState<SpeciesCategory | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [showMissing, setShowMissing] = useState(false)

  const totalCatches = species.reduce((sum, s) => sum + s.count, 0)
  const maxCount = Math.max(1, ...species.map((s) => s.count))

  // The collection is the species of the city on screen (see speciesOfCity), plus any
  // other fish the player has caught, in another city or since moved out of the list.
  const collection = useMemo(() => {
    const caught = new Set(species.map((s) => s.key))
    const ofCity = speciesOfCity(allSpecies, city)
    const inCity = new Set(ofCity.map((s) => s.key))
    return [...ofCity, ...allSpecies.filter((s) => caught.has(s.key) && !inCity.has(s.key))]
  }, [allSpecies, species, city])
  const caughtKeys = useMemo(() => new Set(species.map((s) => s.key)), [species])
  const missing = collection.filter((s) => !caughtKeys.has(s.key))
  const total = collection.length ? Math.max(collection.length, species.length) : species.length

  const biggest = useMemo(() => species.reduce<SpeciesEntry | null>((best, s) => (s.bestLengthCm && (!best || s.bestLengthCm > (best.bestLengthCm ?? 0)) ? s : best), null), [species])
  const favourite = species[0] ?? null

  const byCategory = useMemo(() => {
    const m = new Map<SpeciesCategory, number>()
    for (const s of species) m.set(s.category, (m.get(s.category) ?? 0) + 1)
    return [...m.entries()]
  }, [species])

  const rows = useMemo(() => {
    const list = category ? species.filter((s) => s.category === category) : species.slice()
    if (sort === 'size') list.sort((a, b) => (b.bestLengthCm ?? 0) - (a.bestLengthCm ?? 0) || (b.bestWeightKg ?? 0) - (a.bestWeightKg ?? 0))
    else if (sort === 'recent') list.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
    return list
  }, [species, sort, category])

  const pct = species.length && total ? Math.min(100, (species.length / total) * 100) : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card modal-card-wide sp-card${species.length ? " sp-card--fixed" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          {tn('weekly.speciesTitle')}
        </div>

        {species.length === 0 ? (
          <div className="sp-empty">{tn('weekly.noCatches')}</div>
        ) : (
          <div className="sp-scroll">
            <div className="sp-hero">
              <div className="sp-ring" style={{ ['--p' as string]: pct }}>
                <svg viewBox="0 0 80 80" aria-hidden>
                  <circle className="sp-ring-bg" cx="40" cy="40" r="34" pathLength={100} />
                  <circle className="sp-ring-fg" cx="40" cy="40" r="34" pathLength={100} />
                </svg>
                <div className="sp-ring-num">
                  <b>{species.length}</b>
                  <span>{tn('spc.collected')}</span>
                </div>
              </div>
              <div className="sp-hero-side">
                <div className="sp-hero-total">{tn('spc.ofTotal', { total })}</div>
                {byCategory.length > 0 && (
                  <>
                    <div className="sp-stack" role="group">
                      {byCategory.map(([c, n]) => (
                        <button
                          key={c}
                          className={`sp-seg${category === c ? ' on' : ''}${category && category !== c ? ' dim' : ''}`}
                          style={{ flexGrow: n, background: CATEGORY_COLOR[c] }}
                          onClick={() => setCategory(category === c ? null : c)}
                          aria-label={CATEGORY_LABEL[c]}
                        />
                      ))}
                    </div>
                    <div className="sp-legend">
                      {byCategory.map(([c, n]) => (
                        <button key={c} className={`sp-leg${category === c ? ' on' : ''}`} onClick={() => setCategory(category === c ? null : c)}>
                          <i style={{ background: CATEGORY_COLOR[c] }} />
                          {CATEGORY_LABEL[c]} · {n}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="sp-tiles">
              <div className="sp-tile">
                <span>{tn('spc.catches')}</span>
                <b>{totalCatches}</b>
              </div>
              <button className="sp-tile" onClick={() => biggest && onOpenCatch(biggest.bestCatchId)} disabled={!biggest}>
                <span>{tn('spc.biggest')}</span>
                <b>{biggest ? `${biggest.bestLengthCm} ${tn('fmt.cm')}` : '—'}</b>
                {biggest && <em>{biggest.name}</em>}
              </button>
              <button className="sp-tile" onClick={() => favourite && onOpenCatch(favourite.lastCatchId)} disabled={!favourite}>
                <span>{tn('spc.favourite')}</span>
                <b>×{favourite?.count ?? 0}</b>
                {favourite && <em>{favourite.name}</em>}
              </button>
            </div>

            <div className="sp-sorts" role="tablist">
              {(['count', 'size', 'recent'] as const).map((k) => (
                <button key={k} role="tab" aria-selected={sort === k} className={`sp-sort${sort === k ? ' on' : ''}`} onClick={() => setSort(k)}>
                  {tn(k === 'count' ? 'spc.sortCount' : k === 'size' ? 'spc.sortSize' : 'spc.sortRecent')}
                </button>
              ))}
            </div>

            <div className="sp-list">
              {rows.map((s, i) => {
                const isOpen = open === s.key
                return (
                  <div key={s.key} className={`sp-row${isOpen ? ' open' : ''}`} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                    <button className="sp-row-head tap-scale" onClick={() => setOpen(isOpen ? null : s.key)} aria-expanded={isOpen}>
                      <i className="sp-dot" style={{ background: CATEGORY_COLOR[s.category] }} />
                      <span className="sp-row-main">
                        <span className="sp-name">{s.name}</span>
                        <span className="sp-bar">
                          <span style={{ transform: `scaleX(${s.count / maxCount})`, background: CATEGORY_COLOR[s.category], animationDelay: `${Math.min(i, 10) * 30 + 80}ms` }} />
                        </span>
                      </span>
                      <span className="sp-count">×{s.count}</span>
                      <svg className="sp-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <div className="sp-more">
                      <div className="sp-more-in">
                        <div className="sp-facts">
                          {s.photoUrl && <img className="sp-photo" src={thumbUrl(s.photoUrl, 160)} alt="" loading="lazy" decoding="async" />}
                          <dl>
                            <div>
                              <dt>{tn('spc.recLen')}</dt>
                              <dd>{s.bestLengthCm ? `${s.bestLengthCm} ${tn('fmt.cm')}` : '—'}</dd>
                            </div>
                            <div>
                              <dt>{tn('spc.recWeight')}</dt>
                              <dd>{s.bestWeightKg ? `${formatWeightGrams(s.bestWeightKg)} ${tn('fmt.g')}` : '—'}</dd>
                            </div>
                            <div>
                              <dt>{tn('spc.first')}</dt>
                              <dd>{dateOf(s.firstAt)}</dd>
                            </div>
                            <div>
                              <dt>{tn('spc.last')}</dt>
                              <dd>{dateOf(s.lastAt)}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="sp-share">{tn('spc.share', { percent: Math.max(1, Math.round((s.count / totalCatches) * 100)) })}</div>
                        <div className="sp-actions">
                          <button className="sp-act" onClick={() => onOpenCatch(s.lastCatchId)}>
                            {tn('spc.openLast')}
                          </button>
                          {s.bestCatchId !== s.lastCatchId && (
                            <button className="sp-act" onClick={() => onOpenCatch(s.bestCatchId)}>
                              {tn('spc.openBest')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {collection.length > 0 && (
              <div className="sp-missing">
                {missing.length === 0 ? (
                  <div className="sp-done">{tn('spc.allCaught')}</div>
                ) : (
                  <>
                    <button className={`sp-missing-head${showMissing ? ' open' : ''}`} onClick={() => setShowMissing((v) => !v)} aria-expanded={showMissing}>
                      {tn('spc.missing', { count: missing.length })}
                      <svg className="sp-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <div className={`sp-more${showMissing ? ' show' : ''}`}>
                      <div className="sp-more-in">
                        <div className="sp-ghosts">
                          {missing.map((m) => (
                            <span key={m.key} className="sp-ghost">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <rect x="5" y="11" width="14" height="9" rx="2" />
                                <path d="M8 11V8a4 4 0 018 0v3" />
                              </svg>
                              {m.name}
                            </span>
                          ))}
                        </div>
                        <div className="sp-hint">{tn('spc.missingHint')}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
