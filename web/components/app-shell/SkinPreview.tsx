'use client'

import { useEffect, useRef } from 'react'
import { buildSkinPattern, useSkinAssetsVersion } from '@/lib/map/skinPattern'
import { ANIMATED_SKINS, type AnimatedSkinDraw } from '@/lib/map/animatedSkins'
import { observeScreenActive } from '@/lib/observeScreenActive'

// Shop card swatch for a territory_skin — draws the exact same tile pattern
// the map itself uses (see skinPattern.ts), tinted with the viewer's own
// current territory color, and clips it to a hexagon (.hex-aspect .hex-shape,
// the same utility the map's own legend dots use) so what's shown here is
// exactly what the sector looks like once equipped, not a rectangular
// approximation of it.
function hexPath(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.moveTo(width * 0.25, 0)
  ctx.lineTo(width * 0.75, 0)
  ctx.lineTo(width, height * 0.5)
  ctx.lineTo(width * 0.75, height)
  ctx.lineTo(width * 0.25, height)
  ctx.lineTo(0, height * 0.5)
  ctx.closePath()
}

export function SkinPreview({ skinId, color, width = 120 }: { skinId: string; color: string; width?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skinAssetsVersion = useSkinAssetsVersion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const height = Math.round(width / 1.1547)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const animated = ANIMATED_SKINS[skinId] as AnimatedSkinDraw | undefined
    const pattern = animated ? null : buildSkinPattern(skinId, color, height, width)
    function paint(t: number) {
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      if (animated) {
        // The same look as on the map: the sector's tint, the moving lines over it.
        ctx.globalAlpha = 0.3
        ctx.fillStyle = color
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
        ctx.save()
        ctx.beginPath()
        hexPath(ctx, width, height)
        ctx.clip()
        animated(ctx, width, height, t, color)
        ctx.restore()
      } else if (pattern) {
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, width, height)
      }
      // A real sector on the map always has its own territory-color border
      // (see LeafletMap.tsx's polygon `color`/`weight`) — stroke the same hex
      // outline here, in the same tint, so the card reads as "this is a
      // sector" rather than a flat swatch.
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      hexPath(ctx, width, height)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    paint(4)
    if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t = 4
    let last = 0
    let frameId = 0
    let running = false
    function frame(now: number) {
      if (!running) return
      if (last) t += Math.min((now - last) / 1000, 0.1)
      last = now
      paint(t)
      frameId = requestAnimationFrame(frame)
    }
    const stopWatching = observeScreenActive(canvas, (active) => {
      if (active && !running) {
        running = true
        last = 0
        frameId = requestAnimationFrame(frame)
      } else if (!active) {
        running = false
        cancelAnimationFrame(frameId)
      }
    })
    return () => {
      running = false
      cancelAnimationFrame(frameId)
      stopWatching()
    }
  }, [skinId, color, width, skinAssetsVersion])

  return <canvas ref={canvasRef} className="hex-aspect hex-shape shop-card-skin-preview" style={{ width }} />
}
