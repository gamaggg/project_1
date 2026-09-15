'use client'

import { useEffect, useRef, useState } from 'react'
import { createNoise3D } from 'simplex-noise'

// Close port of ui.aceternity.com/components/wavy-background — same
// algorithm (5 layered noise waves, blur, Safari's ctx.filter-doesn't-blur-
// canvas workaround) and the same prop shape (waveWidth/blur/speed/
// waveOpacity/backgroundFill), just:
// - sized to the parent container instead of the viewport, since this is
//   mounted inside a fixed-height hero panel, not used as a full page hero
// - the noise amplitude scales with container height rather than the
//   original's flat 100px (that number was tuned for a ~900px-tall
//   viewport section; kept absolute, it would blow past our much shorter
//   hero panel)
// - `colors`/`backgroundFill` default to the brand's own orange ramp
//   instead of the demo's sky/indigo/purple palette
const DEFAULT_COLORS = ['#FC5200', '#FF7A38', '#FF9A52', '#C7430B']

export function WavyBackground({
  colors = DEFAULT_COLORS,
  waveWidth = 50,
  backgroundFill = '#1B0F04',
  blur = 10,
  speed = 'fast',
  waveOpacity = 0.5,
}: {
  colors?: string[]
  waveWidth?: number
  backgroundFill?: string
  blur?: number
  speed?: 'slow' | 'fast'
  waveOpacity?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSafari, setIsSafari] = useState(false)

  useEffect(() => {
    setIsSafari(typeof window !== 'undefined' && navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !container || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const noise3D = createNoise3D()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const getSpeed = () => (speed === 'slow' ? 0.001 : 0.002)
    let w = 0
    let h = 0
    let nt = 0
    let frameId = 0

    function resize() {
      w = container!.clientWidth
      h = container!.clientHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.scale(dpr, dpr)
      if (!isSafari) ctx!.filter = `blur(${blur}px)`
    }

    function drawWave(n: number) {
      nt += getSpeed()
      // Drawn (and sampled for noise) past both edges by the blur radius —
      // ctx.filter's blur only has the canvas's own bitmap to sample from,
      // so a line stopping exactly at x=0/x=w gets blurred against nothing
      // but backgroundFill just past it, reading as a dark frame around the
      // waves instead of them reaching the true edge.
      const margin = blur * 3
      for (let i = 0; i < n; i++) {
        ctx!.beginPath()
        ctx!.lineWidth = waveWidth
        ctx!.strokeStyle = colors[i % colors.length]
        for (let x = -margin; x <= w + margin; x += 5) {
          const y = noise3D(x / 800, 0.3 * i, nt) * (h * 0.18) + h * 0.5
          ctx!.lineTo(x, y)
        }
        ctx!.stroke()
        ctx!.closePath()
      }
    }

    function drawFrame() {
      ctx!.fillStyle = backgroundFill
      ctx!.globalAlpha = 1
      ctx!.fillRect(0, 0, w, h)
      ctx!.globalAlpha = waveOpacity
      drawWave(5)
    }

    function render() {
      drawFrame()
      frameId = requestAnimationFrame(render)
    }

    resize()
    if (reduceMotion) {
      drawFrame()
    } else {
      render()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
    }
  }, [colors, waveWidth, backgroundFill, blur, speed, waveOpacity, isSafari])

  // z-index:-1 relies on the parent establishing its own stacking context
  // (isolation:isolate or a real z-index, not just position:relative) —
  // otherwise it escapes past the parent's own background into whatever
  // ancestor does form one. See .herobg-preview/.herobg-swatch/.profile-hero.
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        zIndex: -1,
        // Safari doesn't apply ctx.filter blur to canvas drawing reliably —
        // fall back to a CSS filter on the element itself there instead.
        ...(isSafari ? { filter: `blur(${blur}px)` } : {}),
      }}
    />
  )
}
