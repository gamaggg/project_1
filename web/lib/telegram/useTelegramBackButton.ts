'use client'

import { useEffect, useRef } from 'react'

// Wires a screen's own "back" action to Telegram's native chrome BackButton
// (shown in the Mini App's title bar) instead of our in-page chevron — see
// components/app-shell/BackButton.tsx, which pairs this with hiding that
// chevron whenever the native one takes over. A no-op outside Telegram, or
// while `onBack` is undefined.
//
// "Outside Telegram" is checked via initData, not just `window.Telegram`
// being defined — the telegram-web-app.js script (loaded unconditionally,
// see AuthProvider) creates a real `window.Telegram.WebApp` object with a
// working BackButton even in a plain browser tab, just with empty initData.
// That object's BackButton isn't inert there: calling show()/onClick() makes
// the SDK install its own history-based back-press polyfill so it still
// works on desktop web, which collides with FishZoneApp's own
// pushState/popstate-driven screen stack (see its push/pop) — two systems
// independently rewriting the same browser history desyncs both and can
// even force a hard navigation. Gating on initData keeps this hook inert
// for exactly the cases the module comment always claimed it covered.
export function useTelegramBackButton(onBack: (() => void) | undefined) {
  // The latest callback lives in a ref, so the button is shown and wired up
  // once per screen visit instead of on every render of the app (the stack's
  // pop is a fresh function each time): re-registering hid and re-showed the
  // native button and swapped its handler constantly, and a tap that landed
  // in between could be lost.
  const onBackRef = useRef(onBack)
  useEffect(() => {
    onBackRef.current = onBack
  })
  const enabled = !!onBack
  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton
    if (!backButton || !enabled || !window.Telegram?.WebApp?.initData) return
    const handler = () => onBackRef.current?.()
    backButton.show()
    backButton.onClick(handler)
    return () => {
      backButton.offClick(handler)
      backButton.hide()
    }
  }, [enabled])
}
