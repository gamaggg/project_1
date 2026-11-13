'use client'

import { focusManager } from '@tanstack/react-query'

// «Is the player looking at the app?» — one answer for every poll and refetch: the page's visibility,
// and Telegram's own activated/deactivated, since its «collapse» does not always hide the page
// (lib/appUpdate.ts, lib/crashBeacon.ts). Fed into react-query's focusManager, so every
// refetchInterval pauses while the app is away and refetchOnWindowFocus fires when it is back; the
// app's own timers ask appInFront() and listen with onAppFocus().
type TgEvents = { onEvent?: (e: string, f: () => void) => void; offEvent?: (e: string, f: () => void) => void }

let tgAway = false
let installed = false

export function installAppFocus() {
  if (installed || typeof window === 'undefined') return
  installed = true
  focusManager.setEventListener((handleFocus) => {
    const update = () => handleFocus(!document.hidden && !tgAway)
    const onVisibility = () => {
      // A page shown again is in front whatever Telegram said last (a lost «activated» must not
      // stop the polls for good).
      if (!document.hidden) tgAway = false
      update()
    }
    const away = () => {
      tgAway = true
      update()
    }
    const back = () => {
      tgAway = false
      update()
    }
    const tg = (window as unknown as { Telegram?: { WebApp?: TgEvents } }).Telegram?.WebApp
    document.addEventListener('visibilitychange', onVisibility)
    tg?.onEvent?.('deactivated', away)
    tg?.onEvent?.('activated', back)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      tg?.offEvent?.('deactivated', away)
      tg?.offEvent?.('activated', back)
    }
  })
}

export const appInFront = () => focusManager.isFocused()

// Called with true when the app comes back in front, false when it goes away.
export const onAppFocus = (fn: (inFront: boolean) => void) => focusManager.subscribe(fn)
