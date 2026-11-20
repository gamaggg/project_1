'use client'

import { useMemo, useState } from 'react'
import type { CityId } from '@/lib/data/city'
import { CATEGORY_LABEL, speciesBaseKey, speciesOfCity, type SpeciesCategory } from '@/lib/data/species'
import { speciesImageUrl } from '@/lib/data/speciesImages'
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

// The drawing, or a quiet outline for a fish without one yet.
function FishArt({ speciesKey, className }: { speciesKey: string; className: string }) {
  const src = speciesImageUrl(speciesKey)
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
  onToast,
}: {
  userId: string
  // The city the screens are showing: its fish are the collection.
  city: CityId
  onBack: () => void
  onOpenCatch: (catchId: number) => void
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

  const totalCatches = catches.length
  const maxCount = Math.max(1, ...species.map((s) => s.count))

  // The collection is the fish of the city on screen (see speciesOfCity), plus any
  // other fish the player has caught, in another city or since moved out of the list.
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
    return [...ofCity, ...allSpecies.filter((s) => caught.has(speciesBaseKey(s.key))).filter(once)]
  }, [allSpecies, species, city])
  const caughtKeys = useMemo(() => new Set(species.map((s) => s.key)), [species])
  const missing = collection.filter((s) => !caughtKeys.has(speciesBaseKey(s.key)))
  const total = collection.length ? Math.max(collection.length, species.length) : species.length

  const biggest = useMemo(() => species.reduce<SpeciesEntry | null>((best, s) => (s.bestLengthCm && (!best || s.bestLengthCm > (best.bestLengthCm ?? 0)) ? s : best), null), [species])
  const favourite = species[0] ?? null
  // The fish that joined the collection last.
  const newest = useMemo(() => species.reduce<SpeciesEntry | null>((n, s) => (!n || s.firstAt > n.firstAt ? s : n), null), [species])

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

  // «В историю»: the collection as a picture in our style (app/api/species-story).
  async function shareStory() {
    setSharing(true)
    const result = await shareSpeciesStory(userId, city, lang, tn('spc.storyCaption', { count: species.length, total }), profile?.publicId ?? null, `${species.length}-${totalCatches}`)
    setSharing(false)
    if (result === 'downloaded') onToast(tn('story.downloaded'))
    if (result === 'failed') onToast(tn('story.failed'))
  }
  const pickCategory = (c: SpeciesCategory) => {
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
              <div className="spx-hero-top">
                <div className="spx-hero-text">
                  <div className="spx-hero-kicker">{tn('spc.collection')}</div>
                  <div className="spx-hero-count">
                    <b>{species.length}</b>
                    <span>{tn('spc.ofTotal', { total })}</span>
                  </div>
                </div>
                {favourite && (
                  <button className="spx-hero-fav" onClick={() => onOpenCatch(favourite.lastCatchId)}>
                    <FishArt speciesKey={favourite.key} className="spx-hero-fish" />
                    <span className="spx-hero-fav-label">
                      {tn('spc.favourite')} · <b>{favourite.name}</b> ×{favourite.count}
                    </span>
                  </button>
                )}
              </div>
              <div className="spx-progress" aria-hidden>
                <span style={{ width: `${pct}%` }}>
                  {byCategory.map(([c, n]) => (
                    <i key={c} style={{ flexGrow: n, background: CATEGORY_COLOR[c], opacity: category && category !== c ? 0.3 : 1 }} />
                  ))}
                </span>
              </div>
              {byCategory.length > 1 && (
                <div className="spx-legend" role="group">
                  {byCategory.map(([c, n]) => (
                    <button key={c} className={`spx-leg${category === c ? ' on' : ''}`} onClick={() => pickCategory(c)} aria-pressed={category === c}>
                      <i style={{ background: CATEGORY_COLOR[c] }} />
                      {CATEGORY_LABEL[c]} · {n}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="spx-tiles">
              <div className="spx-tile">
                <span>{tn('spc.catches')}</span>
                <b>{totalCatches}</b>
              </div>
              <button className="spx-tile" onClick={() => biggest && onOpenCatch(biggest.bestCatchId)} disabled={!biggest}>
                <span>{tn('spc.biggest')}</span>
                <b>{biggest ? `${biggest.bestLengthCm} ${tn('fmt.cm')}` : '—'}</b>
                {biggest && <em>{biggest.name}</em>}
              </button>
              <button className="spx-tile" onClick={() => newest && onOpenCatch(newest.firstCatchId)} disabled={!newest}>
                <span>{tn('spc.newest')}</span>
                <b className="spx-tile-name">{newest?.name ?? '—'}</b>
                {newest && <em>{dateOf(newest.firstAt, false)}</em>}
              </button>
            </div>

            {isMe && (
              <button className="story-btn big spx-story" disabled={sharing} onClick={() => void shareStory()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" strokeDasharray="4 2.6" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                {sharing ? tn('story.preparing') : tn('spc.storyButton')}
              </button>
            )}

            <div className="spx-sorts" role="tablist">
              {(['count', 'size', 'recent'] as const).map((k) => (
                <button key={k} role="tab" aria-selected={sort === k} className={sort === k ? 'on' : undefined} onClick={() => setSort(k)}>
                  {tn(k === 'count' ? 'spc.sortCount' : k === 'size' ? 'spc.sortSize' : 'spc.sortRecent')}
                </button>
              ))}
            </div>

            {/* Caught fish: a card each; a tap opens it across both columns. */}
            <div className="spx-grid">
              {rows.map((s, i) => {
                const isOpen = open === s.key
                const color = CATEGORY_COLOR[s.category]
                return (
                  <div
                    key={s.key}
                    className={`spx-card spx-card--${s.category}${isOpen ? ' open' : ''}`}
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms`, ['--c' as string]: color }}
                  >
                    <button className="spx-card-head" onClick={() => setOpen(isOpen ? null : s.key)} aria-expanded={isOpen}>
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
                    {isOpen && (
                      <div className="spx-card-more">
                        <div className="spx-facts">
                          {s.photoUrl && (
                            <button className="spx-photo" onClick={() => onOpenCatch(s.lastCatchId)} aria-label={tn('spc.openLast')}>
                              {/* eslint-disable-next-line @next/next/no-img-element -- catch thumbnail, same as the profile's catch rows */}
                              <img src={thumbUrl(s.photoUrl, 200)} alt="" loading="lazy" decoding="async" />
                            </button>
                          )}
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
                        <div className="spx-share">
                          {CATEGORY_LABEL[s.category]} · {tn('spc.share', { percent: Math.max(1, Math.round((s.count / Math.max(1, totalCatches)) * 100)) })}
                        </div>
                        <div className="spx-actions">
                          <button onClick={() => onOpenCatch(s.lastCatchId)}>{tn('spc.openLast')}</button>
                          {s.bestCatchId !== s.lastCatchId && <button onClick={() => onOpenCatch(s.bestCatchId)}>{tn('spc.openBest')}</button>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Still to catch: the same drawings as dark silhouettes, like empty places in an album. */}
        {!isPending && collection.length > 0 && (
          <section className="spx-missing">
            {missing.length === 0 ? (
              <div className="spx-done">{tn('spc.allCaught')}</div>
            ) : (
              <>
                <div className="spx-missing-head">
                  <span>{tn('spc.missing', { count: missing.length })}</span>
                </div>
                <div className="spx-ghosts">
                  {missing.map((m) => (
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
