'use client'

// The app's one coin glyph — every 🪙 in the UI should render through this
// instead of the raw emoji, so a future re-skin only touches one file.
// Artwork is the hand-made coin at public/brand/coin.svg (gold coin, beveled
// rim, stylized "R" mark) — a real vector, not an inline redraw, so it scales
// cleanly at every size from a 16px inline price tag up to a 96px hero.
// `animated` mirrors the CodePen gold-coin reference the product asked for:
// `bounce` is the coin hopping in place (with a paired squash/stretch
// shadow), `spin` is a single fast Y-axis flip for the moment a reward lands
// — both are transform-only so they're layout/perf-safe, and both are killed
// under prefers-reduced-motion (see globals.css).
export type CoinSize = 16 | 20 | 28 | 56 | 96

export function CoinIcon({
  size = 20,
  animated = false,
  className,
}: {
  size?: CoinSize
  animated?: 'bounce' | 'spin' | false
  className?: string
}) {
  return (
    <span
      className={`coin-icon${animated ? ` coin-icon-${animated}` : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      <img src="/brand/coin.svg" alt="" width={size} height={size} draggable={false} />
      {animated === 'bounce' && <span className="coin-icon-shadow" />}
    </span>
  )
}
