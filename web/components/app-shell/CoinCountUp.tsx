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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setValue(to)
      return
    }
    setValue(from)
    startRef.current = null
    let raf = requestAnimationFrame(tick)
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const t = Math.min(1, (ts - startRef.current) / durationMs)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      displayRef.current = to
      setDisplay(to)
      return
    }
    let start: number | null = null
    let raf = requestAnimationFrame(tick)
    function tick(ts: number) {
      if (start === null) start = ts
      const t = Math.min(1, (ts - start) / durationMs)
      const eased = 1 - (1 - t) ** 3
      const next = Math.round(from + (to - from) * eased)
      displayRef.current = next
      setDisplay(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs])

  return <>{display}</>
}
