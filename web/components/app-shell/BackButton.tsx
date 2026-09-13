'use client'

import { useState, type CSSProperties } from 'react'
import { useTelegramBackButton } from '@/lib/telegram/useTelegramBackButton'

// Single reusable back affordance for every screen and onboarding step —
// wires Telegram's native chrome BackButton (see useTelegramBackButton) and,
// outside the Mini App, falls back to our own in-page chevron. Showing both
// at once would be a redundant, platform-inconsistent affordance once
// Telegram's own back button takes over, so the chevron is suppressed there.
//
// 'intro' matches full-screen onboarding/auth steps (.intro-back, absolutely
// positioned — safe to omit entirely in Telegram, no layout to preserve).
// 'icon' matches in-app screens' header-row chevron (.icon-btn, a normal
// flex child) — header-row's CSS targets the title by :nth-child(2) and
// balances via justify-content:space-between assuming a first child is
// always present, so this variant stays in the DOM but visually hidden
// rather than removed, the same spacer trick ProfileScreen's header already
// uses for its own no-back-button case.
export function BackButton({
  onClick,
  variant = 'icon',
  stroke = '#17181B',
  registerNative = true,
}: {
  onClick: () => void
  variant?: 'icon' | 'intro'
  // 'intro' only — TerritoryIntroStep's orange gradient background needs a
  // white chevron instead of the usual dark one; every other intro-style
  // screen sits on a light background and uses the default.
  stroke?: string
  // false for every screen reachable through FishZoneApp's `<Screen>` stack:
  // those never unmount (Screen only toggles a CSS class, see DECISIONS.md),
  // so every visited screen's effect would stay registered forever and race
  // to own the single native BackButton. FishZoneApp's <Screen> wrapper owns
  // that registration centrally instead, gated on which screen is actually
  // current — see its own useTelegramBackButton call. Onboarding/auth steps
  // (this prop's default) mount and unmount cleanly on their own, so they're
  // safe to self-register.
  registerNative?: boolean
}) {
  // Read once per mount, matching the pattern already used elsewhere (see
  // OnboardingFlow's viaTelegram) — initData doesn't change mid-session.
  const [viaTelegram] = useState(() => typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData)
  useTelegramBackButton(viaTelegram && registerNative ? onClick : undefined)

  if (variant === 'intro') {
    if (viaTelegram) return null
    return (
      <button className="intro-back" onClick={onClick} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    )
  }

  const hiddenStyle: CSSProperties | undefined = viaTelegram ? { visibility: 'hidden', pointerEvents: 'none' } : undefined
  return (
    <div className="icon-btn tap-scale" onClick={viaTelegram ? undefined : onClick} style={hiddenStyle} aria-hidden={viaTelegram}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </div>
  )
}
