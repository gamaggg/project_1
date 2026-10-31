'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FirstStepsPill } from '@/components/app-shell/FirstSteps'
import { MapView } from '@/components/app-shell/MapView'
import { AwayReplay, type AwayEvent } from '@/components/app-shell/AwayReplay'
import { BottomNav } from '@/components/app-shell/BottomNav'
import type { LeafletMapHandle, SectorMoment } from '@/components/app-shell/LeafletMap'
import type { Territory } from '@/lib/data/types'
import { CITIES } from '@/lib/data/city'
import { territoryFromRow } from '@/lib/data/territoryMerge'
import { SECTOR_GEOMETRY_VERSION } from '@/lib/data/sectorGeometryVersion'
import { DEFAULT_TERRITORY_COLOR, FREE_TERRITORY_COLOR, OTHER_TERRITORY_COLOR } from '@/lib/data/territoryColors'

// Batumi's real sectors with made-up holders around one of them (B0886), and the
// four moments a catch can end in, played by the same code the app runs after a catch.
const TARGET = 'B0886'
const ME = DEFAULT_TERRITORY_COLOR
type Kind = SectorMoment['kind']
const KINDS: { kind: Kind; label: string; about: string }[] = [
  { kind: 'capture', label: 'Свободный', about: 'Улов в свободном секторе: твой аватар падает сверху, сектор заливается твоим цветом' },
  { kind: 'steal', label: 'Перехват', about: 'Защита соседа была 0: ты выбиваешь его аватар, сектор переходит к тебе' },
  { kind: 'attack', label: 'Атака', about: 'У соседа есть защита: ты бьёшь, он устоял, защита −1, сектор остаётся у него' },
  { kind: 'own', label: 'Свой', about: 'Улов в своём секторе: аватар подпрыгивает, защита +1' },
]
// «Пока тебя не было»: the rival took B0886 two hours ago and attacked another
// of the player's sectors this morning.
const AWAY_ATTACKED = 'B0935'
const AWAY_EVENTS: AwayEvent[] = [
  { key: 'lost', kind: 'lost', territoryId: TARGET, at: new Date(Date.now() - 2 * 3_600_000).toISOString(), byName: 'Сосед', byAvatarUrl: null, byColor: OTHER_TERRITORY_COLOR, defense: 1 },
  { key: 'attacked', kind: 'attacked', territoryId: AWAY_ATTACKED, at: new Date(Date.now() - 5 * 3_600_000).toISOString(), byName: 'Сосед', byAvatarUrl: null, byColor: OTHER_TERRITORY_COLOR, defense: 1 },
]

// «Все подряд»: pause between scenes, long enough for one to end (hit + 2.3 s + fade).
const SCENE_GAP_MS = 4200

type Sector = { id: string; kind: Territory['kind']; lat: number; lng: number; corners: [number, number][] }

function withStatus(t: Territory, status: Territory['status']): Territory {
  return {
    ...t,
    status,
    ownerId: status === 'free' ? null : status === 'mine' ? 'me' : 'rival',
    ownerDisplayName: status === 'free' ? null : status === 'mine' ? 'Ты' : 'Сосед',
    ownerColor: status === 'other' ? OTHER_TERRITORY_COLOR : null,
  }
}

export function MomentPreview() {
  const mapRef = useRef<LeafletMapHandle>(null)
  const [base, setBase] = useState<Territory[]>([])
  const [territories, setTerritories] = useState<Territory[]>([])
  const [current, setCurrent] = useState<Kind | null>(null)
  const [away, setAway] = useState(false)
  // «Задание новичка»: a newcomer 2 days 21 hours into their week, no steps done —
  // the pill and its sheet read this from the query cache, as in the app.
  const queryClient = useQueryClient()
  const [newbie, setNewbie] = useState(false)
  const newbieData = useRef({
    eligible: true,
    claimed: false,
    reward: 100,
    newbie_until: new Date(Date.now() + (4 * 24 + 3) * 3_600_000).toISOString(),
    steps: { catch: false, treasury: false, daily: false, fortify: false, challenge: false, clan: false },
  })
  // The pill refetches on tap; signed out here, that comes back empty — put the
  // made-up newcomer back each time.
  useEffect(() => {
    if (!newbie) return
    const key = ['first-steps', null]
    queryClient.setQueryData(key, newbieData.current)
    return queryClient.getQueryCache().subscribe((e) => {
      if (e.query.queryHash === JSON.stringify(key) && e.query.state.data !== newbieData.current && e.query.state.status !== 'pending')
        queueMicrotask(() => queryClient.setQueryData(key, newbieData.current))
    })
  }, [newbie, queryClient])
  function showNewbie() {
    setNewbie((v) => !v)
  }
  const timersRef = useRef<number[]>([])
  useEffect(() => {
    fetch(`/data/sectors-B.${SECTOR_GEOMETRY_VERSION}.json`)
      .then((r) => r.json())
      .then((d: { sectors: Sector[] }) => {
        const target = d.sectors.find((s) => s.id === TARGET)!
        const list = d.sectors.map((s, i) => {
          const t = territoryFromRow(undefined, s.id, s.kind, s.lat, s.lng, s.corners, undefined)
          const near = Math.hypot(s.lat - target.lat, s.lng - target.lng) < 0.02
          if (!near || s.id === TARGET) return t
          return withStatus(t, i % 5 === 0 ? 'other' : i % 7 === 0 ? 'mine' : 'free')
        })
        setBase(list)
        setTerritories(list)
      })
  }, [])

  function stopAll() {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }

  function playOne(kind: Kind) {
    stopAll()
    play(kind)
  }

  function playAll() {
    stopAll()
    KINDS.forEach((k, i) => timersRef.current.push(window.setTimeout(() => play(k.kind), i * SCENE_GAP_MS)))
    timersRef.current.push(window.setTimeout(() => setCurrent(null), KINDS.length * SCENE_GAP_MS))
  }

  // As on opening the app: the sectors already as they are now, and the replay
  // takes over the screen (it cuts the map to the sector itself).
  function playAway() {
    stopAll()
    setCurrent(null)
    setAway(false)
    setTerritories(base.map((t) => (t.id === TARGET ? withStatus(t, 'other') : t.id === AWAY_ATTACKED ? withStatus(t, 'mine') : t)))
    timersRef.current.push(window.setTimeout(() => setAway(true), 300))
  }

  function play(kind: Kind) {
    setCurrent(kind)
    const before: Territory['status'] = kind === 'capture' ? 'free' : kind === 'own' ? 'mine' : 'other'
    const after: Territory['status'] = kind === 'attack' ? 'other' : 'mine'
    const fromColor = before === 'free' ? FREE_TERRITORY_COLOR : before === 'mine' ? ME : OTHER_TERRITORY_COLOR
    const toColor = after === 'mine' ? ME : OTHER_TERRITORY_COLOR
    // As in the app: the map already shows the sector after the catch (its sectors
    // refresh while the success screen is up), and the moment starts from before.
    setTerritories(base.map((t) => (t.id === TARGET ? withStatus(t, after) : t)))
    window.setTimeout(
      () =>
        mapRef.current?.playSectorMoment({
          id: TARGET,
          kind,
          fromColor,
          toColor,
          fromAvatarUrl: null,
          fromName: before === 'mine' ? 'Ты' : 'Сосед',
          toAvatarUrl: null,
          toName: 'Ты',
          defense: kind === 'attack' ? 1 : kind === 'own' ? 2 : 1,
          coins: kind === 'capture' || kind === 'steal' ? 55 : 30,
        }),
      600
    )
  }

  return (
    <div className="app-shell">
      <div style={{ position: 'fixed', inset: 0 }}>
        <MapView
          ref={mapRef}
          territories={territories}
          myTerritoryColor={ME}
          onSelect={() => {}}
          fallbackCenter={CITIES.batumi.center}
          fallbackZoom={CITIES.batumi.zoom}
          zoomShift={CITIES.batumi.zoomShift}
        />
      </div>
      <div style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 1000, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }} onClick={playAll}>
          Все подряд
        </button>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 12px', fontSize: 13, background: '#B42323' }} onClick={playAway}>
          Пока тебя не было
        </button>
        <button className="btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: 13, outline: newbie ? '2px solid #E8743B' : undefined }} onClick={showNewbie}>
          Задание новичка
        </button>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 12px', fontSize: 13, outline: current === k.kind ? '2px solid var(--accent, #E8743B)' : undefined }}
            onClick={() => playOne(k.kind)}
          >
            {k.label}
          </button>
        ))}
        {current && (
          <div style={{ flexBasis: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 12, background: 'rgba(10,14,30,0.82)', color: '#fff', fontSize: 13, lineHeight: 1.35 }}>
            <b>{KINDS.find((k) => k.kind === current)!.label}.</b> {KINDS.find((k) => k.kind === current)!.about}
          </div>
        )}
      </div>
      {newbie && (
        <div className="map-sheet-extras" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', zIndex: 900 }}>
          <FirstStepsPill />
        </div>
      )}
      <BottomNav active="screen-map" onNavigate={() => {}} onPlus={() => {}} />
      {away && (
        <AwayReplay
          events={AWAY_EVENTS}
          me={{ name: 'Ты', avatarUrl: null, color: ME }}
          play={(m, onDone) => mapRef.current?.playSectorMoment(m, onDone)}
          onOpenSector={() => {}}
          onClose={() => setAway(false)}
        />
      )}
    </div>
  )
}
