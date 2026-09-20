'use client'

import { useEffect } from 'react'

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
  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton
    if (!backButton || !onBack || !window.Telegram?.WebApp?.initData) return
    backButton.show()
    backButton.onClick(onBack)
    return () => {
      backButton.offClick(onBack)
      backButton.hide()
    }
  }, [onBack])
}
