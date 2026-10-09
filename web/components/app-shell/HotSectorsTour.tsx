'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/providers/AuthProvider'
import { useDoubleCoinsUntil } from '@/components/app-shell/DoubleCoinsChip'
import type { MapScreenHandle } from '@/components/app-shell/screens/MapScreen'
import { useI18n } from '@/lib/i18n'
import { formatWeekdayTime } from '@/lib/i18n/format'
import { CITIES, type CityId } from '@/lib/data/city'
import { useUiState } from '@/lib/uiState'
import { useNow } from '@/lib/useNow'
import { releaseTour, tourLocked, tryLockTour } from '@/lib/tourLock'
import type { Territory } from '@/lib/data/types'

// The week's hot sectors, walked through once like the onboarding tours: the
// screen dims, the map flies to each hot sector in turn with a window cut
// around it and a note beside it, then to both together with the rules. The
// first time the map is opened after Friday's pick (pick_hot_sectors, 12:00).
// Seen per week (the sectors' end date) on the account (lib/uiState.ts) and
// on the device, so it isn't shown again in Telegram after the phone. Marked
// seen the moment it starts, not when it's finished: closing the app or
// leaving the map halfway doesn't bring it back.

const storeKey = (userId: string, city: CityId) => `range:hotTour:${userId}:${city}`
const LOCK = 'hot-sectors'
const PAD = 10

export function useHotSectorsTour(territories: Territory[], city: CityId) {
  const { user } = useAuth()
  const ui = useUiState()
  const now = useNow(60_000)
  const prefix = CITIES[city].idPrefix
  // The popular one (most catches) first, its neighbour second — as picked.
  const sectors = territories
    .filter((t) => t.id.startsWith(prefix) && !!t.hotUntil && new Date(t.hotUntil).getTime() > now)
    .sort((a, b) => b.catchCount - a.catchCount)
    .slice(0, 2)
  const weekKey = sectors[0]?.hotUntil?.slice(0, 10) ?? null
  const uiKey = `hot_tour_seen:${city}`
  const remote = (ui.state?.[uiKey] as string | undefined) ?? null
  // Up from start() until the tour ends — the seen flag is already set by then.
  const [running, setRunning] = useState(false)

  // Read on each render rather than once after mount, so there's no first
  // render in which this device's flag isn't known yet.
  let localSeen: string | null = null
  if (user && typeof window !== 'undefined') {
    try {
      localSeen = localStorage.getItem(storeKey(user.id, city))
    } catch {
      // Storage off: the account's flag still covers it.
    }
  }
  const due = !!user && ui.ready && !!weekKey && remote !== weekKey && localSeen !== weekKey

  function start() {
    if (!user || !weekKey) return
    try {
      localStorage.setItem(storeKey(user.id, city), weekKey)
    } catch {
      // As above.
    }
    ui.set(uiKey, weekKey)
    setRunning(true)
  }

  return { show: running || due, sectors, start, end: () => setRunning(false) }
}

// A sheet, a modal or the week recap on screen goes first; so does another tour.
const busy = () => tourLocked() || !!document.querySelector('.modal-overlay, .move-sheet-overlay, .recap-player')

type Step = { ids: string[]; title: string; text: string }

export function HotSectorsTour({
  sectors,
  map,
  onStart,
  onDone,
}: {
  sectors: Territory[]
  map: RefObject<MapScreenHandle | null>
  onStart: () => void
  onDone: (finished: boolean) => void
}) {
  const { lang } = useI18n()
  const { user } = useAuth()
  const doubled = useDoubleCoinsUntil() !== null
  const [started, setStarted] = useState(false)
  const startedRef = useRef(false)
  const doneRef = useRef(false)
  const onStartRef = useRef(onStart)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    startedRef.current = started
    onStartRef.current = onStart
    onDoneRef.current = onDone
  })
  const [index, setIndex] = useState(0)
  const [settled, setSettled] = useState(false)
  const [outline, setOutline] = useState<[number, number][][] | null>(null)

  const [a, b] = sectors
  const until = a?.hotUntil ? formatWeekdayTime(a.hotUntil, lang) : ''
  const holdsIt = (t: Territory) => t.ownerId === user?.id || t.coHolders.some((h) => h.isMe)
  const holder = (t: Territory) =>
    holdsIt(t) ? 'Сейчас он твой — удержи!' : t.ownerId ? `Сейчас его держит ${t.ownerDisplayName ?? 'другой рыбак'}.` : 'Пока свободен — займи первым уловом.'
  const steps: Step[] = a
    ? [
        {
          ids: [a.id],
          title: `${a.id} — горячий сектор недели`,
          text: `Здесь ловили больше всего за месяц. До ${until} улов тут — ×${doubled ? 3 : 2} монеты${
            doubled ? ' вместе с твоими двойными' : ' (с «Двойными монетами» — ×3)'
          }, Казна — втрое больше. ${holder(a)}`,
        },
        ...(b
          ? [
              {
                ids: [b.id],
                title: `${b.id} — второй горячий`,
                text: `Сосед ${a.id}, горит тоже до ${until} — те же ×${doubled ? 3 : 2} монеты за улов. ${holder(b)}`,
              },
            ]
          : []),
        {
          ids: sectors.map((t) => t.id),
          title: 'Удержи до конца воскресенья',
          text: 'Кто держит горячий сектор в конце недели — +100 монет и медаль. Щиты на горячие сектора не ставятся: побороться можно до последней минуты.',
        },
      ]
    : []
  const step = steps[index]
  const stepKey = step?.ids.join(',') ?? ''

  // Wait for the screen to be free, then take the one-tour lock.
  useEffect(() => {
    if (started) return
    const id = window.setInterval(() => {
      if (busy() || !tryLockTour(LOCK)) return
      window.clearInterval(id)
      setStarted(true)
      onStartRef.current()
    }, 900)
    return () => window.clearInterval(id)
  }, [started])
  // Taken off screen halfway (the player left the map): it's over — already
  // marked seen, so it doesn't start again, here or on the next launch.
  useEffect(
    () => () => {
      releaseTour(LOCK)
      if (startedRef.current && !doneRef.current) onDoneRef.current(false)
    },
    []
  )

  // Each step: fly there, keep the window on the sectors every frame (it
  // rides along with the flight), and bring the note in once the map lands.
  useEffect(() => {
    if (!started || !stepKey) return
    const ids = stepKey.split(',')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new step hides the note until the map lands
    setSettled(false)
    map.current?.focusTerritories(ids)
    const landed = window.setTimeout(() => setSettled(true), 950)
    let raf = 0
    const tick = () => {
      setOutline(map.current?.territoriesOutline(ids) ?? null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      window.clearTimeout(landed)
      cancelAnimationFrame(raf)
    }
  }, [started, stepKey, map])

  if (!started || !step || !outline) return null

  const points = outline.flat()
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const rect = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  // The window is cut in the sectors' own shape: the whole screen dimmed,
  // the hexagons left clear (even-odd) and edged in the hot orange.
  const hexes = outline.map((shape) => `M${shape.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`).join(' ')
  const vw = window.innerWidth

  const finish = (all: boolean) => {
    releaseTour(LOCK)
    doneRef.current = true
    onDone(!all)
  }
  const last = index === steps.length - 1

  const vh = window.innerHeight
  const shell = document.querySelector('.app-shell')?.getBoundingClientRect()
  const minX = (shell?.left ?? 0) + 16
  const maxX = (shell?.right ?? window.innerWidth) - 16
  const hole = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
  const tipW = Math.min(300, maxX - minX)
  const center = rect.left + rect.width / 2
  const tipLeft = Math.max(minX, Math.min(center - tipW / 2, maxX - tipW))
  const below = vh - (hole.top + hole.height) > 230 || hole.top < 230
  const arrowX = Math.max(20, Math.min(center - tipLeft, tipW - 20))

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label={step.title}>
      <svg className="hot-tour-mask" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} aria-hidden>
        <path d={`M0 0H${vw}V${vh}H0Z ${hexes}`} fillRule="evenodd" fill="rgba(8,10,14,.66)" />
        <path key={stepKey} className="hot-tour-edge" d={hexes} fill="none" stroke="#FF7A2F" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      {settled && (
        <div
          key={stepKey}
          className={`tour-tip ${below ? 'below' : 'above'}`}
          style={{ left: tipLeft, width: tipW, ...(below ? { top: hole.top + hole.height + 14 } : { bottom: vh - hole.top + 14 }) }}
        >
          <span className="tour-arrow" style={{ left: arrowX - 7 }} />
          <div className="tour-kicker">
            Горячие сектора · {index + 1} из {steps.length}
          </div>
          <div className="tour-title">{step.title}</div>
          <div className="tour-text">{step.text}</div>
          <div className="tour-actions">
            <button className="tour-skip" onClick={() => finish(true)}>
              Пропустить
            </button>
            <button className="btn-primary tour-next" onClick={() => (last ? finish(false) : setIndex(index + 1))}>
              {last ? 'Понятно' : 'Далее'}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
