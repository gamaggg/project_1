'use client'

import type { ReactNode } from 'react'

// Shared "gradient hex badge" look — the catch-trophy stamp, the achievement-
// unlock modal and the achievement detail screen all want the exact same
// treatment. Built from stacked clip-path hexes (hex-shape, the same utility
// class every other hex in the app uses) rather than an SVG polygon+stroke on
// a non-uniformly-scaled viewBox — that stretched the stroke width unevenly
// around the hex and made the corners look off (see DECISIONS.md).
export function HexBadge({
  unlocked,
  icon,
  strokeWidth = 3,
  className,
}: {
  unlocked: boolean
  icon: ReactNode
  strokeWidth?: number
  className?: string
}) {
  return (
    <div className={`hexbadge${className ? ` ${className}` : ''}`}>
      <div className={`hexbadge-stroke hex-shape ${unlocked ? 'on' : 'off'}`} />
      <div className={`hexbadge-fill hex-shape ${unlocked ? 'on' : 'off'}`} style={{ inset: strokeWidth }} />
      {unlocked && <div className="hexbadge-gloss hex-shape" style={{ inset: strokeWidth }} />}
      <div className={`hexbadge-icon ${unlocked ? 'on' : 'off'}`}>{icon}</div>
    </div>
  )
}
