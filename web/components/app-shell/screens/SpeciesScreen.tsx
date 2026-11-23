'use client'

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cityForSectorId, type CityId } from '@/lib/data/city'
import { CATEGORIES_BY_CITY, CATEGORY_LABEL, speciesBaseKey, speciesOfCity, type SpeciesCategory } from '@/lib/data/species'
import { speciesImageUrl } from '@/lib/data/speciesImages'
import { SwimmingFish } from '@/components/app-shell/SwimmingFish'
import { formatWeightGrams, speciesBreakdown, type SpeciesEntry } from '@/lib/format'
import { currentLocale, tn } from '@/lib/i18n/runtime'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useCatchesByUser, useProfile, useSpecies } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { useI18n } from '@/lib/i18n'
import { shareSpeciesStory } from '@/lib/story'
import { BackButton } from '@/components/app-shell/BackButton'
import { SkeletonBlock } from '@/components/app-shell/Skeleton'

// «Виды рыб» — one player's fish collection as an album: the fish they catch
// most drawn big on a patch of water with how much of the city's list they
// have, three numbers, their fish as cards with the drawings, and the fish
// still to catch as dark silhouettes of the same drawings. A screen of its
// own (was a modal until 20.11.2026), pushed from the own or someone else's
// profile; fetches that player's catches itself (cached by the profile).
// One card per fish, whatever the city (speciesBreakdown / speciesBaseKey).

const CATEGORY_COLOR: Record<SpeciesCategory, string> = {
  marine: '#1E8FB5',
  freshwater: '#2E9B73',
  predator: '#E0592A',
  peaceful: '#5BA03A',
}
type Sort = 'count' | 'size' | 'recent'

const dateOf = (iso: string, year = true) =>
  new Date(iso).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })

function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

// The count runs up from zero as the screen opens (once; later changes show at once).
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0)
  const done = useRef(false)
  useEffect(() => {
    if (done.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    const start = performance.now() + 140
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 750))
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
      else done.current = true
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{shown}</>
}

// The drawing, or a quiet outline for a fish without one yet.
// `swim`: the big fish of the hero swims in place (SwimmingFish); the fish in the grid stay still.
function FishArt({ speciesKey, className, hd = false, swim = false }: { speciesKey: string; className: string; hd?: boolean; swim?: boolean }) {
  const src = speciesImageUrl(speciesKey, hd)
  if (src && swim) return <SwimmingFish src={src} className={className} />
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- small static webp from /public/fish
    return <img className={className} src={src} alt="" loading="lazy" decoding="async" />
  }
  return (
    <span className={`${className} spx-art-none`} aria-hidden>
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M4 12c6-8 18-9 28-3l10-5v16l-10-5C22 21 10 20 4 12z" />
        <circle cx="12" cy="11" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

export function SpeciesScreen({
  userId,
  city,
  onBack,
  onOpenCatch,
  onOpenCatches,
  onToast,
}: {
  userId: string
  // The city the screens are showing: its fish are the collection.
  city: CityId
  onBack: () => void
  onOpenCatch: (catchId: number) => void
  // The «Уловов» tile: the player's catches list («Мои уловы» for the own one).
  onOpenCatches: () => void
  onToast: (msg: string) => void
}) {
  const { user } = useAuth()
  const { lang } = useI18n()
  const { data: profile } = useProfile(userId)
  const isMe = user?.id === userId
  const [sharing, setSharing] = useState(false)
  const { data: catches = [], isPending } = useCatchesByUser(userId)
  const { data: allSpecies = [] } = useSpecies()
  const species = useMemo(() => speciesBreakdown(catches), [catches])
  const [sort, setSort] = useState<Sort>('count')
  const [category, setCategory] = useState<SpeciesCategory | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  // The card whose details are fading away: kept a moment, lifted out of the
  // grid (absolute, where it stood), so the cards below glide up at once.
  const [closing, setClosing] = useState<{ key: string; top: number } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggle = (key: string) => {
    snapPlaces()
    if (closeTimer.current) clearTimeout(closeTimer.current)
    const panel = open ? gridRef.current?.querySelector<HTMLElement>(`[data-flip="d-${open}"]`) : null
    setClosing(open && panel ? { key: open, top: panel.offsetTop } : null)
    setOpen(open === key ? null : key)
    closeTimer.current = setTimeout(() => setClosing(null), 220)
  }

  const totalCatches = catches.length
  const maxCount = Math.max(1, ...species.map((s) => s.count))

  // The collection is the fish of the city on screen (see speciesOfCity); a category of another
  // city the player has caught a fish of joins whole (a pike in Moscow brings all of Moscow's
  // «Хищная»), and any other caught fish (since moved out of the list) joins on its own.
  // One entry per fish (okun and okun_msk are one «Окунь»).
  const collection = useMemo(() => {
    const caught = new Set(species.map((s) => s.key))
    const seen = new Set<string>()
    const once = <T extends { key: string }>(s: T) => {
      const base = speciesBaseKey(s.key)
      if (seen.has(base)) return false
      seen.add(base)
      return true
    }
    const ofCity = speciesOfCity(allSpecies, city).filter(once)
    const own = CATEGORIES_BY_CITY[city] as string[]
    const joined = new Set<string>()
    const ofOthers: typeof allSpecies = []
    for (const c of catches) {
      const where = cityForSectorId(c.territoryId)
      const tag = `${where}:${c.speciesCategory}`
      if (own.includes(c.speciesCategory) || joined.has(tag) || !(CATEGORIES_BY_CITY[where] as string[]).includes(c.speciesCategory)) continue
      joined.add(tag)
      ofOthers.push(...speciesOfCity(allSpecies, where).filter((s) => s.category === c.speciesCategory))
    }
    return [...ofCity, ...ofOthers.filter(once), ...allSpecies.filter((s) => caught.has(speciesBaseKey(s.key))).filter(once)]
  }, [allSpecies, species, catches, city])
  const caughtKeys = useMemo(() => new Set(species.map((s) => s.key)), [species])
  const missing = collection.filter((s) => !caughtKeys.has(speciesBaseKey(s.key)))
  const total = collection.length ? Math.max(collection.length, species.length) : species.length

  const biggest = useMemo(() => species.reduce<SpeciesEntry | null>((best, s) => (s.bestLengthCm && (!best || s.bestLengthCm > (best.bestLengthCm ?? 0)) ? s : best), null), [species])
  const favourite = species[0] ?? null
  // The fish that joined the collection last.
  const newest = useMemo(() => species.reduce<SpeciesEntry | null>((n, s) => (!n || s.firstAt > n.firstAt ? s : n), null), [species])

  // Each category: how many of its fish are caught, of how many in the collection. A caught fish counts in the
  // category it was caught under (its card's), one not yet caught in its own.
  const byCategory = useMemo(() => {
    const caughtCat = new Map(species.map((s) => [speciesBaseKey(s.key), s.category]))
    const m = new Map<SpeciesCategory, { caught: number; of: number }>()
    const add = (c: SpeciesCategory, caught: boolean) => {
      const v = m.get(c) ?? { caught: 0, of: 0 }
      v.of++
      if (caught) v.caught++
      m.set(c, v)
    }
    for (const s of collection) {
      const base = speciesBaseKey(s.key)
      const c = caughtCat.get(base)
      add(c ?? (s.category as SpeciesCategory), !!c)
    }
    // Every category, the ones with nothing caught yet too («Пресноводная 0/12»): most caught first.
    return [...m.entries()].sort((a, b) => b[1].caught - a[1].caught || b[1].of - a[1].of)
  }, [species, collection])

  // The fish still to catch, of the picked category only when one is picked (counted there in byCategory too).
  const shownMissing = category ? missing.filter((s) => s.category === category) : missing

  const rows = useMemo(() => {
    const list = category ? species.filter((s) => s.category === category) : species.slice()
    if (sort === 'size') list.sort((a, b) => (b.bestLengthCm ?? 0) - (a.bestLengthCm ?? 0) || (b.bestWeightKg ?? 0) - (a.bestWeightKg ?? 0))
    else if (sort === 'recent') list.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
    return list
  }, [species, sort, category])


  // Cards glide to their new places (a new sort, a category, a details panel
  // opening or closing above them) instead of jumping. Only transforms move:
  // the layout changes at once, and each moved card is slid from where it was
  // seen on the screen just before (snapPlaces, taken by the tap itself — so a
  // card caught mid-glide carries on from where it is, and a render that moved
  // nothing animates nothing). Nothing animates the layout itself: on iPhone a
  // panel growing frame by frame shook every card under it.
  const gridRef = useRef<HTMLDivElement>(null)
  // The cards' rise-in plays once, when the screen opens: re-sorting moves the
  // card elements, and a moved element would replay it (cards blinking out).
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 1700)
    return () => clearTimeout(t)
  }, [])
  const placesRef = useRef<Map<string, { x: number; y: number }> | null>(null)
  const flipEls = () => (gridRef.current ? (Array.from(gridRef.current.querySelectorAll(':scope > [data-flip]')) as HTMLElement[]) : [])
  function snapPlaces() {
    const grid = gridRef.current
    if (!grid) return
    const g = grid.getBoundingClientRect()
    const map = new Map<string, { x: number; y: number }>()
    for (const el of flipEls()) {
      const r = el.getBoundingClientRect()
      map.set(el.dataset.flip!, { x: r.left - g.left, y: r.top - g.top })
    }
    placesRef.current = map
  }
  useLayoutEffect(() => {
    const was = placesRef.current
    const grid = gridRef.current
    placesRef.current = null
    if (!was || !grid) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const els = flipEls()
    // Glides still running are stopped first, so the new places are measured without them.
    for (const el of els) for (const a of el.getAnimations()) if (a.id === 'flip') a.cancel()
    const g = grid.getBoundingClientRect()
    for (const el of els) {
      const from = was.get(el.dataset.flip!)
      if (!from || el.classList.contains('closing')) continue
      const r = el.getBoundingClientRect()
      const dx = from.x - (r.left - g.left)
      const dy = from.y - (r.top - g.top)
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', id: 'flip' })
    }
  })

  // «В историю»: the collection as a picture in our style (app/api/species-story).
  async function shareStory() {
    setSharing(true)
    const result = await shareSpeciesStory(userId, city, lang, tn('spc.storyCaption', { count: species.length, total }), profile?.publicId ?? null, `${species.length}-${totalCatches}`)
    setSharing(false)
    if (result === 'downloaded') onToast(tn('story.downloaded'))
    if (result === 'failed') onToast(tn('story.failed'))
  }
  const pickCategory = (c: SpeciesCategory) => {
    snapPlaces()
    setClosing(null)
    setCategory(category === c ? null : c)
    setOpen(null)
  }

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{tn('weekly.speciesTitle')}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner spx">
        {isPending ? (
          <>
            <SkeletonBlock height={212} radius={26} />
            <div className="spx-tiles" style={{ marginTop: 12 }}>
              <SkeletonBlock height={74} radius={16} />
              <SkeletonBlock height={74} radius={16} />
              <SkeletonBlock height={74} radius={16} />
            </div>
          </>
        ) : species.length === 0 ? (
          <div className="spx-hero spx-hero--empty">
            <div className="spx-hero-kicker">{tn('spc.collection')}</div>
            <div className="spx-hero-count">
              <b>0</b>
              <span>{tn('spc.ofTotal', { total })}</span>
            </div>
            <p className="spx-hero-empty">{tn('weekly.noCatches')}</p>
          </div>
        ) : (
          <>
            {/* The collection on a patch of water: how much of it, by category, and the fish caught most. */}
            <section className="spx-hero">
              {/* A few bubbles rising through the water. */}
              <span className="spx-bubbles" aria-hidden>
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              {/* Light coming down through the water. */}
              <span className="spx-rays" aria-hidden />
              {favourite && (
                // The fish caught most, big, swimming out past the right edge (only ~70% of it shows).
                // Not a button: tapping the hero opens nothing (owner's call, 20.11.2026). The fish glides in
                // once as the screen opens and then swims in place (owner's call 23.11.2026, was still before);
                // the light behind it breathes.
                <div className="spx-hero-fav" aria-hidden>
                  <span className="spx-hero-glow" />
                  <FishArt speciesKey={favourite.key} className="spx-hero-fish" hd swim />
                </div>
              )}
              <div className="spx-hero-top">
                <div className="spx-hero-text">
                  <div className="spx-hero-kicker spx-up" style={{ ['--d' as string]: '80ms' }}>
                    {tn('spc.collection')}
                  </div>
                  <div className="spx-hero-count">
                    <b className="spx-up" style={{ ['--d' as string]: '140ms' }}>
                      <CountUp value={species.length} />
                    </b>
                    <span className="spx-up" style={{ ['--d' as string]: '220ms' }}>
                      {tn('spc.ofTotal', { total })}
                    </span>
                  </div>
                  {favourite && (
                    <div className="spx-hero-fav-label spx-up" style={{ ['--d' as string]: '300ms' }}>
                      <span>{tn('spc.favourite')}</span>
                      <b>
                        {favourite.name} <i>×{favourite.count}</i>
                      </b>
                    </div>
                  )}
                </div>
              </div>
              {/* The categories: caught of the collection, each a filter for the cards below. */}
              <div className={`spx-cats${byCategory.length === 1 ? ' one' : ''}${category ? ' picked' : ''}`} role="group">
                {byCategory.map(([c, v], i) => (
                  <button
                    key={c}
                    className={`spx-cat spx-up${category === c ? ' on' : ''}`}
                    style={{ ['--d' as string]: `${360 + i * 70}ms`, ['--c' as string]: CATEGORY_COLOR[c] }}
                    onClick={() => pickCategory(c)}
                    aria-pressed={category === c}
                  >
                    <span className="spx-cat-top">
                      <span className="spx-cat-name">
                        <i />
                        {CATEGORY_LABEL[c]}
                      </span>
                      <span className="spx-cat-num">
                        <b>{v.caught}</b>/{v.of}
                      </span>
                    </span>
                    <span className="spx-cat-bar">
                      <i style={{ width: `${v.caught ? Math.max(4, (v.caught / Math.max(1, v.of)) * 100) : 0}%`, ['--d' as string]: `${520 + i * 70}ms` }} />
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <div className="spx-tiles">
              <button className="spx-tile spx-up" style={{ ['--d' as string]: '420ms' }} onClick={onOpenCatches}>
                <span>{tn('spc.catches')}</span>
                <b>{totalCatches}</b>
              </button>
              <button className="spx-tile spx-up" style={{ ['--d' as string]: '480ms' }} onClick={() => biggest && onOpenCatch(biggest.bestCatchId)} disabled={!biggest}>
                <span>{tn('spc.biggest')}</span>
                <b>{biggest ? `${biggest.bestLengthCm} ${tn('fmt.cm')}` : '—'}</b>
                {biggest && <em>{biggest.name}</em>}
              </button>
              <button className="spx-tile spx-up" style={{ ['--d' as string]: '540ms' }} onClick={() => newest && onOpenCatch(newest.firstCatchId)} disabled={!newest}>
                <span>{tn('spc.newest')}</span>
                <b className="spx-tile-name">{newest?.name ?? '—'}</b>
                {newest && <em>{dateOf(newest.firstAt, false)}</em>}
              </button>
            </div>

            <div className="spx-sorts spx-up" style={{ ['--d' as string]: '600ms' }} role="tablist">
              {(['count', 'size', 'recent'] as const).map((k) => (
                <button key={k} role="tab" aria-selected={sort === k} className={sort === k ? 'on' : undefined} onClick={() => {
                  snapPlaces()
                  setSort(k)
                }}>
                  {tn(k === 'count' ? 'spc.sortCount' : k === 'size' ? 'spc.sortSize' : 'spc.sortRecent')}
                </button>
              ))}
            </div>

            {/* Caught fish: a card each. A tap keeps the card in its place and
                unfolds its details in a panel under its row (an arrow points
                at it); a second tap folds it away. */}
            <div className={`spx-grid${entering ? ' entering' : ''}`} ref={gridRef}>
              {rows.map((s, i) => {
                const isOpen = open === s.key
                // The details go right after the card's row: after it on the right, after its neighbour on the left.
                const panelsHere = [open, closing?.key ?? null].filter((k, n, all) => {
                  if (!k || all.indexOf(k) !== n) return false
                  const at = rows.findIndex((r) => r.key === k)
                  if (at < 0) return false
                  return (at % 2 === 0 ? Math.min(at + 1, rows.length - 1) : at) === i
                })
                return (
                  <Fragment key={s.key}>
                    <div
                      data-flip={s.key}
                      className={`spx-card spx-card--${s.category}${isOpen ? ' on' : ''}`}
                      style={{ animationDelay: `${640 + Math.min(i, 12) * 35}ms`, ['--c' as string]: CATEGORY_COLOR[s.category] }}
                    >
                      <button className="spx-card-head" onClick={() => toggle(s.key)} aria-expanded={isOpen}>
                        <span className="spx-card-art">
                          <FishArt speciesKey={s.key} className="spx-card-fish" />
                        </span>
                        <span className="spx-card-body">
                          <span className="spx-card-name">{s.name}</span>
                          <span className="spx-card-meta">
                            <b>×{s.count}</b>
                            {s.bestLengthCm ? <span>{`${s.bestLengthCm} ${tn('fmt.cm')}`}</span> : null}
                          </span>
                          <span className="spx-card-bar">
                            <i style={{ transform: `scaleX(${s.count / maxCount})` }} />
                          </span>
                        </span>
                      </button>
                    </div>
                    {panelsHere.map((k) => {
                      const d = rows.find((r) => r.key === k)!
                      const at = rows.indexOf(d)
                      return (
                        <div
                          key={`d-${k}`}
                          data-flip={`d-${k}`}
                          className={`spx-detail${k === open ? '' : ' closing'}`}
                          style={{ ['--arrow' as string]: at % 2 === 0 ? '25%' : '75%', top: k === open ? undefined : closing?.top }}
                        >
                          <div className="spx-detail-in">
                            <div className="spx-detail-card">
                              <div className="spx-facts">
                                {d.photoUrl && (
                                  <button className="spx-photo" onClick={() => onOpenCatch(d.lastCatchId)} aria-label={tn('spc.openLast')}>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- catch thumbnail, same as the profile's catch rows */}
                                    <img src={thumbUrl(d.photoUrl, 200)} alt="" loading="lazy" decoding="async" />
                                  </button>
                                )}
                                <dl>
                                  <div>
                                    <dt>{tn('spc.recLen')}</dt>
                                    <dd>{d.bestLengthCm ? `${d.bestLengthCm} ${tn('fmt.cm')}` : '—'}</dd>
                                  </div>
                                  <div>
                                    <dt>{tn('spc.recWeight')}</dt>
                                    <dd>{d.bestWeightKg ? `${formatWeightGrams(d.bestWeightKg)} ${tn('fmt.g')}` : '—'}</dd>
                                  </div>
                                  <div>
                                    <dt>{tn('spc.first')}</dt>
                                    <dd>{dateOf(d.firstAt)}</dd>
                                  </div>
                                  <div>
                                    <dt>{tn('spc.last')}</dt>
                                    <dd>{dateOf(d.lastAt)}</dd>
                                  </div>
                                </dl>
                              </div>
                              <div className="spx-share">
                                {d.name} · {CATEGORY_LABEL[d.category]} · {tn('spc.share', { percent: Math.max(1, Math.round((d.count / Math.max(1, totalCatches)) * 100)) })}
                              </div>
                              <div className="spx-actions">
                                <button onClick={() => onOpenCatch(d.lastCatchId)}>{tn('spc.openLast')}</button>
                                {d.bestCatchId !== d.lastCatchId && <button onClick={() => onOpenCatch(d.bestCatchId)}>{tn('spc.openBest')}</button>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </Fragment>
                )
              })}
            </div>

            {/* «Поделиться коллекцией в истории» — after all the caught fish (owner's call, 20.11.2026). */}
            {isMe && (
              <button className="story-btn big spx-story" disabled={sharing} onClick={() => void shareStory()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" strokeDasharray="4 2.6" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                {sharing ? tn('story.preparing') : tn('spc.storyButton')}
              </button>
            )}
          </>
        )}

        {/* Still to catch: the same drawings as dark silhouettes, like empty places in an album. */}
        {/* A category picked above narrows them too: «Пресноводная 0/12» shows its twelve still to catch. */}
        {!isPending && collection.length > 0 && !(category && shownMissing.length === 0) && (
          <section className="spx-missing">
            {shownMissing.length === 0 ? (
              <div className="spx-done">{tn('spc.allCaught')}</div>
            ) : (
              <>
                <div className="spx-missing-head">
                  <span>{tn('spc.missing', { count: shownMissing.length })}</span>
                </div>
                <div className="spx-ghosts">
                  {shownMissing.map((m) => (
                    <div key={m.key} className="spx-ghost">
                      <span className="spx-ghost-art">
                        <FishArt speciesKey={m.key} className="spx-ghost-fish" />
                        <span className="spx-ghost-lock">
                          <LockIcon size={10} />
                        </span>
                      </span>
                      <span className="spx-ghost-name">{m.name}</span>
                    </div>
                  ))}
                </div>
                <div className="spx-hint">{tn('spc.missingHint')}</div>
              </>
            )}
          </section>
        )}
      </div>
    </>
  )
}
