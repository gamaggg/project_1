'use client'

import { useEffect, useRef, useState } from 'react'
import { hapticSelect } from '@/lib/telegram/haptics'

// Pull-to-refresh for a screen's feed: pulled down from the very top, the
// feed slides down and a fishing hook comes down on its line, swinging as it
// goes; past TRIGGER it straightens and lights up (a tick of haptics), and
// letting go keeps it swaying until the refresh is done. Fingers through touch events — a pointer stream would be
// cancelled the moment the browser decides the gesture is a scroll — and a
// mouse through pointer events, so it can be tried in a desktop browser too.
// `ref` goes on the screen's inner block; the scroller is its `.screen`.
const TRIGGER = 64
const MAX = 110
// Shown at least this long, so a fast answer doesn't just blink.
const MIN_BUSY_MS = 700

export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef(onRefresh)
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    latest.current = onRefresh
  })

  useEffect(() => {
    const inner = ref.current
    const scroller = inner?.closest<HTMLElement>('.screen')
    if (!inner || !scroller) return
    let startY: number | null = null
    let dist = 0
    let armed = false
    let busy = false
    let pulled = false

    const begin = (y: number) => {
      if (busy || scroller.scrollTop > 0) return
      startY = y
      dist = 0
      armed = false
      pulled = false
    }
    const move = (y: number, e: Event) => {
      if (startY === null) return
      const dy = y - startY
      if (dy <= 0 || scroller.scrollTop > 0) {
        if (dist) {
          dist = 0
          setPull(0)
        }
        return
      }
      // Heavier the further it goes, like line paying out against a drag.
      dist = Math.min(MAX, dy * 0.5)
      if (e.cancelable) e.preventDefault()
      if (!pulled) setDragging(true)
      pulled = true
      setPull(dist)
      if (!armed && dist >= TRIGGER) {
        armed = true
        hapticSelect()
      } else if (armed && dist < TRIGGER) armed = false
    }
    const end = async () => {
      if (startY === null) return
      startY = null
      setDragging(false)
      if (dist >= TRIGGER) {
        busy = true
        setRefreshing(true)
        setPull(TRIGGER)
        const started = Date.now()
        try {
          await latest.current()
        } catch {
          // the feed keeps what it had; the next pull tries again
        }
        const wait = MIN_BUSY_MS - (Date.now() - started)
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        busy = false
        setRefreshing(false)
      }
      dist = 0
      setPull(0)
    }

    const onTouchStart = (e: TouchEvent) => begin(e.touches[0].clientY)
    const onTouchMove = (e: TouchEvent) => move(e.touches[0].clientY, e)
    const onTouchEnd = () => void end()
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 0) begin(e.clientY)
    }
    const onPointerMove = (e: PointerEvent) => {
      // Only a held button pulls: a hovering mouse isn't a drag.
      if (e.pointerType === 'mouse' && e.buttons & 1) move(e.clientY, e)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') void end()
    }
    // A mouse pull that let go over a row isn't a tap on that row.
    const onClick = (e: MouseEvent) => {
      if (pulled) {
        pulled = false
        e.stopPropagation()
        e.preventDefault()
      }
    }
    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchmove', onTouchMove, { passive: false })
    scroller.addEventListener('touchend', onTouchEnd)
    scroller.addEventListener('touchcancel', onTouchEnd)
    scroller.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    scroller.addEventListener('click', onClick, true)
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchmove', onTouchMove)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
      scroller.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      scroller.removeEventListener('click', onClick, true)
    }
  }, [])

  return { ref, pull, dragging, refreshing }
}

// While pulled, the screen's inner block slides down by the pull (a
// transform, so nothing re-lays out each frame) and eases back on release.
// Spread on the same element that takes `ref`.
const SETTLE = 'transform .3s cubic-bezier(.22,1,.36,1)'
export function pullShift(pull: number, dragging: boolean): React.CSSProperties {
  return {
    position: 'relative',
    transform: pull ? `translateY(${pull}px)` : undefined,
    transition: dragging ? 'none' : SETTLE,
  }
}

// The hook on its line, in the space the slid-down feed leaves above it —
// one drawing, so the line always runs straight into the hook's eye, and it
// swings from the top of the line like a pendulum: tilted while short of
// the trigger, hanging straight and lit orange once letting go would
// refresh, swaying while the feed reloads.
export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  const ready = pull >= TRIGGER
  const tilt = refreshing || ready ? 0 : 14 - (pull / TRIGGER) * 14
  return (
    <div className={`ptr${refreshing ? ' busy' : ''}${ready ? ' ready' : ''}`} style={{ opacity: pull ? 1 : 0 }} aria-hidden>
      <svg className="ptr-hook" width="24" height="110" viewBox="0 0 24 110" fill="none" strokeLinecap="round" strokeLinejoin="round" style={refreshing ? undefined : { transform: `rotate(${tilt}deg)` }}>
        <path className="ptr-line" d="M12 0V79.6" strokeWidth="1" />
        <g className="ptr-hook-body">
          <circle cx="12" cy="82" r="2.4" strokeWidth="2" />
          <path d="M12 84.4V98.5a5 5 0 0 1-10 0V95" strokeWidth="2.2" />
          <path d="M2 95l2.8 2.6" strokeWidth="2.2" />
        </g>
      </svg>
    </div>
  )
}
