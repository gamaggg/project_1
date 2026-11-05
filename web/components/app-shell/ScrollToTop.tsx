'use client'

import { useEffect, useRef, useState } from 'react'
import { hapticSelect } from '@/lib/telegram/haptics'
import { tn } from '@/lib/i18n/runtime'

// A round «наверх» button for a long screen (the diary, the catch history):
// it appears once the screen has been scrolled a good way down, sits above the
// floating menu on the right and takes the screen back to the top. Put it
// anywhere inside the screen's content — it finds the scroller (`.screen`) itself.
const SHOW_AFTER = 600

export function ScrollToTop() {
  const ref = useRef<HTMLButtonElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>('.screen')
    if (!scroller) return
    let frame = 0
    const update = () => {
      frame = 0
      setShow(scroller.scrollTop > SHOW_AFTER)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      className={`scroll-top-btn tap-scale${show ? ' show' : ''}`}
      aria-label={tn('common.toTop')}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => {
        hapticSelect()
        const scroller = ref.current?.closest<HTMLElement>('.screen')
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        scroller?.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' })
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
