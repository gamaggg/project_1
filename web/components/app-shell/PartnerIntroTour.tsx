'use client'

import '@/app/partner-points.css'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/providers/AuthProvider'
import type { MapScreenHandle } from '@/components/app-shell/screens/MapScreen'
import { usePartnerPoints } from '@/lib/supabase/queries'
import { useUiState } from '@/lib/uiState'
import { releaseTour, tourLocked, tryLockTour } from '@/lib/tourLock'
import { CITIES, type CityId } from '@/lib/data/city'
import type { PartnerPoint } from '@/lib/data/partnerPoints'
import { tn } from '@/lib/i18n/runtime'

// A new partner on the map, shown once to every player of its city (owner, 14.11.2026): the next time the map is
// open, it flies to the partner's pin, dims the rest with a round window around the pin and says what it is, with
// «Открыть» (the card) and «Позже». Like the hot-sector tour (HotSectorsTour.tsx): one tour at a time (tourLock),
// waits for sheets and modals, seen per point on the account (user_ui_state) and on the device, marked seen the
// moment it starts. Each new partner point gets its own intro, but at most one per launch of the app (owner, 14.11):
// with several new partners at once they don't follow one another — the next one waits for the next launch.

const LOCK = 'partner-intro'
const uiKey = (id: number) => `partner_intro:${id}`
const storeKey = (userId: string, id: number) => `range:partnerIntro:${userId}:${id}`
// Set when an intro starts; lives as long as the page, so a reload of the app is a new launch.
let shownThisLaunch = false

export function usePartnerIntroTour(city: CityId) {
  const { user } = useAuth()
  const ui = useUiState()
  const { data: points = [] } = usePartnerPoints()
  const [running, setRunning] = useState<PartnerPoint | null>(null)

  const seenHere = (id: number) => {
    if (!user || typeof window === 'undefined') return false
    try {
      return localStorage.getItem(storeKey(user.id, id)) === '1'
    } catch {
      return false
    }
  }
  const next = user && ui.ready && !shownThisLaunch ? points.find((p) => p.city === city && !ui.state?.[uiKey(p.id)] && !seenHere(p.id)) ?? null : null

  function start(p: PartnerPoint) {
    if (!user) return
    shownThisLaunch = true
    try {
      localStorage.setItem(storeKey(user.id, p.id), '1')
    } catch {
      // Storage off: the account's flag still covers it.
    }
    ui.set(uiKey(p.id), true)
    setRunning(p)
  }

  const point = running ?? next
  return { show: !!point, point, start, end: () => setRunning(null) }
}

const busy = () => tourLocked() || !!document.querySelector('.modal-overlay, .move-sheet-overlay, .recap-player')
const PAD = 12

export function PartnerIntroTour({
  point,
  map,
  onStart,
  onDone,
}: {
  point: PartnerPoint
  map: RefObject<MapScreenHandle | null>
  onStart: (p: PartnerPoint) => void
  onDone: () => void
}) {
  const [started, setStarted] = useState(false)
  const [settled, setSettled] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const startedRef = useRef(false)
  const doneRef = useRef(false)
  const onStartRef = useRef(onStart)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    startedRef.current = started
    onStartRef.current = onStart
    onDoneRef.current = onDone
  })
  const tipRef = useRef<HTMLDivElement>(null)
  const [tipH, setTipH] = useState(190)
  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight)
  }, [settled])

  // Wait for the screen to be free, then take the one-tour lock.
  useEffect(() => {
    if (started) return
    const id = window.setInterval(() => {
      if (busy() || !tryLockTour(LOCK)) return
      window.clearInterval(id)
      setStarted(true)
      onStartRef.current(point)
    }, 900)
    return () => window.clearInterval(id)
  }, [started, point])
  // Taken off screen halfway (the player left the map): over, already marked seen.
  useEffect(
    () => () => {
      releaseTour(LOCK)
      if (startedRef.current && !doneRef.current) onDoneRef.current()
    },
    []
  )

  // Fly to the pin (close enough for its name), then follow it every frame until the tour ends.
  useEffect(() => {
    if (!started) return
    map.current?.flyToView([point.lat, point.lng], CITIES[point.city].zoom + 1.5)
    const landed = window.setTimeout(() => setSettled(true), 1100)
    let raf = 0
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`.pp-mk[data-pp="${point.id}"]`)
      const target = el?.querySelector<HTMLElement>('.pp-mk-pin, .pp-mk-own') ?? el
      setRect(target ? target.getBoundingClientRect() : null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      window.clearTimeout(landed)
      cancelAnimationFrame(raf)
    }
  }, [started, point, map])

  if (!started) return null

  const finish = (open: boolean) => {
    releaseTour(LOCK)
    doneRef.current = true
    onDone()
    if (open) map.current?.openPartner(point.id)
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  // The round window around the pin (its drop or the partner's own picture); until the pin is found, the middle.
  const cx = rect ? rect.left + rect.width / 2 : vw / 2
  const cy = rect ? rect.top + rect.height / 2 : vh / 2
  const r = rect ? Math.max(rect.width, rect.height) / 2 + PAD + 8 : 44
  const shell = document.querySelector('.app-shell')?.getBoundingClientRect()
  const minX = (shell?.left ?? 0) + 16
  const maxX = (shell?.right ?? vw) - 16
  const tipW = Math.min(300, maxX - minX)
  const tipLeft = Math.max(minX, Math.min(cx - tipW / 2, maxX - tipW))
  const GAP = 16
  const EDGE = 16
  const below = vh - (cy + r) - GAP - EDGE >= tipH
  const tipTop = Math.max(EDGE, Math.min(below ? cy + r + GAP : cy - r - GAP - tipH, vh - tipH - EDGE))
  const arrowX = Math.max(20, Math.min(cx - tipLeft, tipW - 20))
  const text = point.promoCode && point.promoDiscount ? tn('partner.introPromo', { discount: point.promoDiscount }) : tn('partner.introPlain')

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label={tn('partner.introTitle', { name: point.name })}>
      <svg className="hot-tour-mask" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} aria-hidden>
        <path d={`M0 0H${vw}V${vh}H0Z M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`} fillRule="evenodd" fill="rgba(8,10,14,.66)" />
        <circle className="hot-tour-edge" cx={cx} cy={cy} r={r} fill="none" stroke="#FF7A2F" strokeWidth="3" />
      </svg>
      {/* A tap on the pin itself opens the card, as on the map. */}
      <button type="button" className="ppi-hole" style={{ left: cx - r, top: cy - r, width: r * 2, height: r * 2 }} onClick={() => finish(true)} aria-label={tn('partner.introOpen')} />
      {settled && (
        <div ref={tipRef} className={`tour-tip ${below ? 'below' : 'above'}`} style={{ left: tipLeft, width: tipW, top: tipTop }}>
          <span className="tour-arrow" style={{ left: arrowX - 7 }} />
          <div className="tour-kicker">{tn('partner.introKicker')}</div>
          <div className="tour-title">{tn('partner.introTitle', { name: point.name })}</div>
          <div className="tour-text">{text}</div>
          <div className="tour-actions">
            <button className="tour-skip" onClick={() => finish(false)}>
              {tn('partner.introLater')}
            </button>
            <button className="btn-primary tour-next" onClick={() => finish(true)}>
              {tn('partner.introOpen')}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
