'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { createIntroScene, type IntroOptions, type IntroScene, type IntroView } from '@/lib/welcome/introScene'
import { loadCoast } from '@/components/app-shell/onboarding/WelcomeMap'

// The canvas behind an intro screen (lib/welcome/introScene.ts): the welcome
// screen's night coast, playable. It fills the screen; the band where the map
// may show runs from the bottom of `topRef` to the top of `bottomRef`. The
// screen gets the scene (to claim sectors, ask what is where) and is told which
// sector was tapped.
export function IntroMap({
  options,
  topRef,
  bottomRef,
  onScene,
  onView,
  onPick,
}: {
  options: IntroOptions
  topRef: RefObject<HTMLElement | null>
  bottomRef: RefObject<HTMLElement | null>
  onScene: (scene: IntroScene) => void
  onView?: (view: IntroView) => void
  onPick?: (id: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<IntroScene | null>(null)
  const cb = useRef({ onScene, onView, onPick })
  useEffect(() => {
    cb.current = { onScene, onView, onPick }
  }, [onScene, onView, onPick])

  useEffect(() => {
    const canvas = canvasRef.current
    const box = canvas?.parentElement
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let cancelled = false
    const view: IntroView = { w: 0, h: 0, top: 0, bottom: 0 }
    const t0 = performance.now()

    const loop = (now: number) => {
      sceneRef.current?.draw(ctx, Math.max(0, now - t0) / 1000, view)
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      if (sceneRef.current && !document.hidden) raf = requestAnimationFrame(loop)
    }
    const fit = () => {
      const r = box.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      view.w = r.width
      view.h = r.height
      view.top = (topRef.current?.getBoundingClientRect().bottom ?? r.top + r.height * 0.15) - r.top
      view.bottom = (bottomRef.current?.getBoundingClientRect().top ?? r.top + r.height * 0.7) - r.top
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cb.current.onView?.({ ...view })
    }
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    if (topRef.current) ro.observe(topRef.current)
    if (bottomRef.current) ro.observe(bottomRef.current)
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start())
    document.addEventListener('visibilitychange', onVisibility)

    loadCoast()
      .then((data) => {
        if (cancelled) return
        const label = getComputedStyle(canvas).getPropertyValue('--font-manrope').trim() || 'Manrope, sans-serif'
        sceneRef.current = createIntroScene(data, label, options)
        fit()
        cb.current.onScene(sceneRef.current)
        start()
      })
      .catch(() => {})

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [options, topRef, bottomRef])

  return (
    <canvas
      ref={canvasRef}
      className="intro-map"
      aria-hidden="true"
      onPointerDown={(e) => {
        const scene = sceneRef.current
        if (!scene) return
        const r = e.currentTarget.getBoundingClientRect()
        const id = scene.pick(e.clientX - r.left, e.clientY - r.top)
        if (id) cb.current.onPick?.(id)
      }}
    />
  )
}
