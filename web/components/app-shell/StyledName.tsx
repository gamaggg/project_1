'use client'

import { resolveNameStyle } from '@/lib/data/nameStyles'

// Wherever a display name renders prominently (profile header, leaderboard)
// — small/decorative name spots (CatcherLabel, activity feed actor names)
// deliberately don't use this, a gradient at 11px reads as noise, not style.
export function StyledName({ name, styleId, className }: { name: string; styleId: string | null | undefined; className?: string }) {
  const style = resolveNameStyle(styleId)
  if (!style) return <span className={className}>{name}</span>
  // 24.11.2026: the non-gradient effects (nameStyles.ts `effect`).
  if (style.effect === 'sticker' || style.effect === 'neon') {
    return <span className={[className, `name-fx-${style.effect}`].filter(Boolean).join(' ')}>{name}</span>
  }
  if (style.effect === 'wave') {
    // Each letter bobs a beat after the one before; colour slides from teal to blue along the name.
    const letters = Array.from(name)
    return (
      <span className={[className, 'name-fx-wave'].filter(Boolean).join(' ')} aria-label={name}>
        {letters.map((ch, i) => (
          <span
            key={i}
            aria-hidden
            style={{ animationDelay: `${(i * 0.09).toFixed(2)}s`, color: `color-mix(in srgb, #12B5C9 ${Math.round(100 - (i / Math.max(1, letters.length - 1)) * 100)}%, #2F7BEF)` }}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        ))}
      </span>
    )
  }
  if (style.effect === 'bubbles') {
    return (
      <span className={[className, 'name-fx-bubbles'].filter(Boolean).join(' ')}>
        <span className="name-fx-bubbles-text" style={{ backgroundImage: style.gradient }}>
          {name}
        </span>
        {[12, 46, 78].map((x, i) => (
          <i key={x} aria-hidden style={{ left: `${x}%`, animationDelay: `${i * -0.9}s` }} />
        ))}
      </span>
    )
  }
  return (
    <span
      className={[className, style.fx && `name-fx-${style.fx}`].filter(Boolean).join(' ') || undefined}
      style={{
        // backgroundImage, not the `background` shorthand: the shorthand
        // would also pin size/position inline, over the .name-fx-* classes
        // that animate them.
        backgroundImage: style.gradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        // iOS Safari/WKWebView (Telegram's in-app browser on iPhone) has a
        // long-standing bug where background-clip:text silently falls back
        // to painting the full solid box instead of clipping to the glyphs
        // — reported to correlate with the element not having its own
        // compositing layer. Forcing one here (isolate + a no-op 3D
        // transform, the standard workaround for this exact failure mode)
        // fixed it; unreproducible in Chromium, where it always clipped
        // correctly, so this can't be verified visually in this session.
        isolation: 'isolate',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
    >
      {name}
    </span>
  )
}
