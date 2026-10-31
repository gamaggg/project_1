'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { formatWhen } from '@/lib/format'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import type { SectorMoment } from './LeafletMap'

// «Пока тебя не было»: a player opens the app and, before anything else, is shown
// what happened to their sectors meanwhile — a slow flight to each one and the
// same scene the catcher saw, told from the other side (their face is the one
// knocked out). It can't be skipped while it plays: the map is covered and only
// the buttons that appear after each scene lead on.
export type AwayEvent = {
  key: string
  kind: 'lost' | 'attacked'
  territoryId: string
  at: string
  byName: string | null
  byAvatarUrl: string | null
  byColor: string
  // The sector's defense after the catch (an attack): what the holder has left.
  defense: number | null
}

type Props = {
  events: AwayEvent[]
  me: { name: string | null; avatarUrl: string | null; color: string }
  play: (moment: SectorMoment, onDone: () => void) => void
  onOpenSector: (id: string) => void
  onClose: () => void
}

// The card drops in first; the flight starts once it has landed.
const INTRO_MS = 700

export function AwayReplay({ events, me, play, onOpenSector, onClose }: Props) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const ev = events[index]

  useEffect(() => {
    if (!ev) return
    let alive = true
    const timer = window.setTimeout(() => {
      play(
        {
          id: ev.territoryId,
          kind: ev.kind === 'lost' ? 'steal' : 'attack',
          fromColor: me.color,
          toColor: ev.kind === 'lost' ? ev.byColor : me.color,
          fromAvatarUrl: me.avatarUrl,
          fromName: me.name,
          toAvatarUrl: ev.byAvatarUrl,
          toName: ev.byName,
          defense: ev.kind === 'lost' ? 1 : ev.defense,
          coins: 0,
          victim: true,
        },
        () => alive && setDone(true)
      )
    }, INTRO_MS)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
    // One run per event: `play` and `me` are fresh objects on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.key])

  if (!ev) return null
  const face = (url: string | null, name: string | null) =>
    url ? <img src={thumbUrl(url, 96)} alt="" /> : (name ?? t('common.angler')).slice(0, 2).toUpperCase()
  const last = index === events.length - 1
  const lost = ev.kind === 'lost'
  const next = () => {
    if (last) onClose()
    else {
      setDone(false)
      setIndex(index + 1)
    }
  }

  return (
    <div className={`away-replay${lost ? ' lost' : ' attacked'}`} role="dialog" aria-label={t('map.away.title')}>
      <div className="away-card" key={ev.key}>
        <div className="away-tag">
          <i />
          {t('map.away.title')}
          {events.length > 1 && <span>{t('map.away.counter', { n: index + 1, total: events.length })}</span>}
        </div>
        {/* The duel in miniature: their face slams into yours, a burst where they
            meet, and yours takes the hit — cracked and greyed when the sector is
            lost, a −1 when it held. */}
        <div className="away-row">
          <div className="away-duel">
            <div className="away-face by" style={{ ['--away-ring' as string]: ev.byColor }}>
              {face(ev.byAvatarUrl, ev.byName)}
            </div>
            <svg className="away-burst" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 1l2.6 6.4L21 5l-3.4 6 5.4 3.2-6.6.9L17 22l-5-4.6L7 22l.6-6.9L1 14.2 6.4 11 3 5l6.4 2.4z" />
            </svg>
            <div className="away-face me" style={{ ['--away-ring' as string]: me.color }}>
              {face(me.avatarUrl, me.name)}
              {lost && <i className="away-crack" />}
            </div>
            {!lost && <b className="away-minus">−1</b>}
          </div>
          <div className="away-text">
            <div className="away-title">{lost ? t('map.away.lostTitle') : t('map.away.attackedTitle')}</div>
            <div className="away-sub">
              <span className="away-hex" style={{ ['--away-hex' as string]: lost ? ev.byColor : me.color }}>
                {ev.territoryId}
              </span>
              <span className="away-who">
                {ev.byName ?? t('common.angler')} · {formatWhen(ev.at)}
              </span>
            </div>
          </div>
        </div>
      </div>
      {done && (
        <div className="away-actions">
          <p>
            {lost
              ? t('map.away.lostText', { id: ev.territoryId })
              : t('map.away.attackedText', { id: ev.territoryId, defense: ev.defense ?? 0 })}
          </p>
          <div className="away-buttons">
            <button
              className="btn-secondary tap-scale"
              onClick={() => {
                onOpenSector(ev.territoryId)
                onClose()
              }}
            >
              {t('map.away.toSector')}
            </button>
            <button className="btn-primary tap-scale" onClick={next}>
              {last ? t('map.away.close') : t('map.away.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
