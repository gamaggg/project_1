'use client'

import type { HeroBackground } from '@/lib/data/heroBackgrounds'
import { WavyBackground } from '@/components/app-shell/WavyBackground'
import { AuroraBackground } from '@/components/app-shell/AuroraBackground'
import { CirclesBackground } from '@/components/app-shell/CirclesBackground'
import { HalftoneBackground } from '@/components/app-shell/HalftoneBackground'

// Single dispatch point for every animated hero_bg preset's live component —
// picks by `kind` (heroBackgrounds.ts), so the 4 call sites that show a
// background (ProfileScreen's big modal preview + its swatch grid,
// ProfileScreen's and UserProfileScreen's actual hero panel) don't each need
// their own switch. `variant` only matters for the wave family, the one kind
// with a size-tunable look (waveWidth/blur) — the others render the same
// regardless of which box they're in.
export function HeroBgLive({ bg, variant }: { bg: HeroBackground; variant: 'hero' | 'preview' | 'swatch' }) {
  if (!bg.animated) return null
  switch (bg.kind) {
    case 'aurora':
      return <AuroraBackground gradient={bg.auroraGradient!} light={bg.auroraLight} />
    case 'circles':
      return <CirclesBackground color={bg.ringColor} />
    case 'halftone':
      return <HalftoneBackground color={bg.dotColor} />
    default:
      if (variant === 'swatch') return <WavyBackground waveWidth={13} blur={3} colors={bg.waveColors} backgroundFill={bg.waveBackgroundFill} />
      if (variant === 'preview') return <WavyBackground waveWidth={22} blur={5} colors={bg.waveColors} backgroundFill={bg.waveBackgroundFill} />
      return <WavyBackground colors={bg.waveColors} backgroundFill={bg.waveBackgroundFill} />
  }
}
