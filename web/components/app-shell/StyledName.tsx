'use client'

import { resolveNameStyle } from '@/lib/data/nameStyles'

// Wherever a display name renders prominently (profile header, leaderboard)
// — small/decorative name spots (CatcherLabel, activity feed actor names)
// deliberately don't use this, a gradient at 11px reads as noise, not style.
export function StyledName({ name, styleId, className }: { name: string; styleId: string | null | undefined; className?: string }) {
  const style = resolveNameStyle(styleId)
  if (!style) return <span className={className}>{name}</span>
  return (
    <span
      className={className}
      style={{
        background: style.gradient,
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
