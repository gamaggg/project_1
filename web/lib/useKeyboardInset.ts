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
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    // iOS may scroll the page itself to bring the input into view.
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [ref])
  return inset
}
