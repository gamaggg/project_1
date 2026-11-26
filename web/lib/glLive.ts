'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'
import { observeScreenActive } from '@/lib/observeScreenActive'

// When a live WebGL background (BackgroundGL, AuroraGL) may hold a WebGL context (26.11.2026). A phone keeps only a
// handful of contexts at once (Safari ~16); past that it silently drops the OLDEST ones — the map (Mapbox is WebGL too)
// and the profile's own background went blank after a few try-ons in the Shop, where every card and every window made
// a context and nothing gave it back. So a background holds its context only while it is near the viewport and its
// screen is the visible one, gives it back (loseContext) when it leaves, and builds a new one if the phone took it away.
//
// `live` — the context may exist now; `gen` — bumped when the context was lost, so the background builds it again;
// `onLost` — the handler for the canvas's `webglcontextlost`.
const RELEASE_OFF_SCREEN_MS = 10_000 // its screen hidden (as the 2D backgrounds' canvases, observeScreenActive.ts)
const RELEASE_OUT_OF_VIEW_MS = 3_000 // scrolled away in a list (the Shop's cards)

export function useGlLive(hostRef: RefObject<HTMLElement | null>) {
  const [live, setLive] = useState(false)
  const [gen, setGen] = useState(0)
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    let inView = false
    let screenOn = false
    let timer = 0
    const update = () => {
      window.clearTimeout(timer)
      if (inView && screenOn) setLive(true)
      else timer = window.setTimeout(() => setLive(false), screenOn ? RELEASE_OUT_OF_VIEW_MS : RELEASE_OFF_SCREEN_MS)
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
        update()
      },
      { rootMargin: '200px 0px' },
    )
    io.observe(el)
    const stopScreen = observeScreenActive(el, (a) => {
      screenOn = a
      update()
    })
    return () => {
      window.clearTimeout(timer)
      io.disconnect()
      stopScreen()
    }
  }, [hostRef])
  const onLost = useCallback((e: Event) => {
    e.preventDefault()
    setGen((g) => g + 1)
  }, [])
  return { live, gen, onLost }
}

// A canvas for a live background, made inside `host` (a fresh one each time: a context given back with loseContext
// can't be had again from the same canvas).
export function makeGlCanvas(host: HTMLElement) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  host.appendChild(canvas)
  return canvas
}

// Gives the context back at once (not when the garbage collector gets to it) and removes the canvas.
export function disposeGlCanvas(canvas: HTMLCanvasElement, gl: WebGLRenderingContext | WebGL2RenderingContext | null, onLost: (e: Event) => void) {
  canvas.removeEventListener('webglcontextlost', onLost)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  canvas.remove()
}
