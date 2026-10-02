'use client'

import { useEffect, useRef } from 'react'
import { observeScreenActive } from '@/lib/observeScreenActive'

type Bubble = { x: number; y: number; r: number; speed: number; phase: number; amp: number }

// Bubbles rising through dark water: thin rings with a highlight, each
// drifting side to side on its own phase and fading out near the top. Same
// sizing/lifecycle shape as CirclesBackground.tsx (oversized by `margin` and
// clipped by the parent, ResizeObserver-driven first paint, stops on an
// inactive screen, prefers-reduced-motion freezes on a single frame).
export function BubblesBackground({ color = '#7FD8F0' }: { color?: string }) {
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
    let t = 0
    let frameId = 0
    let bubbles: Bubble[] = []

    function spawn(anywhere: boolean): Bubble {
      // Mostly small bubbles, a few big ones; bigger ones rise faster.
      const r = 2 + Math.random() ** 2 * 8
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + r + Math.random() * 40,
        r,
        speed: 0.25 + r * 0.06 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        amp: 2 + Math.random() * 6,
      }
    }

    function resize() {
      w = canvas!.clientWidth
      h = canvas!.clientHeight
      if (w === 0 || h === 0) return false
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(30, Math.max(14, (w * h) / 7000)))
      bubbles = Array.from({ length: count }, () => spawn(true))
      return true
    }

    function drawFrame() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.strokeStyle = color
      ctx!.fillStyle = color
      for (const b of bubbles) {
        const x = b.x + Math.sin(t * 1.3 + b.phase) * b.amp
        const fade = Math.min(1, b.y / (h * 0.35))
        ctx!.globalAlpha = 0.8 * fade
        ctx!.lineWidth = Math.max(1, b.r * 0.18)
        ctx!.beginPath()
        ctx!.arc(x, b.y, b.r, 0, Math.PI * 2)
        ctx!.stroke()
        ctx!.globalAlpha = 0.65 * fade
        ctx!.beginPath()
        ctx!.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    function step() {
      t += 0.016
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i]
        b.y -= b.speed
        if (b.y < -b.r * 2) bubbles[i] = spawn(false)
      }
    }

    function render() {
      if (!running) return
      step()
      drawFrame()
      frameId = requestAnimationFrame(render)
    }

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
