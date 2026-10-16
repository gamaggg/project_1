'use client'

import { useEffect, useRef, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { IntroMap } from '@/components/app-shell/onboarding/IntroMap'
import type { IntroOptions, IntroScene, IntroView } from '@/lib/welcome/introScene'
import { tn } from '@/lib/i18n/runtime'

// The mechanic in one gesture, on the welcome screen's night map, playing by
// itself once: a flash, the photo of the catch flies up to the sector, and the
// sector rises in orange with rings on the water — first a free sector, then
// one held by a player (taken from them). The chip on top and the text under
// the map say what is happening as it does. The place is Batumi (the intro comes
// before the city is chosen).
// Another stretch of the shore than the first screen shows (7 km from it), at the
// same zoom.
const OPTIONS: IntroOptions = { center: 'B0689', zoom: 2.0, radius: 130, at: 0.5, pitch: 0.8, yaw: 0.35 }
const HOLDER = { holder: 'Maksym', color: '#A77BFF' }
const FISH = ['#FFB067', '#7AC8FF']
type Act = 'idle' | 'free' | 'steal'
// The text starts as the first thing the demo shows (a free sector), not as the
// headline — except where the demo doesn't play (reduced motion).
const startsPlaying = () => typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function CatchIntroStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [scene, setScene] = useState<IntroScene | null>(null)
  const [act, setAct] = useState<Act>(() => (startsPlaying() ? 'free' : 'idle'))
  const [claimed, setClaimed] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [photo, setPhoto] = useState<{ k: number; x: number; y: number; dx: number; dy: number; fish: string } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<IntroView | null>(null)

  // The whole show, once, a moment after the map is up.
  useEffect(() => {
    if (!scene) return
    const id = scene.centreId
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      scene.set(id, 'free')
      scene.claim(id)
      return
    }
    let alive = true
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (alive) fn()
        }, ms)
      )
    }
    // One run: the flash, the photo up to the sector, then the sector is taken.
    const run = (kind: 'free' | 'steal', at: number, fish: string) => {
      after(at, () => {
        setAct(kind)
        setClaimed(false)
        setFlashKey((x) => x + 1)
      })
      after(at + 180, () => {
        const root = rootRef.current?.getBoundingClientRect()
        const view = viewRef.current
        const to = scene.screenOf(id)
        if (root && view && to) {
          const sx = view.w / 2
          const sy = view.bottom - 8
          setPhoto({ k: Date.now() + at, x: sx, y: sy, dx: to[0] - sx, dy: to[1] - sy, fish })
        }
      })
      after(at + 1150, () => {
        scene.claim(id)
        setClaimed(true)
      })
    }
    scene.set(id, 'free')
    run('free', 1300, FISH[0])
    // the same sector, now held by a player, and taken from them
    after(1300 + 3900, () => {
      scene.set(id, HOLDER)
      setClaimed(false)
    })
    run('steal', 1300 + 3900 + 800, FISH[1])
    // then back to the headline
    after(1300 + 3900 + 800 + 1150 + 4800, () => setAct('idle'))
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [scene])

  const chip = claimed ? tn('onb.yoursSector') : act === 'steal' ? tn('onb.heldBy', { name: HOLDER.holder }) : tn('onb.freeSector')
  const caption =
    act === 'free'
      ? { title: tn('onb.capFreeTitle'), sub: tn('onb.catchFreeSub') }
      : act === 'steal'
        ? { title: tn('onb.capStealTitle'), sub: tn('onb.catchStealSub') }
        : { title: tn('onb.caughtClaimed'), sub: tn('onb.catchSub') }

  return (
    <div className="intro-screen intro-screen--night" ref={rootRef}>
      <IntroMap
        options={OPTIONS}
        topRef={chipRef}
        bottomRef={copyRef}
        onScene={setScene}
        onView={(v) => {
          viewRef.current = v
        }}
      />
      <BackButton onClick={onBack} variant="intro" stroke="#fff" />
      <div className="inn-top" ref={chipRef}>
        <div key={`${act}${claimed}`} className={`inn-chip inn-chip--state${claimed ? ' mine' : ''}`}>
          <span className="inn-chip-hex" aria-hidden />
          {chip}
        </div>
      </div>
      <div className="intro-illustration" />
      {photo && (
        <div
          key={photo.k}
          className="ic-photo"
          style={{ left: photo.x - 34, top: photo.y - 34, ['--dx' as string]: `${photo.dx}px`, ['--dy' as string]: `${photo.dy}px` }}
        >
          <div className="ic-photo-inner" style={{ background: `linear-gradient(160deg, ${photo.fish}, #FC5200 90%)` }}>
            <svg width="38" height="24" viewBox="0 0 48 30" fill="#fff">
              <path d="M2 15c6-11 26-14 34-6 2 2 4 2 6-1-1 6-1 9 0 14-2-3-4-3-6-1-8 8-28 5-34-6z" />
              <circle cx="13" cy="13" r="2" fill="#C7430B" />
            </svg>
          </div>
        </div>
      )}
      {flashKey > 0 && <div key={flashKey} className="ic-flash" aria-hidden />}
      <div className="intro-copy" ref={copyRef}>
        <div key={act} className="inn-cap" aria-live="polite">
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
