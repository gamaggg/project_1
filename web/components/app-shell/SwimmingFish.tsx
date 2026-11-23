'use client'

import { useEffect, useRef } from 'react'

// A fish drawing that swims in place: the still picture is drawn on a canvas in thin vertical strips, and each
// strip is moved up or down along a wave that runs from the head to the tail — almost nothing at the head, the
// most at the tail — while the whole fish slowly bobs. One picture, no new art. Our drawings face left (head at
// x = 0), so the wave grows to the right. Fits like `object-fit: contain` inside the box `className` gives.
// The loop runs only while the fish is on screen and the page is visible; with «reduce motion» it stays still.

const STRIPS = 48
// Tail swing, as a share of the drawn fish's height, and the slow bob of the whole body.
const SWING = 0.045
const BOB = 0.012
// Wave speed (radians per second) and how many half-waves fit along the body.
const SPEED = 3.2
const WAVES = 1.4

export function SwimmingFish({ src, className }: { src: string; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const img = new Image()
    img.decoding = 'async'
    let loaded = false
    let visible = true
    let raf = 0
    let w = 0
    let h = 0
    const start = performance.now()
    // Each fish starts at its own point of the wave, so two on one screen don't move in step.
    const seed = Math.random() * Math.PI * 2

    const draw = (now: number) => {
      raf = 0
      if (!loaded || w === 0 || h === 0) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const scale = Math.min(w / iw, h / ih)
      const dw = iw * scale
      const dh = ih * scale
      const ox = (w - dw) / 2
      const oy = (h - dh) / 2
      const t = still ? 0 : (now - start) / 1000
      const phase = t * SPEED + seed
      const bob = still ? 0 : Math.sin(t * 1.1 + seed) * BOB * dh
      const sw = iw / STRIPS
      const dsw = dw / STRIPS
      for (let i = 0; i < STRIPS; i++) {
        // 0 at the nose, 1 at the tail.
        const x = (i + 0.5) / STRIPS
        const dy = still ? 0 : Math.sin(x * Math.PI * WAVES - phase) * SWING * dh * (0.12 + 0.88 * x * x)
        // +0.6 px overlap hides the seams between strips.
        ctx.drawImage(img, i * sw, 0, sw, ih, ox + i * dsw, oy + dy + bob, dsw + 0.6, dh)
      }
      if (!still && visible && document.visibilityState === 'visible') raf = requestAnimationFrame(draw)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = r.width
      h = r.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      kick()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) kick()
    })
    io.observe(canvas)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') kick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    img.onload = () => {
      loaded = true
      kick()
    }
    img.src = src

    return () => {
      img.onload = null
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [src])

  return <canvas ref={ref} className={className} aria-hidden />
}
