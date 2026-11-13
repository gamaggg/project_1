'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tn } from '@/lib/i18n'

const MAX_SCALE = 6
const DOUBLE_TAP_SCALE = 2.5

type View = { s: number; x: number; y: number }

// A full-screen photo you can zoom: pinch with two fingers, double-tap (or a
// mouse wheel) to zoom in and out, drag to move around once zoomed. The
// image is drawn «contain» on black, so the whole frame is visible at 1×.
// At 1× a one-finger swipe in any direction (sideways or down) throws the photo
// off the screen and closes the viewer, so the × at the top need not be reached;
// a short drag springs back.
// Rendered into <body> (a screen is its own stacking context and would keep
// the nav above it); its touch and click events are stopped before they
// bubble through the React tree into the card's swipe-to-next-catch handler.
export function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  // Where a two-finger gesture started: the finger distance, the scale then,
  // and the image point (relative to the stage centre, unscaled) under the
  // fingers' midpoint — kept under it as the fingers move.
  const pinch = useRef<{ dist: number; s: number; qx: number; qy: number } | null>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)
  const moved = useRef(false)
  const [hint, setHint] = useState(true)
  // The swipe-to-close at 1×: where the photo is pulled to, and whether it is flying off (or springing back).
  const [pull, setPull] = useState<{ x: number; y: number; anim: 'none' | 'back' | 'out' }>({ x: 0, y: 0, anim: 'none' })
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)

  const apply = useCallback((next: View) => {
    const stage = stageRef.current
    const img = imgRef.current
    let { s, x, y } = next
    s = Math.max(1, Math.min(MAX_SCALE, s))
    if (stage && img) {
      const maxX = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2)
      const maxY = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2)
      x = Math.max(-maxX, Math.min(maxX, x))
      y = Math.max(-maxY, Math.min(maxY, y))
    }
    if (s === 1) {
      x = 0
      y = 0
    }
    const v = { s, x, y }
    viewRef.current = v
    setView(v)
  }, [])

  // Stage centre in client coordinates — gestures are measured from it.
  function centre() {
    const r = stageRef.current!.getBoundingClientRect()
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    setHint(false)
    const v = viewRef.current
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const { cx, cy } = centre()
      const mx = (a.x + b.x) / 2 - cx
      const my = (a.y + b.y) / 2 - cy
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: v.s, qx: (mx - v.x) / v.s, qy: (my - v.y) / v.s }
      drag.current = null
    } else if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }
      swipe.current = v.s <= 1.01 ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null
    }
    if (pointers.current.size > 1 && swipe.current) {
      swipe.current = null
      setPull({ x: 0, y: 0, anim: 'back' })
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const { cx, cy } = centre()
      const s = Math.max(1, Math.min(MAX_SCALE, (pinch.current.s * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / pinch.current.dist))
      const mx = (a.x + b.x) / 2 - cx
      const my = (a.y + b.y) / 2 - cy
      moved.current = true
      apply({ s, x: mx - s * pinch.current.qx, y: my - s * pinch.current.qy })
    } else if (drag.current) {
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true
      if (viewRef.current.s > 1) apply({ ...viewRef.current, x: drag.current.vx + dx, y: drag.current.vy + dy })
      else if (swipe.current) setPull({ x: e.clientX - swipe.current.x, y: e.clientY - swipe.current.y, anim: 'none' })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasPinch = pointers.current.size >= 2
    pointers.current.delete(e.pointerId)
    if (wasPinch) {
      pinch.current = null
      // The finger left behind carries on as a drag from where it is now.
      const rest = [...pointers.current.values()][0]
      drag.current = rest ? { x: rest.x, y: rest.y, vx: viewRef.current.x, vy: viewRef.current.y } : null
      return
    }
    drag.current = null
    const sw = swipe.current
    swipe.current = null
    if (sw && moved.current) {
      const dx = e.clientX - sw.x
      const dy = e.clientY - sw.y
      const dist = Math.hypot(dx, dy)
      const speed = dist / Math.max(1, e.timeStamp - sw.t)
      if (dist > 90 || (dist > 30 && speed > 0.5)) {
        // Off the screen the way it was thrown, then closed.
        const k = (Math.max(window.innerWidth, window.innerHeight) * 1.2) / Math.max(1, dist)
        setPull({ x: dx * k, y: dy * k, anim: 'out' })
        window.setTimeout(onClose, 200)
      } else setPull({ x: 0, y: 0, anim: 'back' })
      return
    }
    if (moved.current) return
    // A tap: two in a row zoom in on the spot (or back out).
    const now = Date.now()
    const prev = lastTap.current
    if (prev && now - prev.t < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 28) {
      lastTap.current = null
      zoomAt(e.clientX, e.clientY, viewRef.current.s > 1.05 ? 1 : DOUBLE_TAP_SCALE)
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY }
    }
  }

  function zoomAt(clientX: number, clientY: number, s: number) {
    const v = viewRef.current
    const { cx, cy } = centre()
    const mx = clientX - cx
    const my = clientY - cy
    const qx = (mx - v.x) / v.s
    const qy = (my - v.y) / v.s
    apply({ s, x: mx - s * qx, y: my - s * qy })
  }

  // Wheel and trackpad pinch (a non-passive listener, so the page behind
  // doesn't scroll or zoom).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setHint(false)
      zoomAt(e.clientX, e.clientY, viewRef.current.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const pullDist = Math.hypot(pull.x, pull.y)
  const pullFade = pull.anim === 'out' ? 0 : Math.max(0.25, 1 - pullDist / 420)
  const pullTransition = pull.anim === 'out' ? 'transform .2s cubic-bezier(.4,0,.6,1)' : pull.anim === 'back' ? 'transform .25s cubic-bezier(.2,.8,.25,1)' : 'none'

  return createPortal(
    <div
      className="photo-viewer"
      style={{ background: `rgba(0,0,0,${pullFade})`, transition: pull.anim === 'none' ? 'none' : 'background-color .2s' }}
      onTouchStart={stop}
      onTouchEnd={stop}
      onClick={stop}
      role="dialog"
      aria-label={tn('catch.viewerAria')}
    >
      <div
        ref={stageRef}
        className="photo-viewer-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the full-size catch photo, transformed by hand */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="photo-viewer-img"
          style={{ transform: `translate(${view.x + pull.x}px, ${view.y + pull.y}px) scale(${view.s})`, transition: pullTransition }}
        />
      </div>
      <button type="button" className="photo-viewer-close tap-scale" onClick={onClose} aria-label={tn('common.close')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      {hint && <div className="photo-viewer-hint">{tn('catch.zoomHint')}</div>}
    </div>,
    document.body
  )
}
