'use client'

import { useEffect, useState, type RefObject } from 'react'

// The app's frame: the nearest position:fixed ancestor (.app-shell, pinned
// to the real edges of the screen). Measured instead of the element itself —
// screens slide in with a transform, and a rect taken mid-slide would leave
// the input bar floating above its place until the next viewport event.
function frameOf(el: HTMLElement): HTMLElement {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return n
  }
  return el
}

// How far the bottom of the app's frame sits below the visible part of the
// screen — how much an input bar pinned to the bottom of `ref`'s element has
// to be lifted to clear the on-screen keyboard.
//
// Measured from the frame, not from window.innerHeight: in some
// iOS/Telegram versions the webview already shrinks above the keyboard while
// innerHeight stays stale, and the old innerHeight − visualViewport formula
// lifted the input a second time, leaving an empty gap the height of the
// keyboard. Where the webview doesn't shrink (Safari, older Telegram), the
// frame's bottom is the layout viewport's bottom and this gives exactly the
// keyboard's height, as before.
export function useKeyboardInset(ref: RefObject<HTMLElement | null>): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!vv || !el) return
    const frame = frameOf(el)
    const update = () => {
      const below = frame.getBoundingClientRect().bottom - (vv.offsetTop + vv.height)
      setInset(Math.max(0, Math.round(below)))
    }
    // Telegram on iPhone shrinks the webview a moment after the keyboard
    // opens, and no visualViewport/window event is guaranteed to follow — the
    // gap measured just before stayed and the input was lifted twice, leaving
    // the message list squeezed to a sliver. Watch the frame itself, and
    // re-measure a few times after focus while the keyboard animates in/out.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(frame)
    const timers: ReturnType<typeof setTimeout>[] = []
    const settle = () => {
      timers.forEach(clearTimeout)
      timers.length = 0
      for (const ms of [0, 120, 300, 600, 1000]) timers.push(setTimeout(update, ms))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    // iOS may scroll the page itself to bring the input into view.
    window.addEventListener('scroll', update, { passive: true })
    el.addEventListener('focusin', settle)
    el.addEventListener('focusout', settle)
    update()
    return () => {
      ro?.disconnect()
      timers.forEach(clearTimeout)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      el.removeEventListener('focusin', settle)
      el.removeEventListener('focusout', settle)
    }
  }, [ref])
  return inset
}

// The part of the screen the player can actually see while the on-screen
// keyboard is up: {top, height} of the visual viewport, or null while it is
// down. For a full-screen layer (the comments sheet) that should simply BE the
// visible part: the layer is given this box and nothing is added on top.
// useKeyboardInset above lifts a bar by a gap it measures from the frame, and
// in Telegram on iPhone the frame itself shrinks a moment after the keyboard
// opens — the gap measured just before that stayed, and the sheet was lifted
// twice, ending up at the top of the screen under Telegram's buttons.
export function useVisibleViewport(): { top: number; height: number } | null {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    // The height with no keyboard: what the viewport was when the layer opened.
    let baseline = vv.height
    const update = () => {
      baseline = Math.max(baseline, vv.height)
      setBox(vv.height < baseline - 100 ? { top: Math.round(vv.offsetTop), height: Math.round(vv.height) } : null)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return box
}
