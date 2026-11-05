'use client'

import { useEffect, useRef } from 'react'
import { hexCenter, hexSize, pixelToHex, type MapLayout } from '@/lib/clan2/mapLayout'
import type { MapSector } from '@/lib/clan2/types'
import { ANIMATED_SKINS } from '@/lib/map/animatedSkins'
import { flatHexPath, tint } from '@/lib/map/hexDraw'

// The preview map, painted on one canvas: water, 37 flat-top sectors, and on
// the «Кланы» layer the clan's animated skin over its own sectors (the very
// drawing code the real map uses), defence dots, shields and flames. The
// headquarters standees are DOM, laid over it by the screen.

export type MapLayer = 'players' | 'clans'

const ACCENT = '#FC5200'
const CLAN_COLORS = { ally: '#2FA8A0', enemy: '#C0443A', free: '#9AA4B2' }
const PLAYER_COLORS = { ally: '#3E7BFA', enemy: '#8E5BD6', free: '#B9BEC7' }

function shield(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y - r * 0.6)
  ctx.lineTo(x + r * 0.85, y + r * 0.35)
  ctx.quadraticCurveTo(x, y + r * 1.25, x, y + r * 1.25)
  ctx.quadraticCurveTo(x, y + r * 1.25, x - r * 0.85, y + r * 0.35)
  ctx.lineTo(x - r, y - r * 0.6)
  ctx.closePath()
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r * 1.2)
  ctx.quadraticCurveTo(x + r, y - r * 0.1, x, y + r)
  ctx.quadraticCurveTo(x - r, y - r * 0.1, x, y - r * 1.2)
  ctx.closePath()
}

export function MapCanvas({
  sectors,
  layer,
  layout,
  selectedId,
  placing,
  clanColor,
  onPick,
}: {
  sectors: MapSector[]
  layer: MapLayer
  layout: MapLayout
  selectedId: string | null
  placing: boolean
  clanColor: string
  onPick: (id: string | null) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // The latest props, read by the animation loop without restarting it.
  const live = useRef({ sectors, layer, layout, selectedId, placing, clanColor })
  useEffect(() => {
    live.current = { sectors, layer, layout, selectedId, placing, clanColor }
  })

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(layout.w * dpr)
    canvas.height = Math.round(layout.h * dpr)
    canvas.style.width = `${layout.w}px`
    canvas.style.height = `${layout.h}px`
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    let last = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden || (!calm && now - last < 32)) return
      last = now
      const t = calm ? 2 : (now - start) / 1000
      const { sectors: list, layer: lay, layout: l, selectedId: sel, placing: pl, clanColor: cc } = live.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const bg = ctx.createLinearGradient(0, 0, 0, l.h)
      bg.addColorStop(0, '#CFE4F1')
      bg.addColorStop(1, '#E9F2F7')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, l.w, l.h)
      // A few slow swells in the water.
      ctx.strokeStyle = 'rgba(255,255,255,.55)'
      ctx.lineWidth = 1.4
      for (let k = 0; k < 9; k++) {
        const y0 = (l.h / 9) * (k + 0.5)
        ctx.beginPath()
        for (let x = 0; x <= l.w; x += 8) {
          const y = y0 + Math.sin(x * 0.03 + t * 0.5 + k * 1.7) * 3
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      const { w, h } = hexSize(l)
      const gap = 1.6
      for (const sec of list) {
        const { x, y } = hexCenter(l, sec.q, sec.r)
        const x0 = x - w / 2
        const y0 = y - h / 2
        const palette = lay === 'clans' ? CLAN_COLORS : PLAYER_COLORS
        const color = sec.owner === 'mine' ? (lay === 'clans' ? cc : ACCENT) : palette[sec.owner]
        const dim = pl && !(sec.owner === 'mine' && !sec.hq)
        ctx.save()
        flatHexPath(ctx, x0 + gap, y0 + gap, w - gap * 2, h - gap * 2)
        ctx.clip()
        ctx.fillStyle = sec.owner === 'free' ? 'rgba(255,255,255,.62)' : tint(color, dim ? 0.12 : 0.3)
        ctx.fillRect(x0, y0, w, h)
        const skin = lay === 'clans' && sec.owner === 'mine' && sec.skin ? ANIMATED_SKINS[sec.skin] : undefined
        if (skin && !dim) {
          ctx.translate(x0, y0)
          skin(ctx, w, h, t, color, (sec.q * 7 + sec.r * 13 + 50) / 100)
        }
        ctx.restore()

        flatHexPath(ctx, x0 + gap, y0 + gap, w - gap * 2, h - gap * 2)
        ctx.strokeStyle = sec.owner === 'free' ? 'rgba(120,130,145,.35)' : tint(color, dim ? 0.35 : 0.95)
        ctx.lineWidth = sec.owner === 'free' ? 1 : 2
        ctx.stroke()

        // A sector several clan-mates share is cut into equal parts.
        if (lay === 'clans' && sec.owner === 'mine' && sec.shared > 1) {
          ctx.strokeStyle = 'rgba(255,255,255,.9)'
          ctx.lineWidth = 1.6
          const corners = [
            [0.25, 0],
            [0.75, 0],
            [1, 0.5],
            [0.75, 1],
            [0.25, 1],
            [0, 0.5],
          ]
          const cuts = sec.shared === 2 ? [0, 3] : sec.shared === 3 ? [0, 2, 4] : [0, 1.5, 3, 4.5]
          for (const c of cuts) {
            const a = corners[Math.floor(c) % 6]
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x0 + a[0] * w, y0 + a[1] * h)
            ctx.stroke()
          }
        }

        // Defence dots.
        if (sec.owner !== 'free') {
          const n = Math.min(4, sec.defense)
          for (let i = 0; i < 4; i++) {
            ctx.beginPath()
            ctx.arc(x + (i - 1.5) * 6.5, y + h * 0.3, 2.2, 0, Math.PI * 2)
            ctx.fillStyle = i < n ? (sec.hq === 'mine' ? '#F0A93E' : '#17181B') : 'rgba(23,24,27,.18)'
            ctx.fill()
          }
        }
        if (sec.shield) {
          shield(ctx, x + w * 0.27, y - h * 0.22, 6)
          ctx.fillStyle = '#0E8074'
          ctx.fill()
        }
        if (sec.hot) {
          flame(ctx, x - w * 0.27, y - h * 0.2, 6 + Math.sin(t * 6 + sec.q) * 0.8)
          ctx.fillStyle = '#FF7A1A'
          ctx.fill()
        }
        if (!sec.hq) {
          ctx.font = '700 9px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillStyle = sec.owner === 'free' ? 'rgba(23,24,27,.4)' : 'rgba(23,24,27,.62)'
          ctx.fillText(sec.id.slice(1), x, y + 3)
        }
        // While a headquarters is being placed, the sectors it may go on pulse.
        if (pl && sec.owner === 'mine' && !sec.hq) {
          flatHexPath(ctx, x0 + gap + 2, y0 + gap + 2, w - gap * 2 - 4, h - gap * 2 - 4)
          ctx.setLineDash([5, 4])
          ctx.strokeStyle = tint('#F0A93E', 0.55 + 0.45 * Math.sin(t * 5))
          ctx.lineWidth = 2.4
          ctx.stroke()
          ctx.setLineDash([])
        }
        if (sel === sec.id) {
          flatHexPath(ctx, x0 + gap, y0 + gap, w - gap * 2, h - gap * 2)
          ctx.strokeStyle = '#17181B'
          ctx.lineWidth = 3
          ctx.stroke()
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [layout])

  return (
    <canvas
      ref={ref}
      className="c2-map-canvas"
      role="img"
      aria-label="map"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const { q, r } = pixelToHex(layout, e.clientX - rect.left, e.clientY - rect.top)
        onPick(sectors.find((s) => s.q === q && s.r === r)?.id ?? null)
      }}
    />
  )
}
