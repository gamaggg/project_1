// window.Telegram?.WebApp?.HapticFeedback is undefined outside the real
// Telegram app (regular browser, Telegram Desktop) — every call here is a
// silent no-op there rather than a guard the caller has to remember, same
// reasoning as useTelegramBackButton's own optional-chained access.

// General "you tapped something" feedback — wired once, globally, to any
// click landing on a .tap-scale element (see FishZoneApp's listener),
// rather than threaded through every individual button.
export function hapticTap() {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
}

// A distinct, heavier pulse for a real accomplishment (achievement unlock) —
// notificationOccurred is Telegram's own "something happened" feedback
// family, separate from impactOccurred's plain taps.
export function hapticSuccess() {
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
}

// The API has no notion of a held/ramping vibration (impactOccurred is a
// single instant pulse each call, not a duration or intensity curve) — this
// approximates "building up" with a short burst of increasingly strong taps,
// landing on the success notification as the payoff at the end.
export function hapticBuildUp() {
  const steps: Array<() => void> = [
    () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'),
    () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'),
    () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy'),
    () => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'),
  ]
  steps.forEach((step, i) => setTimeout(step, i * 90))
}
