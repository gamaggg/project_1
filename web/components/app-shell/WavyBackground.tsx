'use client'

import { useEffect, useRef } from 'react'
import { createNoise3D } from 'simplex-noise'

// Close port of ui.aceternity.com/components/wavy-background — same
// algorithm (5 layered noise waves) and the same prop shape (waveWidth/
// blur/speed/waveOpacity/backgroundFill), just:
// - blur is a CSS filter on the canvas element, not ctx.filter inside it —
//   several WebKit-family WebViews (Safari, Telegram's in-app browser)
//   silently ignore ctx.filter and draw hard-edged, unblurred waves instead
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

    // Returns whether the container had a real (non-zero) size to measure.
    // Telegram's in-app browser can run this effect before the hero panel
    // has actually been laid out — clientWidth/clientHeight read 0 (or some
    // transient wrong value) at that instant, and a canvas sized off that
    // then gets stretched by the width:100%/height:100% CSS below into the
    // blocky, torn-looking mess this was reported as. Regular browser tabs
    // don't hit this because layout has already settled by the time this
    // effect runs.
    function resize() {
      w = container!.clientWidth
      h = container!.clientHeight
      if (w === 0 || h === 0) return false
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.scale(dpr, dpr)
      return true
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

    // Don't draw off a synchronous resize() at all — wait for
    // ResizeObserver's own first callback (which fires with the container's
    // real post-layout size, async, typically within a frame or two) to
    // both size the canvas and kick off the first paint. See resize()'s
    // comment for why measuring synchronously here isn't safe everywhere.
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
  }, [colors, waveWidth, backgroundFill, blur, speed, waveOpacity])

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
        // Always blurred via a CSS filter on the element itself, not
        // ctx.filter inside the canvas — WebKit-family WebViews (Safari,
        // and apparently Telegram's own in-app browser too, which isn't
        // reliably UA-sniffable as "Safari") draw the canvas fine but just
        // silently ignore ctx.filter, leaving hard-edged, unblurred waves.
        filter: `blur(${blur}px)`,
      }}
    />
  )
}
