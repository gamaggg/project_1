'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { BackButton } from '@/components/app-shell/BackButton'
import { CATEGORY_FISH_COLOR, FishSilhouette } from '@/components/app-shell/FishSilhouette'
import { useAuth } from '@/components/providers/AuthProvider'
import { CATEGORIES_BY_CITY, CATEGORY_LABEL, type SpeciesCategory } from '@/lib/data/species'
import { CITIES, type CityId } from '@/lib/data/city'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useSpecies, useSpeciesAtlas, type AtlasEntry } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import { formatCatchMeta } from '@/lib/format'

const RING_R = 30
const RING_C = 2 * Math.PI * RING_R

// Атлас рыб: every species the city has, caught ones in colour, the rest as
// grey silhouettes — a collection to fill in. One request (get_species_atlas)
// when the screen is first opened; the detail sheet reads from the same data.
export function AtlasScreen({
  city,
  onBack,
  onOpenCatch,
  onOpenTerritory,
  onOpenUser,
}: {
  city: CityId
  onBack: () => void
  onOpenCatch: (catchId: number) => void
  onOpenTerritory: (territoryId: string) => void
  onOpenUser: (userId: string) => void
}) {
  const { t } = useI18n()
  const { data: atlas, isLoading } = useSpeciesAtlas(city)
  const { data: species = [] } = useSpecies()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const nameOf = (key: string) => species.find((s) => s.key === key)?.name ?? key

  const entries = atlas ?? []
  const mine = entries.filter((e) => e.mine > 0).length
  const total = entries.length
  const open = openKey ? entries.find((e) => e.key === openKey) ?? null : null

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{t('atlas.title')}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="atlas-hero">
          <div className="atlas-hero-ring">
            <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden>
              <circle cx="38" cy="38" r={RING_R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="7" />
              <circle
                cx="38"
                cy="38"
                r={RING_R}
                fill="none"
                stroke="#3FD0B4"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={total ? RING_C * (1 - mine / total) : RING_C}
                transform="rotate(-90 38 38)"
                className="atlas-hero-ring-fill"
              />
            </svg>
            <span>{isLoading ? '…' : t('atlas.progress', { mine, total })}</span>
          </div>
          <div className="atlas-hero-text">
            <div className="atlas-hero-kicker">{CITIES[city].name}</div>
            <div className="atlas-hero-title">{t('atlas.title')}</div>
            <div className="atlas-hero-hint">{t('atlas.hint')}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="atlas-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="atlas-tile atlas-tile-skeleton" />
            ))}
          </div>
        ) : (
          CATEGORIES_BY_CITY[city].map((category) => (
            <AtlasCategory key={category} category={category} entries={entries.filter((e) => e.category === category)} nameOf={nameOf} onOpen={setOpenKey} />
          ))
        )}
      </div>
      {open && (
        <AtlasSpeciesSheet
          entry={open}
          name={nameOf(open.key)}
          onClose={() => setOpenKey(null)}
          onOpenCatch={(id) => {
            setOpenKey(null)
            onOpenCatch(id)
          }}
          onOpenTerritory={(id) => {
            setOpenKey(null)
            onOpenTerritory(id)
          }}
          onOpenUser={(id) => {
            setOpenKey(null)
            onOpenUser(id)
          }}
        />
      )}
    </>
  )
}

function AtlasCategory({
  category,
  entries,
  nameOf,
  onOpen,
}: {
  category: SpeciesCategory
  entries: AtlasEntry[]
  nameOf: (key: string) => string
  onOpen: (key: string) => void
}) {
  const { t } = useI18n()
  if (!entries.length) return null
  const caught = entries.filter((e) => e.mine > 0).length
  const color = CATEGORY_FISH_COLOR[category]
  return (
    <section className="atlas-category">
      <div className="atlas-category-head">
        <span className="atlas-category-dot" style={{ background: color }} />
        <span className="atlas-category-name">{CATEGORY_LABEL[category]}</span>
        <span className="atlas-category-count">{t('atlas.progress', { mine: caught, total: entries.length })}</span>
      </div>
      <div className="atlas-category-bar">
        <i style={{ width: `${(caught / entries.length) * 100}%`, background: color }} />
      </div>
      <div className="atlas-grid">
        {entries.map((e, i) => {
          const isCaught = e.mine > 0
          return (
            <button
              key={e.key}
              className={`atlas-tile tap-scale${isCaught ? ' caught' : ''}`}
              style={{ ['--tile-color' as string]: color, animationDelay: `${Math.min(i, 12) * 25}ms` }}
              onClick={() => onOpen(e.key)}
            >
              <FishSilhouette speciesKey={e.key} color={isCaught ? color : null} width={58} />
              <span className="atlas-tile-name">{nameOf(e.key)}</span>
              <span className="atlas-tile-count">{isCaught ? `×${e.mine}` : '?'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function AtlasSpeciesSheet({
  entry,
  name,
  onClose,
  onOpenCatch,
  onOpenTerritory,
  onOpenUser,
}: {
  entry: AtlasEntry
  name: string
  onClose: () => void
  onOpenCatch: (catchId: number) => void
  onOpenTerritory: (territoryId: string) => void
  onOpenUser: (userId: string) => void
}) {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const color = CATEGORY_FISH_COLOR[entry.category] ?? '#3E7BFA'
  const caught = entry.mine > 0
  const peak = Math.max(1, ...entry.months)
  const monthFmt = new Intl.DateTimeFormat(lang, { month: 'narrow' })
  const dateFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  const bestMeta = entry.best ? formatCatchMeta(entry.best.lengthCm, entry.best.weightKg) : null

  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet atlas-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={name}>
        <div className="move-sheet-handle" />
        <div className="atlas-sheet-hero" style={{ ['--tile-color' as string]: color }}>
          <FishSilhouette speciesKey={entry.key} color={caught ? color : null} width={150} />
        </div>
        <div className="atlas-sheet-head">
          <div className="atlas-sheet-kicker" style={{ color: caught ? color : undefined }}>
            {caught ? t('atlas.caught') : t('atlas.notCaught')}
          </div>
          <div className="atlas-sheet-title">{name}</div>
          {caught && (
            <div className="atlas-sheet-sub">
              {t('atlas.yourCount', { count: entry.mine })}
              {entry.firstAt && <> · {t('atlas.firstAt', { date: dateFmt.format(new Date(entry.firstAt)) })}</>}
            </div>
          )}
        </div>
        <div className="move-body atlas-sheet-body">
          {entry.best && (
            <button className="atlas-sheet-row tap-scale" onClick={() => onOpenCatch(entry.best!.catchId)}>
              <span className="atlas-sheet-photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- catch thumbnail, same as the profile's recent catches */}
                <img src={thumbUrl(entry.best.photoUrl, 160)} alt="" loading="lazy" decoding="async" />
              </span>
              <span className="atlas-sheet-row-text">
                <span className="atlas-sheet-label">{t('atlas.yourBest')}</span>
                <b>{bestMeta ?? t('atlas.openCatch')}</b>
              </span>
              <Chevron />
            </button>
          )}

          <div className="atlas-sheet-block">
            <span className="atlas-sheet-label">{t('atlas.cityRecord')}</span>
            {entry.record ? (
              <button className="atlas-sheet-record tap-scale" onClick={() => onOpenUser(entry.record!.userId)}>
                <b>{formatCatchMeta(entry.record.lengthCm, null)}</b>
                <span>{entry.record.userId === user?.id ? t('atlas.recordYou') : entry.record.name}</span>
              </button>
            ) : (
              <div className="atlas-sheet-muted">{t('atlas.noRecord')}</div>
            )}
          </div>

          {entry.cityCount > 0 ? (
            <>
              <div className="atlas-sheet-block">
                <span className="atlas-sheet-label">{t('atlas.season')}</span>
                <div className="atlas-months" aria-hidden>
                  {entry.months.map((n, m) => (
                    <div key={m} className="atlas-month">
                      <span className="atlas-month-track">
                        <i style={{ height: `${n ? Math.max(14, (n / peak) * 100) : 6}%`, background: n ? color : undefined }} />
                      </span>
                      <span>{monthFmt.format(new Date(2026, m, 15))}</span>
                    </div>
                  ))}
                </div>
                <div className="atlas-sheet-muted" style={{ marginTop: 8 }}>
                  {t('atlas.anglers', { count: entry.anglers })}
                </div>
              </div>
              {entry.topSectors.length > 0 && (
                <div className="atlas-sheet-block">
                  <span className="atlas-sheet-label">{t('atlas.where')}</span>
                  <div className="atlas-sectors">
                    {entry.topSectors.map((id) => (
                      <button key={id} className="atlas-sector tap-scale" onClick={() => onOpenTerritory(id)}>
                        {id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="atlas-sheet-block atlas-sheet-muted">{t('atlas.nobody')}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

// The profile's way into the atlas — counted from the catches the profile
// already has loaded, so it adds no request at launch; the full atlas (city
// records, seasons) loads only when it's opened.
export function AtlasCard({
  city,
  caughtKeys,
  onOpen,
}: {
  city: CityId
  caughtKeys: Set<string>
  onOpen: () => void
}) {
  const { t } = useI18n()
  const { data: species = [] } = useSpecies()
  const categories = CATEGORIES_BY_CITY[city]
  const citySpecies = species.filter((s) => categories.includes(s.category))
  if (!citySpecies.length) return null
  const caught = citySpecies.filter((s) => caughtKeys.has(s.key))
  // Caught ones first in the strip, then the grey ones still to find.
  const strip = [...caught, ...citySpecies.filter((s) => !caughtKeys.has(s.key))].slice(0, 5)

  return (
    <button className="atlas-card tap-scale" onClick={onOpen}>
      <span className="atlas-card-text">
        <span className="atlas-card-title">{t('atlas.title')}</span>
        <span className="atlas-card-sub">{t('atlas.cardSub', { mine: caught.length, total: citySpecies.length })}</span>
        <span className="atlas-card-bar">
          <i style={{ width: `${(caught.length / citySpecies.length) * 100}%` }} />
        </span>
      </span>
      <span className="atlas-card-strip" aria-hidden>
        {strip.map((s) => (
          <FishSilhouette key={s.key} speciesKey={s.key} color={caughtKeys.has(s.key) ? CATEGORY_FISH_COLOR[s.category] : null} width={34} />
        ))}
      </span>
      <Chevron />
    </button>
  )
}
