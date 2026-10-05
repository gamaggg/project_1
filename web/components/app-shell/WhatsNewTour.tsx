'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n'
import { WHATS_NEW_TOURS, WHATS_NEW_VERSION, type TourStep } from '@/lib/data/whatsNew'

const STORE = `range:whats-new:${WHATS_NEW_VERSION}`
const PAD = 6

type Seen = Record<string, boolean>

function readSeen(): Seen {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Seen
  } catch {
    return {}
  }
}
function writeSeen(seen: Seen) {
  try {
    localStorage.setItem(STORE, JSON.stringify(seen))
  } catch {
    // Private mode / storage off: the tour may show again — harmless.
  }
}

// The element a step points at, if it's really there for this player: in
// the visible screen (screens stay mounted underneath), laid out, not
// inside a closed overlay.
function findTarget(target: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
  for (const el of all) {
    if (el.closest('.screen:not(.active)')) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

// Anything already covering the screen — a sheet, a modal, the week recap
// player — goes first; the tour waits its turn.
const busy = () => !!document.querySelector('.modal-overlay, .move-sheet-overlay, .recap-player')

// «Что нового» (see lib/data/whatsNew.ts): the screen dimmed around one
// element at a time, a note beside it, «Далее» / «Пропустить».
// Only for players who were here before the update (a day or more) — a
// newcomer gets the regular onboarding, and «new» means nothing to them.
export function WhatsNewTour({ screen, enabled, memberSince }: { screen: string; enabled: boolean; memberSince: string | null }) {
  const { t } = useI18n()
  const [steps, setSteps] = useState<TourStep[] | null>(null)
  const [tourScreen, setTourScreen] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Start a screen's tour a moment after it opens (its data and layout
  // settle first), with only the steps whose elements are actually there.
  useEffect(() => {
    if (!enabled || steps || !memberSince || Date.now() - new Date(memberSince).getTime() < 24 * 3600 * 1000) return
    const tour = WHATS_NEW_TOURS[screen]
    if (!tour) return
    const seen = readSeen()
    if (seen.skip || seen[screen]) return
    let tries = 0
    const id = window.setInterval(() => {
      tries++
      if (busy()) return
      const present = tour.filter((s) => findTarget(s.target))
      if (present.length === 0 && tries < 6) return
      window.clearInterval(id)
      if (present.length === 0) return
      setTourScreen(screen)
      setIndex(0)
      setSteps(present)
    }, 900)
    return () => window.clearInterval(id)
  }, [screen, enabled, steps, memberSince])

  // Leaving the screen mid-tour closes it (it shows again next time).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tour belongs to the screen it started on
    if (steps && tourScreen && screen !== tourScreen) setSteps(null)
  }, [screen, steps, tourScreen])

  // Follow the target: scrolled into view on each step, then measured every
  // frame while the tour is up (cheap — one rect), so the window keeps up
  // with scrolling and layout shifts.
  const step = steps?.[index]
  useEffect(() => {
    if (!step) return
    const el = findTarget(step.target)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    let raf = 0
    const tick = () => {
      const now = findTarget(step.target)
      setRect(now ? now.getBoundingClientRect() : null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])

  if (!steps || !step || !rect || !tourScreen) return null

  const finish = (all: boolean) => {
    const seen = readSeen()
    seen[tourScreen] = true
    if (all) seen.skip = true
    writeSeen(seen)
    setSteps(null)
  }
  const last = index === steps.length - 1

  // Kept inside the app's own column, not the window: on a wide screen the
  // app is a phone-width column in the middle, and a note clamped to the
  // window's edge stuck to the column's side.
  const vh = window.innerHeight
  const shell = document.querySelector('.app-shell')?.getBoundingClientRect()
  const minX = (shell?.left ?? 0) + 16
  const maxX = (shell?.right ?? window.innerWidth) - 16
  const hole = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
  const tipW = Math.min(300, maxX - minX)
  const center = rect.left + rect.width / 2
  const tipLeft = Math.max(minX, Math.min(center - tipW / 2, maxX - tipW))
  const below = vh - (hole.top + hole.height) > 210 || hole.top < 210
  const arrowX = Math.max(20, Math.min(center - tipLeft, tipW - 20))

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label={t(`tour.${step.key}.title`)}>
      <div className="tour-hole" style={hole} />
      <div
        key={index}
        className={`tour-tip ${below ? 'below' : 'above'}`}
        style={{ left: tipLeft, width: tipW, ...(below ? { top: hole.top + hole.height + 14 } : { bottom: vh - hole.top + 14 }) }}
      >
        <span className="tour-arrow" style={{ left: arrowX - 7 }} />
        <div className="tour-kicker">{t('tour.kicker', { n: index + 1, total: steps.length })}</div>
        <div className="tour-title">{t(`tour.${step.key}.title`)}</div>
        <div className="tour-text">{t(`tour.${step.key}.text`)}</div>
        <div className="tour-actions">
          <button className="tour-skip" onClick={() => finish(true)}>
            {t('tour.skip')}
          </button>
          <button className="btn-primary tour-next" onClick={() => (last ? finish(false) : setIndex(index + 1))}>
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
