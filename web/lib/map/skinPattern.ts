import { useEffect, useRef, useState } from 'react'
import { resolveTerritorySkin } from '@/lib/data/territorySkins'

// Each territory_skin's actual artwork is the user's own hand-drawn SVG,
// served as-is from public/skins/<id>.svg — nothing here redraws or
// reinterprets the pattern. Every file is pre-clipped (via the SVG's own
// clipPath) to the exact same hex silhouette the game's sectors use, all at
// the same viewBox, so there's a single shared aspect ratio for every skin —
// used as a fallback when a caller sizes the tile by height only (see
// buildSkinPattern's tileWidth param for why the real map passes both
// dimensions instead).
const SVG_ASPECT = 191.54 / 166.23

// Default tile size for callers that don't care about matching a specific
// on-screen size (the Shop's small fixed-size SkinPreview card). The real
// map passes its own — see DEFAULT_TILE_HEIGHT's usage below.
const DEFAULT_TILE_HEIGHT = 180
// See getSkinPattern's transform.
const OVERSCAN = 0.02

// SVGs load async, so a pattern requested before the image is ready comes
// back null (the caller falls back to a flat fill — see LeafletMap.tsx) and
// every subscriber is nudged to retry once it lands, via useSkinAssetsVersion
// below.
const imageCache = new Map<string, HTMLImageElement>()
const listeners = new Set<() => void>()

function getSkinImage(skinId: string): HTMLImageElement | null {
  const cached = imageCache.get(skinId)
  if (cached) return cached
  const img = new Image()
  img.onload = () => {
    imageCache.set(skinId, img)
    listeners.forEach((fn) => fn())
  }
  img.src = `/skins/${skinId}.svg`
  return null
}

// Rasterizes+recolors the skin's artwork once per (skin, color, size) — the
// expensive step (SVG decode, source-in composite) — as a plain canvas, not
// yet the CanvasPattern itself. `color` is whatever color that specific
// territory is already being rendered in (the owner's own chosen
// territory_color on the real map, myTerritoryColor in the picker/Shop
// preview) — a skin has no color of its own, see territorySkins.ts. The
// source SVG — already cut to the sector's own hex silhouette by the artist,
// see SVG_ASPECT above — is drawn once at that same shape, then `source-in`
// compositing swaps every pixel it actually painted to that color without
// altering the shape those pixels trace — this is the mask itself, not a
// redraw of it.
//
// `tileHeight`/`tileWidth` size the canvas in on-screen pixels — a hex
// sector on the real map can be anywhere from ~20px (zoomed out) to
// ~1000px+ (zoomed all the way in), and a raster drawn once at a fixed size
// looks soft/pixelated once the sector on screen outgrows it (or, filled
// into a smaller destination, only shows a crop of itself — a
// CanvasPattern never scales its source to fit, it always paints at native
// size).
// How the map draws a skin (vs the Shop's plain swatch): the sector's own
// tint underneath (same as an unskinned sector's fill) with the lines nearly
// opaque on top — drawn at the polygon's full opacity, since the alpha is
// baked in here. Before, the bare lines went down at the sector's 32% fill:
// fine up close, gone when zoomed out. `bold` thickens the lines (the
// artwork drawn a few times, nudged by that many pixels) for a small sector,
// where they'd otherwise shrink to hairlines.
type SkinLook = { tint: number; lines: number; bold: number }

function buildSkinCanvas(skinId: string, color: string, tileHeight: number, tileWidth?: number, look?: SkinLook): HTMLCanvasElement | null {
  if (!resolveTerritorySkin(skinId)) return null
  const img = getSkinImage(skinId)
  if (!img) return null
  const height = Math.round(tileHeight)
  const width = Math.round(tileWidth ?? height * SVG_ASPECT)
  // createPattern throws on a 0-sized canvas (InvalidStateError), which
  // aborted drawing every sector after it on the map.
  if (width < 1 || height < 1) return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const b = look?.bold ?? 0
  const nudges = b > 0 ? [[0, 0], [b, 0], [-b, 0], [0, b], [0, -b]] : [[0, 0]]
  for (const [dx, dy] of nudges) ctx.drawImage(img, dx, dy, width, height)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  if (look) ctx.globalAlpha = look.lines
  ctx.fillRect(0, 0, width, height)
  if (look) {
    ctx.globalCompositeOperation = 'destination-over'
    ctx.globalAlpha = look.tint
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1
  }
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

// Convenience for a standalone canvas that only ever draws a single
// instance of the skin at its own origin (0,0) — the Shop's SkinPreview
// card, which has no other shapes sharing its canvas. `tileHeight`/
// `tileWidth` should match that canvas's own on-screen size, or the
// artwork gets cropped rather than scaled to fit (see buildSkinCanvas).
// LeafletMap.tsx/TerritoryColorPreviewMap.tsx use useSkinPatterns() below
// instead, since they draw many sectors sharing one canvas.
export function buildSkinPattern(skinId: string, color: string, tileHeight = DEFAULT_TILE_HEIGHT, tileWidth?: number): CanvasPattern | null {
  const canvas = buildSkinCanvas(skinId, color, tileHeight, tileWidth)
  if (!canvas) return null
  return canvas.getContext('2d')!.createPattern(canvas, 'no-repeat')
}

// Ticks whenever any skin SVG finishes its one-time async load, so a
// consumer that asked for a pattern too early (and got null) knows to
// re-render and try again.
export function useSkinAssetsVersion() {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const onLoad = () => setVersion((v) => v + 1)
    listeners.add(onLoad)
    return () => {
      listeners.delete(onLoad)
    }
  }, [])
  return version
}

// A map draws many sectors sharing one canvas, each at its own position —
// unlike a `background-image`, a CanvasPattern has no idea which shape it's
// about to fill; it always paints starting from one fixed anchor in the
// canvas's own coordinate space (canvas (0,0) by default). Reusing the same
// pattern object for every skinned sector meant only the one nearest that
// anchor ever actually showed the artwork — every other same-skinned sector
// filled with the identical pattern object painted nothing, since the
// single hex-shaped image never reached that far. getSkinPattern still
// rasterizes each (skin, color, size) only once (the expensive part — see
// buildSkinCanvas, cached below), but returns a FRESH CanvasPattern every
// call, translated (via setTransform) to the specific sector's own corner —
// cheap, since it wraps the same already-rasterized canvas rather than
// re-decoding the SVG.
//
// That corner has to be in the same coordinate space Leaflet's Canvas
// renderer itself draws polygon points in — map.latLngToLayerPoint(), not
// latLngToContainerPoint() — because the renderer's ctx carries its own
// `translate(-bounds.min)` (see Leaflet's Canvas._update()) that a
// CanvasPattern's transform passes through identically, but only cancels
// out correctly if both the polygon path and this pattern start from the
// same raw layer-point space.
export function useSkinPatterns() {
  const canvasCacheRef = useRef<Map<string, HTMLCanvasElement | null>>(new Map())
  const version = useSkinAssetsVersion()
  useEffect(() => {
    canvasCacheRef.current.clear()
  }, [version])
  return function getSkinPattern(
    skinId: string,
    color: string,
    offsetX: number,
    offsetY: number,
    tileHeight = DEFAULT_TILE_HEIGHT,
    tileWidth?: number
  ): CanvasPattern | null {
    // Bucketed so a fractional pinch-zoom doesn't rebuild the raster on
    // every frame — a sector's own on-screen size only actually needs to
    // win a redraw once it's moved by more than this much.
    // Never below one bucket: a sector under ~10px on screen (the map zoomed
    // well out) rounded to 0 here, and a 0-sized canvas made createPattern
    // throw mid-draw.
    const bucketedHeight = Math.max(20, Math.round(tileHeight / 20) * 20)
    const bucketedWidth = tileWidth !== undefined ? Math.max(20, Math.round(tileWidth / 20) * 20) : undefined
    const look: SkinLook = { tint: 0.3, lines: 0.9, bold: bucketedHeight <= 60 ? 1.2 : bucketedHeight <= 120 ? 0.7 : 0 }
    const key = `${skinId}:${color}:${bucketedHeight}:${bucketedWidth ?? 'auto'}`
    let canvas = canvasCacheRef.current.get(key)
    if (canvas === undefined) {
      canvas = buildSkinCanvas(skinId, color, bucketedHeight, bucketedWidth, look)
      canvasCacheRef.current.set(key, canvas)
    }
    if (!canvas) return null
    const pattern = canvas.getContext('2d')!.createPattern(canvas, 'no-repeat')
    if (!pattern) return null
    // The raster is built at the bucketed size, so it has to be stretched
    // onto this sector's real box — painted at its own size it fell up to
    // 10px short on the right/bottom (and its hex edges off the polygon's),
    // which showed as bare strips along some sides at some zooms. A further
    // 2% on every side puts the artwork's own hex edge just outside the
    // polygon's, which clips it.
    const w = tileWidth ?? tileHeight * SVG_ASPECT
    const h = tileHeight
    pattern.setTransform(
      new DOMMatrix()
        .translate(offsetX - w * OVERSCAN, offsetY - h * OVERSCAN)
        .scale((w * (1 + 2 * OVERSCAN)) / canvas.width, (h * (1 + 2 * OVERSCAN)) / canvas.height)
    )
    return pattern
  }
}
