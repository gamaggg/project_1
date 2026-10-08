'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { COAST_STILL_AT, createCoastScene, type CoastData, type TickerLine } from '@/lib/welcome/coastScene'

// The canvas behind the welcome screen (lib/welcome/coastScene.ts). Draws
// between the headline (headRef) and the buttons (footRef), so it adapts to
// any screen; stops when the app is in the background; with reduced motion
// it's one still frame. The map data (~110 KB) is fetched only here.
let dataPromise: Promise<CoastData> | null = null
function loadCoast() {
  dataPromise ??= fetch('/welcome/batumi-coast.json').then((r) => {
    if (!r.ok) throw new Error(`coast ${r.status}`)
    return r.json() as Promise<CoastData>
  })
  dataPromise.catch(() => (dataPromise = null))
  return dataPromise
}

export function WelcomeMap({ headRef, footRef, onTicker }: { headRef: RefObject<HTMLElement | null>; footRef: RefObject<HTMLElement | null>; onTicker: (line: TickerLine) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tickerRef = useRef(onTicker)
  useEffect(() => {
    tickerRef.current = onTicker
  }, [onTicker])

  useEffect(() => {
    const canvas = canvasRef.current
    const box = canvas?.parentElement
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let draw: ReturnType<typeof createCoastScene> | null = null
    let raf = 0
    let cancelled = false
    const view = { w: 0, h: 0, clearTop: 0, clearBottom: 0 }
    const t0 = performance.now()

    const frame = (now: number) => {
      if (!draw) return
      draw(ctx, reduced ? COAST_STILL_AT : (now - t0) / 1000, view, reduced)
    }
    const loop = (now: number) => {
      frame(now)
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      if (!draw || document.hidden) return
      if (reduced) frame(performance.now())
      else raf = requestAnimationFrame(loop)
    }
    const fit = () => {
      const r = box.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      view.w = r.width
      view.h = r.height
      view.clearTop = (headRef.current?.getBoundingClientRect().bottom ?? r.top + r.height * 0.4) - r.top
      view.clearBottom = (footRef.current?.getBoundingClientRect().top ?? r.top + r.height * 0.8) - r.top
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (draw) frame(performance.now())
    }
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    if (headRef.current) ro.observe(headRef.current)
    if (footRef.current) ro.observe(footRef.current)
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start())
    document.addEventListener('visibilitychange', onVisibility)

    loadCoast()
      .then((data) => {
        if (cancelled) return
        // canvas text can't see CSS variables — the label face is next/font's generated family
        const label = getComputedStyle(canvas).getPropertyValue('--font-manrope').trim() || 'Manrope, sans-serif'
        draw = createCoastScene(data, label, (line) => tickerRef.current(line))
        fit()
        start()
      })
      .catch(() => {})

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [headRef, footRef])

  return <canvas ref={canvasRef} className="welcome-map" aria-hidden="true" />
}
