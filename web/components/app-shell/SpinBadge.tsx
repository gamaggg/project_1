'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { HexBadge } from '@/components/app-shell/HexBadge'

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// A hex badge you can grab and spin — CSS 3D transforms (perspective +
// rotateX/rotateY) driven directly by pointer drag. Releasing snaps it
// straight back to "face on", no coast/delay — the badge is a toy to peek
// at from an angle, not a spinner that should keep drifting once you let
// go. Deliberately only used on AchievementDetailScreen's single big badge,
// not the achievements grid — a handful of simultaneously-interactive 3D
// tiles would be noise (and a scroll-perf problem), not delight; see the
// plan's own scoping note.
export function SpinBadge({ unlocked, icon, strokeWidth }: { unlocked: boolean; icon: ReactNode; strokeWidth?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [rot, setRot] = useState({ x: 0, y: 0 })
  const dragRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, dragging: false })
  const rafRef = useRef<number | null>(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  function stopAnim() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  function snapBack() {
    stopAnim()
    if (reducedMotionRef.current) {
      dragRef.current.x = 0
      dragRef.current.y = 0
      setRot({ x: 0, y: 0 })
      return
    }
    const start = { x: dragRef.current.x, y: dragRef.current.y }
    const startTime = performance.now()
    function step(now: number) {
      const t = Math.min(1, (now - startTime) / 420)
      const eased = 1 - (1 - t) ** 3
      const x = start.x * (1 - eased)
      const y = start.y * (1 - eased)
      dragRef.current.x = x
      dragRef.current.y = y
      setRot({ x, y })
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function onPointerDown(e: ReactPointerEvent) {
    stopAnim()
    // Can throw (invalid/inactive pointer id) on some inputs — pointer capture
    // is just an optimization here (keeps the drag tracking if the finger
    // slides off the badge), so a failure shouldn't abort the drag itself.
    try {
      wrapRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // ignore — see comment above
    }
    dragRef.current.dragging = true
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.lastX
    const dy = e.clientY - dragRef.current.lastY
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY
    dragRef.current.x = clamp(dragRef.current.x + dy * 0.6, -55, 55)
    dragRef.current.y = clamp(dragRef.current.y - dx * 0.6, -70, 70)
    setRot({ x: dragRef.current.x, y: dragRef.current.y })
  }

  function onPointerUp() {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    snapBack()
  }

  useEffect(() => stopAnim, [])

  return (
    <div
      ref={wrapRef}
      className="spin-badge"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="spin-badge-inner" style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}>
        <HexBadge unlocked={unlocked} icon={icon} strokeWidth={strokeWidth} />
      </div>
    </div>
  )
}
