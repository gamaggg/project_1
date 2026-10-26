import type * as Leaflet from 'leaflet'
import { observeScreenActive } from '@/lib/observeScreenActive'
import { ANIMATED_SKINS } from '@/lib/map/animatedSkins'

// A sector whose owner has an animated skin (see animatedSkins.ts). The map's
// own canvas draws such a sector as the plain tint — still, like any other —
// and this overlay paints the moving lines over it. `tile` is the corners of
// the whole hex (the box the skin is drawn into), `clip` the part to paint:
// the same hex, or one holder's slice of a shared sector.
export type AnimatedSkinEntry = {
  skinId: string
  color: string
  tile: [number, number][]
  clip: [number, number][]
}

const FRAME_MS = 1000 / 30

// A canvas over the map in its own pane (above the polygons, below the
// labels), clicks passing straight through to them. It is redrawn on its own
// clock, only while the screen is the visible one, and only for the sectors in
// view — so a city full of animated skins costs what the few on screen cost.
// A still frame when the phone asks for reduced motion.
export function createAnimatedSkinLayer(L: typeof Leaflet, map: Leaflet.Map) {
  const pane = map.getPane('animatedSkins') ?? map.createPane('animatedSkins')
  pane.style.zIndex = '450'
  pane.style.pointerEvents = 'none'
  const canvas = L.DomUtil.create('canvas', '', pane) as HTMLCanvasElement
  canvas.style.pointerEvents = 'none'
  const ctx = canvas.getContext('2d')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let entries: AnimatedSkinEntry[] = []
  let t = 4
  let last = 0
  let lastDrawn = 0
  let frameId = 0
  let running = false
  let active = true
  let zooming = false

  // The canvas is as big as the screen (about 5 MB on a phone), and few players have an
  // animated skin: with nothing to draw it is shrunk to 0×0, which frees its memory, and
  // it is sized up again when the first animated sector arrives (set below).
  function resize() {
    if (entries.length === 0) {
      canvas.width = 0
      canvas.height = 0
      return
    }
    const size = map.getSize()
    canvas.width = Math.round(size.x * dpr)
    canvas.height = Math.round(size.y * dpr)
    canvas.style.width = `${size.x}px`
    canvas.style.height = `${size.y}px`
  }

  function paint() {
    if (!ctx) return
    // The pane moves with the map; keep the canvas pinned over the viewport.
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (zooming) return
    const size = map.getSize()
    for (const e of entries) {
      const draw = ANIMATED_SKINS[e.skinId]
      if (!draw) continue
      const tile = e.tile.map(([lat, lng]) => map.latLngToContainerPoint([lat, lng]))
      let left = Infinity
      let top = Infinity
      let right = -Infinity
      let bottom = -Infinity
      for (const p of tile) {
        if (p.x < left) left = p.x
        if (p.x > right) right = p.x
        if (p.y < top) top = p.y
        if (p.y > bottom) bottom = p.y
      }
      const w = right - left
      const h = bottom - top
      if (w < 8 || h < 8 || right < 0 || bottom < 0 || left > size.x || top > size.y) continue
      ctx.save()
      ctx.beginPath()
      e.clip.forEach(([lat, lng], i) => {
        const p = map.latLngToContainerPoint([lat, lng])
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.clip()
      ctx.translate(left, top)
      // Each sector on its own clock and with its own seed, so neighbours don't play in unison.
      const [lat, lng] = e.tile[0]
      const offset = (Math.abs(Math.sin(lat * 127.1 + lng * 311.7)) * 43758.5453) % 1
      const seed = (Math.abs(Math.sin(lat * 269.5 + lng * 183.3)) * 24634.6345) % 1
      draw(ctx, w, h, t + offset * 10, e.color, seed)
      ctx.restore()
    }
  }

  function frame(now: number) {
    if (!running) return
    frameId = requestAnimationFrame(frame)
    if (now - lastDrawn < FRAME_MS) return
    if (last) t += Math.min((now - last) / 1000, 0.1)
    last = now
    lastDrawn = now
    paint()
  }
  function start() {
    if (running || !active || reduceMotion || entries.length === 0) return
    running = true
    last = 0
    frameId = requestAnimationFrame(frame)
  }
  function stop() {
    running = false
    cancelAnimationFrame(frameId)
  }

  const onZoomStart = () => {
    zooming = true
    paint()
  }
  const onZoomEnd = () => {
    zooming = false
    paint()
  }
  // Panning moves the container points; a still frame has to follow it too.
  const onMove = () => {
    if (!running) paint()
  }
  const onResize = () => {
    resize()
    paint()
  }
  resize()
  map.on('zoomstart', onZoomStart)
  map.on('zoomend', onZoomEnd)
  map.on('move', onMove)
  map.on('resize', onResize)
  const stopWatching = observeScreenActive(map.getContainer(), (a) => {
    active = a
    if (a) start()
    else stop()
  })

  return {
    set(next: AnimatedSkinEntry[]) {
      entries = next
      if (next.length === 0) {
        stop()
        resize()
        return
      }
      resize()
      paint()
      start()
    },
    destroy() {
      stop()
      stopWatching()
      map.off('zoomstart', onZoomStart)
      map.off('zoomend', onZoomEnd)
      map.off('move', onMove)
      map.off('resize', onResize)
      canvas.remove()
    },
  }
}
