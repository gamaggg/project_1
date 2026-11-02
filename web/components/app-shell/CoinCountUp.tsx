'use client'

import { useEffect, useRef, useState } from 'react'
import { CoinIcon, type CoinSize } from '@/components/app-shell/CoinIcon'

// Bouncing coin + a number ticking up to its target — the shared "you just
// earned coins" moment used by purchase confirmation, admin coin grants and
// challenge-completion celebrations. Ticks via rAF rather than a CSS counter
// so the exact per-frame value is readable/testable, and collapses straight
// to the end value under prefers-reduced-motion (no reason to animate a
// number when transforms are already suppressed).
export function CoinCountUp({
  from = 0,
  to,
  size = 28,
  durationMs = 900,
  animated = 'bounce',
}: {
  from?: number
  to: number
  size?: CoinSize
  durationMs?: number
  animated?: 'bounce' | false
}) {
  const [value, setValue] = useState(from)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    // Every update lands on an animation frame: the first frame (t = 0)
    // resets to `from`, reduced motion jumps straight to `to` on it — never
    // a synchronous setState in the effect.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    startRef.current = null
    let raf = requestAnimationFrame(tick)
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const t = reduced ? 1 : Math.min(1, (ts - startRef.current) / durationMs)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
  }, [from, to, durationMs])

  return (
    <span className="coin-count-up">
      <CoinIcon size={size} animated={animated} />
      <b>{value}</b>
    </span>
  )
}

// A balance that ticks between its OLD and NEW value on every change,
// instead of CoinCountUp's one-shot reveal from a fixed `from` — this is
// for a number that sits on screen and mutates in place (the Shop's coin
// total after a purchase) rather than a modal that mounts once with a
// result already known. Tracks the last rendered value in a ref (not just
// the prop) so a second change arriving mid-tween continues smoothly from
// wherever the animation actually is, instead of jumping.
export function LiveCoinBalance({ value, durationMs = 600 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    const to = value
    if (from === to) return
    // Every update lands on an animation frame (reduced motion: straight to
    // the new value on the first one) — never synchronously in the effect.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let start: number | null = null
    let raf = requestAnimationFrame(tick)
    function tick(ts: number) {
      if (start === null) start = ts
      const t = reduced ? 1 : Math.min(1, (ts - start) / durationMs)
      const eased = 1 - (1 - t) ** 3
      const next = Math.round(from + (to - from) * eased)
      displayRef.current = next
      setDisplay(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return <>{display}</>
}

// A plain number that counts up from 0 each time `play` turns true (a tab or
// screen coming into view — screens here stay mounted, so mounting says
// nothing) and ticks between old and new values while it's shown. Without
// `play` (undefined) it counts up once, on mount.
export function CountUp({ value, play, durationMs = 700 }: { value: number; play?: boolean; durationMs?: number }) {
  const [display, setDisplay] = useState(play === false ? value : 0)
  const displayRef = useRef(display)
  const playedRef = useRef(false)

  useEffect(() => {
    if (play === false) {
      // Ready at zero for the next time it comes into view.
      playedRef.current = false
      const raf = requestAnimationFrame(() => {
        displayRef.current = 0
        setDisplay(0)
      })
      return () => cancelAnimationFrame(raf)
    }
    // Coming into view: from zero; already in view: from wherever it is.
    const from = playedRef.current ? displayRef.current : 0
    playedRef.current = true
    const to = value
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let start: number | null = null
    let raf = requestAnimationFrame(tick)
    function tick(ts: number) {
      if (start === null) start = ts
      const t = reduced || from === to ? 1 : Math.min(1, (ts - start) / durationMs)
      const eased = 1 - (1 - t) ** 3
      const next = Math.round(from + (to - from) * eased)
      displayRef.current = next
      setDisplay(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
  }, [value, play, durationMs])

  // Out of view it just shows the value (the count-up replays on the way back in).
  return <>{play === false ? value : display}</>
}
