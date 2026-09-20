'use client'

import { useEffect, useRef } from 'react'

// Concentric arcs sweeping slowly around an off-centre point, each ring at
// its own speed so the motion never reads as one mechanically synced spin —
// a canvas port of a "radar/ripple" background. Same sizing/lifecycle shape
// as WavyBackground.tsx (oversized by `margin` and clipped by the parent,
// ResizeObserver-driven first paint, prefers-reduced-motion freezes on a
// single frame) — see that file's comments for why each of those exists.
export function CirclesBackground({ color = '#7C8CFF' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const margin = 20

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !container || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let t = 0
    let frameId = 0

    function resize() {
      w = canvas!.clientWidth
      h = canvas!.clientHeight
      if (w === 0 || h === 0) return false
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.scale(dpr, dpr)
      // Centered on the avatar itself, not the panel's own box — the hero
      // panel can be wider than (and not concentric with) the avatar, e.g.
      // on a desktop-width viewport where the panel spans the full window
      // but the avatar stays centered in a narrower content column.
      const avatar = container!.querySelector('.profile-hero-avatar-ring')
      const canvasBox = canvas!.getBoundingClientRect()
      if (avatar) {
        const avatarBox = avatar.getBoundingClientRect()
        cx = avatarBox.left + avatarBox.width / 2 - canvasBox.left
        cy = avatarBox.top + avatarBox.height / 2 - canvasBox.top
      } else {
        cx = w * 0.5
        cy = h * 0.55
      }
      return true
    }

    const RINGS = 6
    function drawFrame() {
      ctx!.clearRect(0, 0, w, h)
      const maxR = Math.max(w, h) * 0.6
      ctx!.lineWidth = 1.4
      for (let i = 0; i < RINGS; i++) {
        const r = maxR * ((i + 1) / RINGS)
        const speed = 0.35 + i * 0.07
        const start = t * speed + i * 1.3
        const sweep = 2.0 + Math.sin(t * 0.5 + i) * 0.6
        ctx!.beginPath()
        ctx!.arc(cx, cy, r, start, start + sweep)
        ctx!.strokeStyle = color
        ctx!.globalAlpha = 0.5 - i * 0.06
        ctx!.stroke()
      }
    }

    function render() {
      t += 0.016
      drawFrame()
      frameId = requestAnimationFrame(render)
    }

    let animating = false
    const ro = new ResizeObserver(() => {
      if (!resize()) return
      if (reduceMotion) {
        drawFrame()
      } else if (!animating) {
        animating = true
        render()
      }
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
    }
  }, [color])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: -margin,
        left: -margin,
        width: `calc(100% + ${margin * 2}px)`,
        height: `calc(100% + ${margin * 2}px)`,
        display: 'block',
        zIndex: -1,
      }}
    />
  )
}
