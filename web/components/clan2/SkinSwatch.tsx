'use client'

import { useEffect, useRef } from 'react'
import { ANIMATED_SKINS } from '@/lib/map/animatedSkins'
import { flatHexPath, tint } from '@/lib/map/hexDraw'

// One sector painted with an animated skin — the same drawing code the map uses,
// so what the clan picks here is exactly what its sectors look like.
export function SkinSwatch({ id, color, size = 76, seed = 0.37 }: { id: string | null; color: string; size?: number; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = size
    const h = Math.round(size * 0.866)
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const draw = id ? ANIMATED_SKINS[id] : undefined
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const start = performance.now()
    const frame = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.save()
      flatHexPath(ctx, 1, 1, w - 2, h - 2)
      ctx.clip()
      ctx.fillStyle = tint(color, 0.3)
      ctx.fillRect(0, 0, w, h)
      draw?.(ctx, w, h, calm ? 1.5 : (now - start) / 1000, color, seed)
      ctx.restore()
      flatHexPath(ctx, 1, 1, w - 2, h - 2)
      ctx.strokeStyle = tint(color, 0.9)
      ctx.lineWidth = 2
      ctx.stroke()
      if (!calm) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [id, color, size, seed])

  return <canvas ref={ref} className="c2-swatch" aria-hidden />
}
