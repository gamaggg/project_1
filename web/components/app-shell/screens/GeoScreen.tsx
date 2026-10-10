'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PanoramaViewer } from '@/components/app-shell/PanoramaViewer'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useGeoBoard, useGeoSector, useGeoToday, useProfile, useSectorInsights } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Territory } from '@/lib/data/types'
import { CITIES, type CityId } from '@/lib/data/city'
import { GEO_BONUS, GEO_COINS, GEO_NEIGHBOUR_M, GEO_RECORD_MIN_CM, GEO_RECORD_MIN_KG, formatGeoDistance, geoImageUrl, type GeoResult, type GeoToday } from '@/lib/geo'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useNow } from '@/lib/useNow'

const IN_CITY: Record<CityId, string> = { batumi: 'Батуми', moscow: 'Москве' }
const KIND: Record<string, string> = { sea: 'Море', river: 'Река', lake: 'Озеро', pond: 'Пруд' }

type Pano = { image: string; heading: number }

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function leftLabel(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
}

function whenLabel(iso: string, now: number) {
  const d = new Date(iso)
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000)
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (days <= 0) return `сегодня в ${time}`
  if (days === 1) return `вчера в ${time}`
  if (days < 7) return `${days} ${days < 5 ? 'дня' : 'дней'} назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// The record's size — what makes it one (GEO_RECORD_MIN_*): «1,2 кг · 45 см».
function recordLabel(weightKg: number | null, lengthCm: number | null) {
  return [
    weightKg != null && weightKg >= GEO_RECORD_MIN_KG && `${String(Number(weightKg)).replace('.', ',')} кг`,
    lengthCm != null && lengthCm >= GEO_RECORD_MIN_CM && `${lengthCm} см`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function sizeLabel(weightKg: number | null, lengthCm: number | null) {
  if (weightKg != null) return `${String(Number(weightKg)).replace('.', ',')} кг`
  if (lengthCm != null) return `${lengthCm} см`
  return null
}

// A number that counts up once when it first shows.
function CountUp({ to, ms = 700 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setV(to))
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    let start: number | null = null
    const tick = (ts: number) => {
      if (start === null) start = ts
      const t = Math.min(1, (ts - start) / ms)
      setV(Math.round(to * (1 - (1 - t) ** 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return <>{v}</>
}

// «Где это?»: today's panorama of a shore (the same for everyone in the
// city); «Выбрать сектор на карте» goes to the app's map to pick the sector
// (GeoMapOverlay). After the answer this screen is about the place: the
// verdict, the day's quest (a catch there before midnight, +GEO_BONUS) and
// the sector told as a story — who holds it, what's caught there, the record
// and the last catches.
export function GeoScreen({
  sectors,
  active,
  onStartPick,
  onShowOnMap,
  onOpenTerritory,
  onOpenCatch,
  onOpenUser,
  onShare,
}: {
  // Every sector (the day's game may be in the other city — see below).
  sectors: Territory[]
  // The panorama is WebGL — only while this screen is the one showing, so
  // it never runs next to the map's own.
  active: boolean
  onStartPick: (pano: Pano) => void
  onShowOnMap: (result: GeoResult) => void
  onOpenTerritory: (id: string) => void
  onOpenCatch: (id: number) => void
  onOpenUser: (id: string) => void
  onShare: (text: string) => void
}) {
  const { data: today, isLoading, isError, refetch } = useGeoToday()

  if (isLoading) {
    return (
      <div className="geo">
        <div className="geo-stage geo-skel" aria-hidden />
        <div className="geo-goal geo-skel-line" aria-hidden />
      </div>
    )
  }
  if (isError || !today) {
    return (
      <div className="geo-empty">
        <p>Не удалось загрузить панораму.</p>
        <button className="btn-secondary" onClick={() => void refetch()}>
          Повторить
        </button>
      </div>
    )
  }
  // The day's game is in today.city: the profile's city, or — answered
  // before moving to the other one — where it was played, until midnight.
  const city = today.city
  if (!today.panorama) {
    return (
      <div className="geo-empty">
        <div className="geo-empty-art" aria-hidden />
        <div className="geo-empty-title">Панорамы скоро появятся</div>
        <p>Отбираем места у воды в {IN_CITY[city]}. Загляни завтра.</p>
      </div>
    )
  }

  const pano = { image: today.panorama.image, heading: today.panorama.heading }

  if (today.result) {
    return (
      <GeoResultView
        city={city}
        sectors={sectors}
        today={today}
        result={today.result}
        pano={pano}
        onShowOnMap={() => onShowOnMap(today.result!)}
        onOpenTerritory={onOpenTerritory}
        onOpenCatch={onOpenCatch}
        onOpenUser={onOpenUser}
        onShare={onShare}
      />
    )
  }

  return (
    <div className="geo">
      <div className="geo-stage" data-tour="geo-pano">
        {active ? (
          <PanoramaViewer key={today.panorama.id} className="geo-pano" src={geoImageUrl(pano.image)} preview={geoImageUrl(pano.image, 'small')} heading={pano.heading} />
        ) : (
          <div className="geo-pano geo-pano-still" style={{ backgroundImage: `url(${geoImageUrl(pano.image, 'small')})` }} />
        )}
        <span className="geo-stage-chip">Панорама дня · {CITIES[city].name}</span>
      </div>
      <div className="geo-goal" data-tour="geo-goal">
        <div>
          <b>Узнай это место</b>
          <span>Осмотрись и найди на карте соту, где снята панорама</span>
        </div>
        <span className="geo-prize">
          +{GEO_COINS}
          <CoinIcon size={20} />
        </span>
      </div>
      <button className="btn-primary geo-cta" data-tour="geo-cta" onClick={() => onStartPick(pano)}>
        <HexIcon /> Выбрать сектор на карте
      </button>
      <p className="geo-foot">Одна попытка в день · новая панорама в полночь</p>
    </div>
  )
}

function GeoResultView({
  city,
  sectors,
  today,
  result,
  pano,
  onShowOnMap,
  onOpenTerritory,
  onOpenCatch,
  onOpenUser,
  onShare,
}: {
  city: CityId
  sectors: Territory[]
  today: GeoToday
  result: GeoResult
  pano: Pano
  onShowOnMap: () => void
  onOpenTerritory: (id: string) => void
  onOpenCatch: (id: number) => void
  onOpenUser: (id: string) => void
  onShare: (text: string) => void
}) {
  const now = useNow(30_000)
  const { data: board } = useGeoBoard(true)
  const { user } = useAuth()
  const { data: me } = useProfile(user?.id ?? null)
  const sector = sectors.find((s) => s.id === result.territoryId) ?? null
  const neighbour = useMemo(() => {
    if (result.correct) return false
    const a = sectors.find((s) => s.id === result.guessTerritoryId)
    return !!a && !!sector && metres(a, sector) <= GEO_NEIGHBOUR_M
  }, [sectors, sector, result])
  const left = Math.max(0, Date.parse(today.nextReset) - now)
  const day = dateLabel(`${today.day}T12:00:00`)

  function share() {
    const line = result.correct ? `🎯 угадал сектор · +${result.coins} монет` : neighbour ? '🟨 соседняя сота — чуть-чуть не хватило' : `🟥 промах ${formatGeoDistance(result.distance)}`
    onShare(`Где это? · ${CITIES[city].name} · ${day}\n${line}\nА ты узнаешь это место?`)
  }

  return (
    <div className="geo">
      {/* The place is the card: the panorama behind everything (~65° of it
          around where its view opens, a 2400px-wide turn, drifting slowly
          round), its lower part blurred and darkened under the verdict. */}
      <section className={`geo-verdict-card${result.correct ? ' win' : ''}`}>
        <div className="geo-verdict-bg" style={{ backgroundImage: `url(${geoImageUrl(pano.image)})`, '--pan': `${Math.round((-2400 * pano.heading) / 360)}px` } as CSSProperties} aria-hidden />
        <div className="geo-verdict-blur" aria-hidden />
        <div className="geo-verdict-tint" aria-hidden />
        <div className="geo-verdict-top">
          <span className="geo-verdict-chip">Панорама дня · {day}</span>
          {result.territoryId && (
            <span className="geo-verdict-chip geo-verdict-place">
              <i aria-hidden />
              {result.territoryId}
              {sector && <small>{KIND[sector.kind]?.toLowerCase()}</small>}
            </span>
          )}
        </div>
        <div className="geo-verdict-body">
          <div className="geo-kicker">{result.correct ? 'Ты угадал' : neighbour ? 'Совсем рядом' : 'Не угадал'}</div>
          {result.correct ? (
            <div className="geo-big-coins">
              +<CountUp to={result.coins} />
              <CoinIcon size={28} />
            </div>
          ) : (
            <div className="geo-headline">{neighbour ? 'Соседняя сота' : `Промах ${formatGeoDistance(result.distance)}`}</div>
          )}
          {/* The sector is named up top — this line is about you. */}
          <div className="geo-verdict-sub">
            {result.correct ? 'Ты узнал это место' : neighbour ? `Ты выбрал ${result.guessTerritoryId} — не хватило одной соты` : `Ты выбрал ${result.guessTerritoryId}`}
          </div>
          <div className="geo-verdict-meta">
            {result.players <= 1 ? 'Ты сегодня первый' : `Угадали ${result.winners} из ${result.players} · ты ${result.rank}-й`}
          </div>
          <div className="geo-verdict-actions">
            <button className="btn-secondary" onClick={onShowOnMap}>
              <HexIcon /> На карте
            </button>
            <button className="btn-secondary" onClick={share}>
              Поделиться
            </button>
          </div>
        </div>
      </section>

      {result.territoryId && (
        <section className={`geo-quest${result.bonusCoins > 0 ? ' done' : ''}`} data-tour="geo-quest">
          <span className="geo-quest-icon" aria-hidden>
            <TargetIcon />
          </span>
          <div className="geo-quest-text">
            <small>Задание дня</small>
            <b>{result.bonusCoins > 0 ? `Выполнено — улов в ${result.territoryId}` : `Поймай рыбу в секторе ${result.territoryId}`}</b>
            <span>{result.bonusCoins > 0 ? 'Монеты уже у тебя' : `До полуночи · осталось ${leftLabel(left)}`}</span>
          </div>
          <span className="geo-prize">
            {result.bonusCoins > 0 ? '✓' : '+'}
            {GEO_BONUS}
            <CoinIcon size={20} />
          </span>
        </section>
      )}

      {result.territoryId && <SectorStory id={result.territoryId} sector={sector} onOpenTerritory={onOpenTerritory} onOpenCatch={onOpenCatch} onOpenUser={onOpenUser} />}

      {board && board.length > 0 && (
        <section className="geo-board" data-tour="geo-board">
          <div className="geo-section-title">Сегодня в {IN_CITY[city]}</div>
          {board.map((r, i) => {
            // Your own row has your face too, even before the board brings it.
            const avatar = r.avatarUrl ?? (r.isMe ? (me?.avatarUrl ?? null) : null)
            const name = r.isMe ? (me?.displayName ?? r.displayName) : r.displayName
            return (
              <button
                key={r.userId}
                type="button"
                className={`geo-board-row${r.isMe ? ' me' : ''}${r.correct ? ' win' : ''}`}
                style={{ '--i': i } as CSSProperties}
                disabled={r.isMe}
                onClick={() => onOpenUser(r.userId)}
              >
                <span className="geo-board-place">{i + 1}</span>
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar from storage
                  <img className="geo-board-avatar" src={thumbUrl(avatar, 64)} alt="" />
                ) : (
                  <span className="geo-board-avatar initials">{(name ?? 'Р').slice(0, 2).toUpperCase()}</span>
                )}
                <span className="geo-board-name">
                  {name ?? 'Рыбак'}
                  {r.isMe && <small> · ты</small>}
                </span>
                <span className="geo-board-dist">{r.correct ? 'в точку' : formatGeoDistance(r.distance)}</span>
              </button>
            )
          })}
        </section>
      )}

      <p className="geo-foot">Новая панорама через {leftLabel(left)}</p>
      {result.source === 'mapillary' && (
        <p className="geo-credit">
          Панорама{result.author ? `: ${result.author}` : ''} ·{' '}
          <a href={`https://www.mapillary.com/app/?pKey=${result.sourceId}`} target="_blank" rel="noopener noreferrer">
            Mapillary
          </a>
          , CC BY-SA 4.0
        </p>
      )}
    </div>
  )
}

// The answer's sector, told: who holds it and what that means for you, how
// busy it is, what's caught here, the record, when it bites, the legend and
// the last three catches.
function SectorStory({
  id,
  sector,
  onOpenTerritory,
  onOpenCatch,
  onOpenUser,
}: {
  id: string
  sector: Territory | null
  onOpenTerritory: (id: string) => void
  onOpenCatch: (id: number) => void
  onOpenUser: (id: string) => void
}) {
  const { data: story, isLoading } = useGeoSector(id)
  const { data: insights } = useSectorInsights(id)
  const now = useNow(60_000)

  if (isLoading || !story) {
    return (
      <section className="geo-story" aria-busy="true">
        <div className="geo-story-head">
          <span className="geo-story-hex" aria-hidden />
          <div className="geo-skel-line w40" />
        </div>
        <div className="geo-skel-block" />
        <div className="geo-story-stats">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="geo-stat geo-skel-block small" />
          ))}
        </div>
      </section>
    )
  }

  const shield = sector?.shieldUntil && Date.parse(sector.shieldUntil) > now ? sector.shieldUntil : null
  const hot = sector?.hotUntil && Date.parse(sector.hotUntil) > now ? sector.hotUntil : null
  const status = sector?.status ?? (story.owner ? 'other' : 'free')
  const best = bestWindow(insights?.hours ?? null)
  // The server already leaves small fish out; checked here too.
  const record =
    story.record && ((story.record.weightKg ?? 0) >= GEO_RECORD_MIN_KG || (story.record.lengthCm ?? 0) >= GEO_RECORD_MIN_CM) ? story.record : null
  const firstDay = story.firstAt ? new Date(story.firstAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : null
  const maxSpecies = Math.max(1, ...story.species.map((s) => s.count))

  return (
    <section className="geo-story" data-tour="geo-story">
      <button className="geo-story-head" onClick={() => onOpenTerritory(id)}>
        <span className={`geo-story-hex ${status}`} aria-hidden />
        <span className="geo-story-title">
          <small>{sector ? KIND[sector.kind] : 'Сектор'}</small>
          <b>Сектор {id}</b>
        </span>
        <span className="geo-story-open">
          Открыть
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>

      {/* Who holds it — and what you can do about that. Under a shield there's
          no «отбей»: it can't be taken now (the catch still counts). */}
      <div className={`geo-owner ${status}`}>
        {status === 'free' ? (
          <>
            <span className="geo-owner-badge free" aria-hidden>
              <StarIcon />
            </span>
            <div>
              <b>{story.catches === 0 ? 'Здесь ещё никто не ловил' : 'Сектор свободен'}</b>
              <span>{story.catches === 0 ? 'Поймай здесь первым — и сектор станет твоим.' : 'Сейчас без хозяина: поймай здесь — и он твой.'}</span>
            </div>
          </>
        ) : (
          <>
            <button className="geo-owner-avatar" onClick={() => story.owner && onOpenUser(story.owner.id)} aria-label={story.owner?.name ?? 'Владелец'}>
              {story.owner?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar from storage
                <img src={thumbUrl(story.owner.avatarUrl, 96)} alt="" />
              ) : (
                <span>{(story.owner?.name ?? 'Р').slice(0, 2).toUpperCase()}</span>
              )}
            </button>
            <div>
              <b>{status === 'mine' ? 'Это твой сектор' : `Держит ${story.owner?.name ?? 'рыбак'}`}</b>
              <span>
                {shield
                  ? status === 'mine'
                    ? `Под твоим щитом до ${dateLabel(shield)}.`
                    : `Под щитом до ${dateLabel(shield)} — сейчас его не отбить.`
                  : status === 'mine'
                    ? story.owner?.since
                      ? `Твой с ${dateLabel(story.owner.since)}. Заглядывай — держи защиту.`
                      : 'Заглядывай — держи защиту.'
                    : (sector?.defense ?? 0) > 0
                      ? `Защита ${sector!.defense} из 3 — каждый твой улов снимает одну. Отбей сектор!`
                      : 'Защита снята — первый же твой улов заберёт сектор.'}
              </span>
            </div>
          </>
        )}
      </div>
      {hot && (
        <div className="geo-hot">
          <span aria-hidden>
            <FlameIcon />
          </span>
          Горящий сектор: ×3 монеты за улов до {dateLabel(hot)}
        </div>
      )}

      {story.catches > 0 ? (
        <>
          <div className="geo-story-stats">
            <div className="geo-stat" style={{ '--i': 0 } as CSSProperties}>
              <b>
                <CountUp to={story.catches} />
              </b>
              <span>{plural(story.catches, ['улов', 'улова', 'уловов'])}</span>
            </div>
            <div className="geo-stat" style={{ '--i': 1 } as CSSProperties}>
              <b>
                <CountUp to={story.anglers} />
              </b>
              <span>{plural(story.anglers, ['рыбак', 'рыбака', 'рыбаков'])}</span>
            </div>
            <div className="geo-stat" style={{ '--i': 2 } as CSSProperties}>
              <b>
                <CountUp to={story.species.length} />
              </b>
              <span>{plural(story.species.length, ['вид', 'вида', 'видов'])}</span>
            </div>
            <div className="geo-stat" style={{ '--i': 3 } as CSSProperties}>
              <b className="small">{firstDay ?? '—'}</b>
              <span>первый улов</span>
            </div>
          </div>

          <div className="geo-story-block">
            <div className="geo-section-title">Что здесь ловят</div>
            <div className="geo-species">
              {story.species.map((s, i) => (
                <div key={s.key} className="geo-species-row" style={{ '--i': i, '--w': `${(s.count / maxSpecies) * 100}%` } as CSSProperties}>
                  <span className="geo-species-name">{s.name ?? s.key}</span>
                  <span className="geo-species-bar" aria-hidden>
                    <i />
                  </span>
                  <span className="geo-species-count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {(record || best || insights?.legend) && (
            <div className="geo-facts">
              {record && (
                <button className="geo-fact" onClick={() => onOpenCatch(record.catchId)}>
                  <span className="geo-fact-icon gold" aria-hidden>
                    <TrophyIcon />
                  </span>
                  <span>
                    <small>Рекорд сектора</small>
                    <b>
                      {record.speciesName} · {recordLabel(record.weightKg, record.lengthCm)}
                    </b>
                    {record.userName && <em>{record.userName}</em>}
                  </span>
                </button>
              )}
              {best && (
                <div className="geo-fact">
                  <span className="geo-fact-icon blue" aria-hidden>
                    <ClockIcon />
                  </span>
                  <span>
                    <small>Лучше всего клюёт</small>
                    <b>{best}</b>
                  </span>
                </div>
              )}
              {insights?.legend && (
                <button className="geo-fact" onClick={() => onOpenUser(insights.legend!.id)}>
                  <span className="geo-fact-icon laurel" aria-hidden>
                    <LaurelIcon />
                  </span>
                  <span>
                    <small>Легенда сектора</small>
                    <b>{insights.legend.name ?? 'Рыбак'}</b>
                    <em>{insights.legend.count} {plural(insights.legend.count, ['улов', 'улова', 'уловов'])} за 90 дней</em>
                  </span>
                </button>
              )}
            </div>
          )}

          {story.last.length > 0 && (
            <div className="geo-story-block">
              <div className="geo-section-title">Последние уловы</div>
              <ol className="geo-timeline">
                {story.last.map((c, i) => (
                  <li key={c.id} style={{ '--i': i } as CSSProperties}>
                    <button className="geo-catch" onClick={() => onOpenCatch(c.id)}>
                      <span className="geo-catch-photo">
                        {/* eslint-disable-next-line @next/next/no-img-element -- catch thumbnail from storage */}
                        <img src={thumbUrl(c.photoUrl, 160)} alt="" loading="lazy" />
                      </span>
                      <span className="geo-catch-text">
                        <b>
                          {c.speciesName}
                          {sizeLabel(c.weightKg, c.lengthCm) && <i> · {sizeLabel(c.weightKg, c.lengthCm)}</i>}
                        </b>
                        <span>
                          {c.userName ?? 'Рыбак'} · {whenLabel(c.caughtAt, now)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : (
        <div className="geo-virgin">
          <b>Нетронутое место</b>
          <span>Ни одного улова — первый, кто поймает здесь, откроет сектор для всех.</span>
        </div>
      )}
    </section>
  )
}

// The busiest three hours in a row, «18:00–21:00».
function bestWindow(hours: number[] | null): string | null {
  if (!hours || hours.reduce((a, b) => a + b, 0) < 3) return null
  let best = 0
  let at = 0
  for (let h = 0; h < 24; h++) {
    const sum = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24]
    if (sum > best) {
      best = sum
      at = h
    }
  }
  const hh = (n: number) => `${String(n % 24).padStart(2, '0')}:00`
  return `${hh(at)}–${hh(at + 3)}`
}

function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

function HexIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 12 7.25 3.8h9.5L21.5 12l-4.75 8.2h-9.5Z" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
function TargetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  )
}
function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" />
    </svg>
  )
}
function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c1 3.4 4.5 5.4 4.5 9.6A4.6 4.6 0 0 1 12 16.3a4.3 4.3 0 0 1-4.4-4.2c0-1.6.7-2.7 1.6-3.7.1 1.4.8 2.3 1.8 2.6C10.3 8.4 10.6 5 12 2Zm0 20a7 7 0 0 1-7-7c0-1.4.4-2.7 1-3.8.5 3.4 3 5.6 6 5.6s5.6-2.2 6-5.6c.6 1.1 1 2.4 1 3.8a7 7 0 0 1-7 7Z" />
    </svg>
  )
}
function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}
function LaurelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 20c-3-3-4-8-1-13M17 20c3-3 4-8 1-13" />
      <path d="M5 13c1.5 0 2.5-.8 3-2M4.5 9c1.4.2 2.5-.4 3.2-1.5M19 13c-1.5 0-2.5-.8-3-2M19.5 9c-1.4.2-2.5-.4-3.2-1.5" />
    </svg>
  )
}
