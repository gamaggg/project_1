'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { IntroMap } from '@/components/app-shell/onboarding/IntroMap'
import type { IntroOptions, IntroScene, IntroView } from '@/lib/welcome/introScene'
import { tn } from '@/lib/i18n/runtime'

// «The coast is cut into hundreds of sectors» — as the welcome screen's night
// map you can play with: tap any sector and it is yours, a free one by
// claiming it, one held by another player by taking it from them. Until the
// first touch a finger plays that by itself, once: a free sector, then a held
// one — and the text underneath says what is happening as it does.
// The place: Batumi at «Али и Нино» on the boulevard — these screens come before
// the city is chosen, so it is always Batumi.
const OPTIONS: IntroOptions = { center: 'B1126', zoom: 2.0, radius: 130, at: 0.5, pitch: 0.8, yaw: 0.35 }
type Action = 'idle' | 'free' | 'steal'
// The text starts as the first thing the demo shows (a free sector), not as the
// headline — except where the demo doesn't play (reduced motion).
const startsPlaying = () => typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function TerritoryIntroStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [scene, setScene] = useState<IntroScene | null>(null)
  const [view, setView] = useState<IntroView | null>(null)
  const [demo, setDemo] = useState(true)
  const [mine, setMine] = useState(0)
  const [action, setAction] = useState<Action>(() => (startsPlaying() ? 'free' : 'idle'))
  const [finger, setFinger] = useState({ x: 0, y: 0, show: false, tap: false })
  const chipRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const capTimer = useRef(0)
  useEffect(() => () => clearTimeout(capTimer.current), [])

  // Takes a sector and tells what it was: the caption follows the action and
  // stays until the next one — it goes back to the headline only a few seconds
  // after the last, never in the gap between two (that flickered). `hold` is for
  // the demo's first step, which another one follows.
  const claim = useCallback(
    (id: string, hold = false) => {
      if (!scene) return
      const role = scene.roleOf(id)
      if (role !== 'mine') {
        setAction(role === 'other' ? 'steal' : 'free')
        clearTimeout(capTimer.current)
        if (!hold) capTimer.current = window.setTimeout(() => setAction('idle'), 4800)
      }
      scene.claim(id)
      setMine(scene.mineCount())
    },
    [scene]
  )

  // The self-playing demo, once, until the first touch.
  useEffect(() => {
    if (!demo || !scene || !view || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (alive) fn()
        }, ms)
      )
    }
    let step = 0
    const run = () => {
      if (step >= 2) {
        setFinger((f) => ({ ...f, show: false }))
        setDemo(false)
        return
      }
      const role = step === 0 ? 'free' : 'other'
      let pool = scene.candidates(role, view)
      if (!pool.length) pool = scene.candidates(role === 'free' ? 'other' : 'free', view)
      const id = pool[Math.floor(Math.random() * pool.length)]
      const at = id ? scene.screenOf(id) : null
      if (!at) {
        setDemo(false)
        return
      }
      setFinger({ x: at[0], y: at[1], show: true, tap: false })
      const hold = step === 0
      after(950, () => {
        setFinger((f) => ({ ...f, tap: true }))
        after(170, () => claim(id, hold))
      })
      after(950 + 170 + 3500, () => {
        step += 1
        setFinger((f) => ({ ...f, tap: false }))
        run()
      })
    }
    after(1100, run)
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [demo, scene, view, claim])

  const caption =
    action === 'free'
      ? { title: tn('onb.capFreeTitle'), sub: tn('onb.capFreeSub') }
      : action === 'steal'
        ? { title: tn('onb.capStealTitle'), sub: tn('onb.capStealSub') }
        : { title: tn('onb.startsHere'), sub: tn('onb.startsSub') }

  return (
    <div className="intro-screen intro-screen--night">
      <IntroMap
        options={OPTIONS}
        topRef={chipRef}
        bottomRef={copyRef}
        onScene={setScene}
        onView={setView}
        onPick={(id) => {
          setDemo(false)
          setFinger((f) => ({ ...f, show: false }))
          claim(id)
        }}
      />
      <BackButton onClick={onBack} variant="intro" stroke="#fff" />
      <div className="inn-top" ref={chipRef}>
        <div className="inn-chip">
          <span className="inn-chip-hex" aria-hidden />
          {tn('onb.hundreds')}
        </div>
      </div>
      <div className="intro-illustration" />
      <span className={`id-finger${finger.show ? ' show' : ''}${finger.tap ? ' tap' : ''}`} style={{ transform: `translate(${finger.x - 20}px, ${finger.y - 20}px)` }} aria-hidden />
      <div className="intro-copy" ref={copyRef}>
        <div className="inn-legend">
          <span>
            <i className="inn-sw inn-sw--free" />
            {tn('onb.legendFree')}
          </span>
          <span>
            <i className="inn-sw inn-sw--other" />
            {tn('onb.legendTaken')}
          </span>
          <span>
            <i className="inn-sw inn-sw--mine" />
            {tn('onb.legendMine')} · {mine}
          </span>
        </div>
        <div key={action} className="inn-cap" aria-live="polite">
          <div className="intro-title">{caption.title}</div>
          <div className="intro-sub">{caption.sub}</div>
        </div>
        <button className="intro-cta" onClick={onDone}>
          {tn('onb.continue')}
        </button>
      </div>
    </div>
  )
}
