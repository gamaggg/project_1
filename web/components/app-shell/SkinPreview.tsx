'use client'

import { useEffect, useRef } from 'react'
import { buildSkinPattern, useSkinAssetsVersion } from '@/lib/map/skinPattern'

// Shop card swatch for a territory_skin — draws the exact same tile pattern
// the map itself uses (see skinPattern.ts), tinted with the viewer's own
// current territory color, and clips it to a hexagon (.hex-aspect .hex-shape,
// the same utility the map's own legend dots use) so what's shown here is
// exactly what the sector looks like once equipped, not a rectangular
// approximation of it.
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
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    const pattern = buildSkinPattern(skinId, color, height, width)
    if (pattern) {
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
    ctx.moveTo(width * 0.25, 0)
    ctx.lineTo(width * 0.75, 0)
    ctx.lineTo(width, height * 0.5)
    ctx.lineTo(width * 0.75, height)
    ctx.lineTo(width * 0.25, height)
    ctx.lineTo(0, height * 0.5)
    ctx.closePath()
    ctx.stroke()
  }, [skinId, color, width, skinAssetsVersion])

  return <canvas ref={canvasRef} className="hex-aspect hex-shape shop-card-skin-preview" style={{ width }} />
}
