'use client'

import { useEffect, useRef, useState } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import type { TourStep } from '@/lib/clan2/tours'
import { useDemoState } from '@/lib/clan2/demoStore'
import { tn } from '@/lib/i18n/runtime'

// The spotlight tour, inside the phone of the preview: an introduction card,
// then each step dims the screen around one element and puts a note beside it.
// `onStep` moves the screen to where the step's element is (tab, section).

type Box = { x: number; y: number; w: number; h: number; ph: number }

export function C2Tour({ steps, onStep, onClose }: { steps: TourStep[]; onStep: (step: TourStep) => void; onClose: () => void }) {
  const s = useDemoState()
  const [i, setI] = useState(-1)
  const [box, setBox] = useState<Box | null>(null)
  // 'out' while moving between steps (the note hidden, the frame closed and gliding), 'in' once a step is shown.
  const [phase, setPhase] = useState<'out' | 'in'>('out')
  // The step whose text the note shows: it changes only while the note is hidden, never under the reader's eyes.
  const [shown, setShown] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const hadBox = useRef(false)
  const step = i >= 0 ? steps[i] : null

  // While the tour is open the reader does not scroll: the tour itself moves the screen from step to step.
  // Wheel, touch drags and scrolling keys are swallowed; taps on the note's buttons still work.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault()
    const keys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])
    const stopKey = (e: KeyboardEvent) => {
      if (keys.has(e.key)) e.preventDefault()
    }
    window.addEventListener('wheel', stop, { passive: false })
    window.addEventListener('touchmove', stop, { passive: false })
    window.addEventListener('keydown', stopKey)
    return () => {
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchmove', stop)
      window.removeEventListener('keydown', stopKey)
    }
  }, [])

  useEffect(() => {
    if (!step) return
    let dead = false
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((done) => void timers.push(window.setTimeout(done, ms)))
    let follow: (() => void) | null = null
    void (async () => {
      // 1. The note fades and the frame closes, then the screen moves to the step's tab or section under the dim.
      await wait(hadBox.current ? 200 : 0)
      if (dead) return
      onStep(step)
      await wait(320)
      if (dead) return
      const phone = root.current?.closest('.c2-phone')
      const el = step.target ? phone?.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      if (!phone || !el) {
        setBox(null)
        hadBox.current = false
        setShown(i)
        setPhase('in')
        return
      }
      // 2. The page glides to put the element at the top of the screen, so its note has room under it; below the
      // sticky clan tabs when the element is under them, so they never cover its top.
      const tabs = el.closest('.c2-phone-body')?.querySelector<HTMLElement>('.c2-subtabs')
      const underTabs = tabs && tabs.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING ? tabs.offsetHeight : 0
      el.style.scrollMarginTop = `${underTabs + 16}px`
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
      // Settled once the element has kept still for a few frames (or after 900 ms at most).
      await new Promise<void>((done) => {
        let lastTop = NaN
        let still = 0
        const started = performance.now()
        const tick = () => {
          if (dead) return done()
          const top = el.getBoundingClientRect().top
          still = Math.abs(top - lastTop) < 0.5 ? still + 1 : 0
          lastTop = top
          if (still >= 4 || performance.now() - started > 900) return done()
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        // Frames stop in a hidden tab: a plain timer finishes the wait there.
        timers.push(window.setTimeout(done, 1000))
      })
      if (dead) return
      // A glide cut short (a hidden tab, a touch) is finished at once; after a full glide this changes nothing.
      el.scrollIntoView({ block: 'start', behavior: 'auto' })
      // 3. The closed frame glides onto the element, then it opens and the note rises. Measured against the tour
      // layer itself: the phone's screen on a desktop, the whole screen on a phone (there the sandbox is the page
      // and the layer is fixed to the screen).
      const measure = () => {
        const p = (root.current ?? phone).getBoundingClientRect()
        const r = el.getBoundingClientRect()
        setBox({ x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height, ph: p.height })
      }
      measure()
      await wait(hadBox.current ? 380 : 60)
      hadBox.current = true
      if (dead) return
      setShown(i)
      setPhase('in')
      // While the step is shown the frame follows any scroll or resize at once.
      follow = measure
      window.addEventListener('scroll', measure, true)
      window.addEventListener('resize', measure)
    })()
    return () => {
      dead = true
      timers.forEach((t) => window.clearTimeout(t))
      if (follow) {
        window.removeEventListener('scroll', follow, true)
        window.removeEventListener('resize', follow)
      }
    }
    // onStep changes identity each render of the shell; the step is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const shownStep = steps[shown]
  const last = shown === steps.length - 1
  // The note always sits under the lit element and never covers it. An element too tall for the screen with its
  // note is lit only down to where the note begins (its top part: the title and what it is about). Only an
  // element pinned too low to have a note under it (nothing left to scroll) gets the note above it.
  const NOTE = 160 // the note's height with a margin
  const BAR = 90 // the tab bar at the bottom of the screen
  const fitH = box ? Math.min(box.h, box.ph - BAR - NOTE - 14 - box.y) : 0
  const below = box !== null && fitH >= Math.min(box.h, 48)
  const spot = box ? { ...box, h: below ? fitH : box.h } : null
  const cardStyle = !box ? { top: 260 } : below ? { top: box.y + fitH + 14 } : { bottom: box.ph - box.y + 14 }

  return (
    <div className="c2-tour" ref={root}>
      {i < 0 ? (
        <div className="c2-tour-intro">
          <div className="c2-tour-crest">
            <ClanCrest crest={s.clan.crest} size={92} shine />
          </div>
          <h2>{tn('clan2.tour.introTitle')}</h2>
          <p>{tn('clan2.tour.introText')}</p>
          <button className="btn-primary" onClick={() => setI(0)}>
            {tn('clan2.tour.introStart')}
          </button>
          <button className="c2-link" onClick={onClose}>
            {tn('clan2.tour.skip')}
          </button>
        </div>
      ) : (
        <>
          {spot ? (
            <div className={`c2-tour-spot${phase === 'out' ? ' out' : ''}`} style={{ left: spot.x - 6, top: spot.y - 6, width: spot.w + 12, height: spot.h + 12 }} />
          ) : (
            <div className="c2-tour-dim" />
          )}
          <div className={`c2-tour-card${phase === 'out' ? ' out' : ''}`} style={cardStyle} aria-live="polite">
            <p>{shownStep ? tn(shownStep.text) : ''}</p>
            <div className="c2-tour-foot">
              <span className="c2-muted small">{tn('clan2.tour.of', { a: shown + 1, b: steps.length })}</span>
              <span className="c2-tour-btns">
                {!last && (
                  <button className="c2-link" onClick={onClose}>
                    {tn('clan2.tour.skip')}
                  </button>
                )}
                <button
                  className="c2-tour-next"
                  onClick={() => {
                    if (last) return onClose()
                    setPhase('out')
                    setI(shown + 1)
                  }}
                >
                  {last ? tn('clan2.tour.done') : tn('clan2.tour.next')}
                </button>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
