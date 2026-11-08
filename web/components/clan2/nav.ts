'use client'

import { useEffect } from 'react'
import type { Go } from '@/components/clan2/Guide'
import { requestMap, setLiveUi, useLiveUi, type LiveUi } from '@/lib/clan2/live/ui'

// Where every «go there» button of the clan screens lands: the tab, the block on it the screen scrolls to, and — for
// the base — the building it opens on. One table, so a button never just opens a tab and leaves the player to look.
export const GO_TARGET: Record<Exclude<Go, 'map'>, { tab: 'treasury' | 'hq' | 'week' | 'exit' | 'shop'; focus: string; baseSel?: string }> = {
  treasury: { tab: 'treasury', focus: 'treasury-top' },
  shop: { tab: 'shop', focus: 'shop-top' },
  hq: { tab: 'hq', focus: 'hq-card' },
  base: { tab: 'hq', focus: 'base' },
  storage: { tab: 'hq', focus: 'base', baseSel: 'storage' },
  week: { tab: 'week', focus: 'quest' },
  exit: { tab: 'exit', focus: 'exit-card' },
}

// The real app: the clan screen picks up clanTab, the open panel scrolls to `focus`.
export function goLive(to: Go) {
  if (to === 'map') return requestMap({ place: true })
  const t = GO_TARGET[to]
  const patch: Partial<LiveUi> = { clanTab: t.tab, focus: t.focus }
  if (t.baseSel) patch.baseSel = t.baseSel
  setLiveUi(patch)
}

// Scrolls to the block asked for (once it is on the screen: a tab that has just opened needs a frame or two), lights it
// up for a moment, and forgets the request.
export function useFocusScroll() {
  const { focus } = useLiveUi()
  useEffect(() => {
    if (!focus) return
    let frames = 0
    let raf = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-focus="${focus}"]`)
      if (!el) {
        if (++frames < 90) raf = requestAnimationFrame(find)
        else setLiveUi({ focus: null })
        return
      }
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
      // A one-shot animation: the class may stay; it is taken off and put back to play it again next time.
      el.classList.remove('c2-focus-flash')
      void el.offsetWidth
      el.classList.add('c2-focus-flash')
      setLiveUi({ focus: null })
    }
    raf = requestAnimationFrame(find)
    return () => cancelAnimationFrame(raf)
  }, [focus])
}
