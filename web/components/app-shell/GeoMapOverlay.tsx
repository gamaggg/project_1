'use client'

import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { WinBurst } from '@/components/app-shell/SlotsWin'
import type { Territory } from '@/lib/data/types'
import type { CityId } from '@/lib/data/city'
import { GEO_BONUS, GEO_COINS, formatGeoDistance, geoImageUrl, type GeoResult } from '@/lib/geo'
import { useTelegramBackButton } from '@/lib/telegram/useTelegramBackButton'

const KIND: Record<string, string> = { sea: 'море', river: 'река', lake: 'озеро', pond: 'пруд' }

// «Где это?» played on the app's own map (MapScreen's `geo`): first the pick —
// a window into the panorama up top, a tap on a sector, «Это здесь!» — then
// the reveal: the camera takes in both sectors, the rest of the map goes dark
// (drawn on the map itself), and the verdict comes up from below.
export function GeoMapOverlay({
  city,
  phase,
  panorama,
  picked,
  result,
  neighbour,
  sending,
  error,
  onSend,
  onBack,
  onStory,
}: {
  city: CityId
  phase: 'pick' | 'reveal'
  panorama: { image: string; heading: number } | null
  picked: Territory | null
  result: GeoResult | null
  neighbour: boolean
  sending: boolean
  error: string | null
  onSend: () => void
  onBack: () => void
  onStory: () => void
}) {
  useTelegramBackButton(onBack)
  // The panorama's small copy, panned slowly inside the window (a 64px-high
  // window at 260% shows a 333px-wide turn) — where the view opens (heading)
  // is where the pan starts.
  const windowStyle = panorama
    ? ({ backgroundImage: `url(${geoImageUrl(panorama.image, 'small')})`, '--pan': `${Math.round(46 - ((panorama.heading + 180) / 360) * 332.8)}px` } as CSSProperties)
    : undefined

  return createPortal(
    <div className={`geo-play ${phase}`}>
      {phase === 'pick' && (
        <>
          <div className="geo-play-top">
            <button className="geo-play-window" data-tour="geo-window" style={windowStyle} onClick={onBack} aria-label="Вернуться к панораме">
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                к панораме
              </span>
            </button>
            <div className="geo-play-ask">
              <small>Где это?</small>
              <b>В какой соте снята панорама?</b>
            </div>
          </div>
          <div className="geo-play-bottom">
            {error && <div className="geo-play-error">{error}</div>}
            {picked ? (
              <div className="geo-play-picked" key={picked.id}>
                <span className="geo-play-hex" aria-hidden />
                <span>
                  <b>{picked.id}</b>
                  <small>{KIND[picked.kind] ?? 'вода'}</small>
                </span>
                <button className="btn-primary geo-play-send" disabled={sending} onClick={onSend}>
                  {sending ? 'Проверяем…' : 'Это здесь!'}
                </button>
              </div>
            ) : (
              <div className="geo-play-hint" data-tour="geo-hint">
                <span className="geo-play-hex idle" aria-hidden />
                Нажми на соту у воды — где, по-твоему, снята панорама
              </div>
            )}
          </div>
        </>
      )}

      {phase === 'reveal' && result && (
        <div className={`geo-reveal${result.correct ? ' win' : ''}`}>
          {result.correct && <WinBurst prize="triple" coins={GEO_COINS} city={city} />}
          <div className="geo-reveal-kicker">{result.correct ? 'В точку!' : neighbour ? 'Совсем рядом' : 'Не угадал'}</div>
          {result.correct ? (
            <div className="geo-reveal-coins">
              +{result.coins}
              <CoinIcon size={28} />
            </div>
          ) : (
            <div className="geo-reveal-head">Это было в соте {result.territoryId}</div>
          )}
          <div className="geo-reveal-sub">
            {result.correct
              ? `Сектор ${result.territoryId} — ты узнал это место`
              : neighbour
                ? 'Соседняя сота — не хватило совсем чуть-чуть'
                : `${formatGeoDistance(result.distance)} от твоей соты ${result.guessTerritoryId}`}
          </div>
          <div className="geo-reveal-quest">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" />
            </svg>
            Поймай здесь рыбу до полуночи — ещё +{GEO_BONUS}
          </div>
          <button className="btn-primary geo-reveal-btn" onClick={onStory}>
            Что это за место
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
