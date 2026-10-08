'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n'
import { TOURS, TOURS_VERSION, type Tour, type TourAudience, type TourStep } from '@/lib/data/tours'
import { useUiState } from '@/lib/uiState'

const PAD = 6

type Seen = Record<string, boolean>
const storeKey = (audience: TourAudience) => `range:tours:${TOURS_VERSION}:${audience}`

function readSeen(audience: TourAudience): Seen {
  try {
    return JSON.parse(localStorage.getItem(storeKey(audience)) ?? '{}') as Seen
  } catch {
    return {}
  }
}
function writeSeen(audience: TourAudience, seen: Seen) {
  try {
    localStorage.setItem(storeKey(audience), JSON.stringify(seen))
  } catch {
    // Private mode / storage off: a tour may show again — harmless.
  }
}

// The element a step points at, if it's really there for this player: in
// the visible screen (screens stay mounted underneath), laid out, and on
// screen sideways (the sector cards are a horizontal carousel).
function findTarget(target: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
  for (const el of all) {
    if (el.closest('.screen:not(.active)')) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el
  }
  return null
}

// Anything already covering the screen — a sheet, a modal, the week recap
// player — goes first; the tour waits its turn.
const busy = () => !!document.querySelector('.modal-overlay, .move-sheet-overlay, .recap-player')

// The screen dimmed around one element at a time, a note beside it,
// «Далее» / «Пропустить» — see lib/data/tours.ts for who gets which tour.
// «Что нового» only for players who were here before the update (a day or
// more) — anyone newer is a newcomer anyway.
export function SpotlightTours({ screen, audience, memberSince }: { screen: string; audience: TourAudience | null; memberSince: string | null }) {
  const { t } = useI18n()
  const [tour, setTour] = useState<{ def: Tour; steps: TourStep[] } | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  // Seen tours are kept on the account too (lib/uiState.ts), so a tour
  // finished on the phone doesn't start over in Telegram on the desktop.
  const ui = useUiState()
  const uiKey = audience ? `tours:${TOURS_VERSION}:${audience}` : null
  const remoteSeen = uiKey ? ((ui.state?.[uiKey] as Seen | undefined) ?? null) : null
  const remoteSeenKey = JSON.stringify(remoteSeen ?? {})

  // Look for a tour of this screen that's due: unseen, its key element there.
  useEffect(() => {
    if (!audience || tour || !ui.ready) return
    if (audience === 'whatsNew' && (!memberSince || Date.now() - new Date(memberSince).getTime() < 24 * 3600 * 1000)) return
    const candidates = TOURS[audience].filter((x) => x.screen === screen)
    if (candidates.length === 0) return
    const fromAccount = JSON.parse(remoteSeenKey) as Seen
    const id = window.setInterval(() => {
      const seen = { ...readSeen(audience), ...fromAccount }
      if (seen.skip) {
        window.clearInterval(id)
        return
      }
      if (busy()) return
      for (const def of candidates) {
        if (seen[def.id] || !findTarget(def.requires)) continue
        const steps = def.steps.filter((s) => findTarget(s.target))
        if (steps.length === 0) continue
        window.clearInterval(id)
        setIndex(0)
        setTour({ def, steps })
        return
      }
    }, 900)
    return () => window.clearInterval(id)
  }, [screen, audience, tour, memberSince, ui.ready, remoteSeenKey])

  // Leaving the screen mid-tour closes it (it shows again next time).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tour belongs to the screen it started on
    if (tour && screen !== tour.def.screen) setTour(null)
  }, [screen, tour])

  // Follow the target: scrolled into view on each step, then measured every
  // frame while the tour is up (cheap — one rect), so the window keeps up
  // with scrolling and layout shifts.
  const step = tour?.steps[index]
  useEffect(() => {
    if (!step) return
    findTarget(step.target)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    let raf = 0
    const tick = () => {
      const now = findTarget(step.target)
      setRect(now ? now.getBoundingClientRect() : null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])

  if (!tour || !step || !rect || !audience) return null

  const finish = (all: boolean) => {
    const seen = { ...readSeen(audience), ...(remoteSeen ?? {}) }
    seen[tour.def.id] = true
    if (all) seen.skip = true
    writeSeen(audience, seen)
    if (uiKey) ui.set(uiKey, seen)
    setTour(null)
  }
  const last = index === tour.steps.length - 1

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
        key={`${tour.def.id}-${index}`}
        className={`tour-tip ${below ? 'below' : 'above'}`}
        style={{ left: tipLeft, width: tipW, ...(below ? { top: hole.top + hole.height + 14 } : { bottom: vh - hole.top + 14 }) }}
      >
        <span className="tour-arrow" style={{ left: arrowX - 7 }} />
        <div className="tour-kicker">
          {tour.steps.length > 1
            ? t(audience === 'newcomer' ? 'tour.kickerTip' : 'tour.kicker', { n: index + 1, total: tour.steps.length })
            : t('tour.kickerTipOne')}
        </div>
        <div className="tour-title">{t(`tour.${step.key}.title`)}</div>
        <div className="tour-text">{t(`tour.${step.key}.text`)}</div>
        <div className="tour-actions">
          {tour.steps.length > 1 ? (
            <button className="tour-skip" onClick={() => finish(true)}>
              {t('tour.skip')}
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary tour-next" onClick={() => (last ? finish(false) : setIndex(index + 1))}>
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
