'use client'

import { useEffect, useRef } from 'react'
import { observeScreenActive } from '@/lib/observeScreenActive'

type Firefly = { x: number; y: number; vx: number; vy: number; phase: number; pulse: number; size: number }

function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

// Fireflies over night water: soft glowing points drifting on slow curves,
// each pulsing on its own rhythm. The glow is one pre-rendered sprite drawn
// with drawImage — never shadowBlur — so two dozen of them cost next to
// nothing per frame. Lifecycle as CirclesBackground.tsx: oversized by
// `margin`, ResizeObserver first paint, stops on an inactive screen, a single
// still frame under prefers-reduced-motion.
export function FirefliesBackground({ color = '#D9F26B' }: { color?: string }) {
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
    let flies: Firefly[] = []

    const rgb = hexToRgb(color)
    const sprite = document.createElement('canvas')
    const SPRITE = 64
    sprite.width = SPRITE
    sprite.height = SPRITE
    const sctx = sprite.getContext('2d')!
    const glow = sctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2)
    glow.addColorStop(0, `rgba(${rgb},1)`)
    glow.addColorStop(0.18, `rgba(${rgb},.75)`)
    glow.addColorStop(0.45, `rgba(${rgb},.18)`)
    glow.addColorStop(1, `rgba(${rgb},0)`)
    sctx.fillStyle = glow
    sctx.fillRect(0, 0, SPRITE, SPRITE)

    function spawn(): Firefly {
      return {
        x: Math.random() * w,
        // Weighted toward the lower part of the panel, like over the water.
        y: h * (0.25 + Math.random() ** 0.7 * 0.75),
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.2,
        phase: Math.random() * Math.PI * 2,
        pulse: 0.6 + Math.random() * 1.1,
        size: 20 + Math.random() * 20,
      }
    }

    function resize() {
      w = canvas!.clientWidth
      h = canvas!.clientHeight
      if (w === 0 || h === 0) return false
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(26, Math.max(14, (w * h) / 8000)))
      flies = Array.from({ length: count }, spawn)
      return true
    }

    function drawFrame() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'
      for (const f of flies) {
        const beat = 0.5 + 0.5 * Math.sin(t * f.pulse + f.phase)
        ctx!.globalAlpha = 0.15 + 0.85 * beat * beat
        const s = f.size * (0.8 + 0.3 * beat)
        ctx!.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s)
      }
      ctx!.globalAlpha = 1
      ctx!.globalCompositeOperation = 'source-over'
    }

    function step() {
      t += 0.016
      for (const f of flies) {
        f.x += f.vx + Math.sin(t * 0.7 + f.phase) * 0.18
        f.y += f.vy + Math.cos(t * 0.5 + f.phase) * 0.12
        if (f.x < -20) f.x = w + 20
        else if (f.x > w + 20) f.x = -20
        if (f.y < h * 0.15) f.vy = Math.abs(f.vy)
        else if (f.y > h + 10) f.vy = -Math.abs(f.vy)
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
