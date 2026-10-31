// Inside the real Telegram app the feedback is Telegram's own HapticFeedback.
// Everywhere else (the installed app or a browser tab) it falls back to
// navigator.vibrate, which Android Chrome honours; iPhone Safari has no
// vibration API at all, so there it stays a silent no-op, as does Telegram
// Desktop. Callers never have to guard any of this themselves.

type Impact = 'light' | 'medium' | 'heavy'

// The Telegram script is on every page, so HapticFeedback exists in a plain
// browser too (as a no-op) — only a real platform means Telegram will buzz.
function telegramHaptics() {
  const app = window.Telegram?.WebApp
  return app?.platform && app.platform !== 'unknown' ? app.HapticFeedback : undefined
}

// Short enough to feel like a tap rather than a buzz; Chrome ignores the call
// until the player has touched the page, which every caller here follows anyway.
const IMPACT_MS: Record<Impact, number> = { light: 10, medium: 18, heavy: 30 }

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // some web views throw instead of ignoring it: no feedback, nothing else changes
  }
}

function impact(style: Impact) {
  const tg = telegramHaptics()
  if (tg) tg.impactOccurred(style)
  else vibrate(IMPACT_MS[style])
}

// General "you tapped something" feedback — wired once, globally, to any
// click landing on a .tap-scale element (see FishZoneApp's listener),
// rather than threaded through every individual button.
export function hapticTap() {
  impact('light')
}

// A faint tick each time a dragged finger lands on a new value (the forecast's
// hour scrubber) — Telegram's own selection feedback, lighter than a tap.
export function hapticSelect() {
  const tg = telegramHaptics()
  if (tg) tg.selectionChanged()
  else vibrate(5)
}

// A distinct, heavier pulse for a real accomplishment (achievement unlock) —
// notificationOccurred is Telegram's own "something happened" feedback
// family, separate from impactOccurred's plain taps.
export function hapticSuccess() {
  const tg = telegramHaptics()
  if (tg) tg.notificationOccurred('success')
  else vibrate([18, 60, 30])
}

// Bad news (a sector taken from the player while away): Telegram's own warning
// pulse, or two firm buzzes.
export function hapticWarning() {
  const tg = telegramHaptics()
  if (tg) tg.notificationOccurred('warning')
  else vibrate([30, 50, 30])
}

// The API has no notion of a held/ramping vibration (impactOccurred is a
// single instant pulse each call, not a duration or intensity curve) — this
// approximates "building up" with a short burst of increasingly strong taps,
// landing on the success notification as the payoff at the end.
export function hapticBuildUp() {
  const steps: Array<() => void> = [() => impact('light'), () => impact('medium'), () => impact('heavy'), hapticSuccess]
  steps.forEach((step, i) => setTimeout(step, i * 90))
}
