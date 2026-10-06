'use client'

import { useEffect } from 'react'

// Swipe a bottom sheet down to close it — every `.move-sheet` at once (the
// bite forecast, defense rules, support, gifts…), mounted once by FishZoneApp.
// A tall sheet leaves only a sliver of the dimmed overlay above it, and in
// Telegram that sliver sits under its own header buttons, so tapping outside
// couldn't close it. The sheet follows the finger; let go far enough (or
// flick it) and the gesture ends in a tap on the sheet's own overlay — the
// same close every sheet already handles, busy states included.
// A drag that starts inside scrolled content scrolls it instead; so does any
// drag upwards. Text fields keep their own gestures.
export function useSheetSwipeToClose() {
  useEffect(() => {
    let sheet: HTMLElement | null = null
    let startY = 0
    let startT = 0
    let dy = 0
    let dragging = false

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const target = e.target as Element | null
      const s = target?.closest<HTMLElement>('.move-sheet')
      if (!s || target?.closest('input, textarea, select')) return
      const scroller = target?.closest<HTMLElement>('.move-body, .support-thread')
      if (scroller && scroller.scrollTop > 0) return
      sheet = s
      startY = e.touches[0].clientY
      startT = performance.now()
      dy = 0
      dragging = false
    }

    const onMove = (e: TouchEvent) => {
      const s = sheet
      if (!s) return
      const d = e.touches[0].clientY - startY
      if (!dragging) {
        if (d < -6) {
          sheet = null // upwards: a scroll, not ours
          return
        }
        if (d < 8) return
        dragging = true
        // The sheet's rise-in animation (fill-mode both) would otherwise
        // keep overriding the transform set below.
        s.style.animation = 'none'
        s.style.transition = 'none'
      }
      dy = Math.max(0, d)
      s.style.transform = `translateY(${dy}px)`
      if (e.cancelable) e.preventDefault() // no scroll or page bounce under the drag
    }

    const onEnd = () => {
      const s = sheet
      sheet = null
      if (!s || !dragging) return
      dragging = false
      const speed = dy / Math.max(1, performance.now() - startT) // px per ms
      s.style.transition = 'transform .22s cubic-bezier(.2,.8,.25,1)'
      if (dy > 110 || (dy > 40 && speed > 0.5)) {
        s.style.transform = `translateY(${s.offsetHeight}px)`
        window.setTimeout(() => {
          ;(s.closest('.move-sheet-overlay') as HTMLElement | null)?.click()
          // An overlay that doesn't close right now (something is saving):
          // the sheet comes back.
          window.setTimeout(() => {
            if (s.isConnected) s.style.transform = ''
          }, 60)
        }, 180)
      } else {
        s.style.transform = ''
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])
}
