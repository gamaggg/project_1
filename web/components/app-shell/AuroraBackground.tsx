'use client'

import { useState } from 'react'

// Length of one heroAurora loop (globals.css) — the phase below is taken
// modulo this, so every aurora on screen is at the same point of its drift.
const AURORA_LOOP_MS = 24_000

// A slow-drifting diagonal colour-band effect — deliberately pure CSS, not
// canvas: the whole thing is one animated background-position (see
// .hero-aurora-layer/@keyframes heroAurora in globals.css), which every
// browser already handles natively, so unlike WavyBackground.tsx/
// CirclesBackground.tsx/HalftoneBackground.tsx there's no per-frame JS draw
// loop to pay for. `gradient` is the preset's own repeating-linear-gradient
// string (see heroBackgrounds.ts's auroraGradient) — the class only owns the
// motion/blur/blend, not the colour. `light` (heroBackgrounds.ts's
// auroraLight) switches the blend mode for a near-white base — the default
// `screen` blend brightens, which over dark grounds is the glow every other
// preset wants, but over a light ground it just washes out to white.
//
// The animation is phase-locked to the wall clock (a negative delay of "how
// far into the loop we are right now"), so layers mounted at different
// moments — a grid of swatches where one was already showing — still drift
// in step instead of each starting from zero. `swatch` tightens the loop for
// small previews so a light preset's single colour band stays in frame most
// of the time instead of leaving a blank white tile.
export function AuroraBackground({ gradient, light, swatch }: { gradient: string; light?: boolean; swatch?: boolean }) {
  const [delay] = useState(() => `-${(Date.now() % AURORA_LOOP_MS) / 1000}s`)
  return (
    <div
      className={`hero-aurora-layer${light ? ' hero-aurora-layer--light' : ''}${swatch ? ' hero-aurora-layer--swatch' : ''}`}
      style={{ backgroundImage: gradient, animationDelay: delay }}
    />
  )
}
