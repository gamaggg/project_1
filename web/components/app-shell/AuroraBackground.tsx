'use client'

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
export function AuroraBackground({ gradient, light }: { gradient: string; light?: boolean }) {
  return <div className={`hero-aurora-layer${light ? ' hero-aurora-layer--light' : ''}`} style={{ backgroundImage: gradient }} />
}
