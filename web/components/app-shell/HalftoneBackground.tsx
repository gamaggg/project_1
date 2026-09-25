'use client'

import { useEffect, useRef } from 'react'
import { observeScreenActive } from '@/lib/observeScreenActive'

// A dot grid whose radius follows a slow-orbiting focal point — the classic
// newsprint halftone look, animated by moving the "light source" instead of
// the dots themselves. Same sizing/lifecycle shape as WavyBackground.tsx —
// see that file's comments for why each piece (margin/ResizeObserver/
// prefers-reduced-motion) exists.
export function HalftoneBackground({ color = '#FC5200' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const margin = 20
  const spacing = 13

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !container || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let t = 0
    let frameId = 0

    function resize() {
      w = canvas!.clientWidth
      h = canvas!.clientHeight
      if (w === 0 || h === 0) return false
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.scale(dpr, dpr)
      return true
    }

    function drawFrame() {
      ctx!.clearRect(0, 0, w, h)
      const fx = w * 0.5 + Math.cos(t * 0.22) * w * 0.32
      const fy = h * 0.5 + Math.sin(t * 0.3) * h * 0.32
      const maxDist = Math.max(w, h) * 0.55
      ctx!.fillStyle = color
      for (let y = spacing / 2; y < h; y += spacing) {
        for (let x = spacing / 2; x < w; x += spacing) {
          const d = Math.hypot(x - fx, y - fy)
          const falloff = Math.max(0, 1 - d / maxDist)
          const radius = 1 + falloff * falloff * (spacing * 0.42)
          if (radius < 0.6) continue
          ctx!.globalAlpha = 0.3 + falloff * 0.6
          ctx!.beginPath()
          ctx!.arc(x, y, radius, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }

    function render() {
      if (!running) return
      t += 0.012
      drawFrame()
      frameId = requestAnimationFrame(render)
    }

    // Only while sized AND on the visible screen — see observeScreenActive;
    // this loop used to keep drawing forever on hidden profile/shop screens.
    let sized = false
    let screenActive = false
    let running = false
    function start() {
      if (running || !sized || !screenActive || reduceMotion) return
      running = true
      render()
    }
    function stop() {
      running = false
      cancelAnimationFrame(frameId)
    }

    const ro = new ResizeObserver(() => {
      if (!resize()) return
      sized = true
      drawFrame()
      start()
    })
    ro.observe(container)
    const stopWatching = observeScreenActive(canvas, (active) => {
      screenActive = active
      if (active) start()
      else stop()
    })

    return () => {
      stop()
      ro.disconnect()
      stopWatching()
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
