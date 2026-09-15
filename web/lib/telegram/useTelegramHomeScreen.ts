'use client'

import { useEffect, useState } from 'react'

// 'unsupported' is also the resting state outside Telegram entirely (no
// WebApp at all) and on old clients (isVersionAtLeast('8.0') false) — same
// "just don't render the button" outcome either way, see ProfileScreen.
export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed'

export function useTelegramHomeScreen() {
  const [status, setStatus] = useState<HomeScreenStatus>('unsupported')

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp?.isVersionAtLeast?.('8.0') || !webApp.checkHomeScreenStatus) return
    webApp.checkHomeScreenStatus(setStatus)
    // Fired once the OS-level "add" flow actually completes — updates the
    // button to reflect it without waiting for the whole screen to remount.
    const onAdded = () => setStatus('added')
    webApp.onEvent?.('homeScreenAdded', onAdded)
    return () => webApp.offEvent?.('homeScreenAdded', onAdded)
  }, [])

  function promptAdd() {
    window.Telegram?.WebApp?.addToHomeScreen?.()
  }

  return { status, promptAdd }
}
