'use client'

import { useEffect } from 'react'

// Wires a screen's own "back" action to Telegram's native chrome BackButton
// (shown in the Mini App's title bar) instead of our in-page chevron — see
// components/app-shell/BackButton.tsx, which pairs this with hiding that
// chevron whenever the native one takes over. A no-op outside Telegram
// (window.Telegram is undefined there) or while `onBack` is undefined.
export function useTelegramBackButton(onBack: (() => void) | undefined) {
  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton
    if (!backButton || !onBack) return
    backButton.show()
    backButton.onClick(onBack)
    return () => {
      backButton.offClick(onBack)
      backButton.hide()
    }
  }, [onBack])
}
