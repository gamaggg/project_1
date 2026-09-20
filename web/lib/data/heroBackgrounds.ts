// Presets for the profile hero panel's background (see ChangeColorModal) —
// same "swatch, not free-form picker" approach as territoryColors.ts, and for
// the same reason: free colors would risk unreadable hero text, so every
// preset here is pre-tuned for the text colour it declares (white by
// default via textRgb's fallback — see globals.css's --hero-text-rgb — dark
// ink only for the one light-background preset, aurora-light). Chosen once,
// stored on the profile (hero_bg), and shown to every viewer of that
// profile — not just the owner (see profiles_with_stats).
// accentRgb is "R,G,B" (no alpha, no rgba() wrapper) — consumed as
// rgba(var(--hero-accent-rgb), <alpha>) so the avatar's glow and the hero's
// own animated background glow (globals.css) can each compose their own
// alpha instead of baking one in.
//
// `css` is the full combined look (radial glow + base) — used for the
// static swatches/preview bar in ChangeColorModal, where a still image
// benefits from the glow baked in. `base` is just the dark gradient/pattern
// with no radial — the actual hero panel uses this and layers its own
// *animated* glow on top via .profile-hero::before instead, so the glow can
// breathe without needing to animate the whole multi-layer background.
// `animated` marks the presets rendered with a live component (see
// HeroBgLive.tsx) instead of a plain CSS background — base/css still stay
// filled in for them as the pre-JS-paint fallback and the static picker
// preview swatch's/Shop card's own background-image. `kind` picks which
// live component HeroBgLive renders ('waves' is the default/legacy value,
// so the original 4 waves-* entries below don't need to spell it out); the
// *Color/*Gradient fields are that kind's own palette, unused by any other
// kind.
export type HeroBackground = {
  id: string
  label: string
  base: string
  css: string
  accentRgb: string
  animated?: boolean
  kind?: 'waves' | 'aurora' | 'circles' | 'halftone'
  waveColors?: string[]
  waveBackgroundFill?: string
  auroraGradient?: string
  auroraLight?: boolean
  ringColor?: string
  dotColor?: string
  // "R,G,B" like accentRgb, consumed as rgb(var(--hero-text-rgb)) /
  // rgba(var(--hero-text-rgb), alpha) by every hero text/icon rule in
  // globals.css. Omitted almost everywhere — .profile-hero's own base rule
  // already defaults it to white — and set only by aurora-light, the one
  // preset light enough to need dark ink instead.
  textRgb?: string
}

export const HERO_BACKGROUNDS: HeroBackground[] = [
  {
    id: 'default',
    label: 'Огонь',
    base: 'linear-gradient(180deg,#1E1E24,#111114 82%)',
    css: 'radial-gradient(120% 85% at 50% -15%, rgba(252,82,0,.5), rgba(252,82,0,0) 60%), linear-gradient(180deg,#1E1E24,#111114 82%)',
    accentRgb: '252,82,0',
  },
  {
    id: 'ocean',
    label: 'Океан',
    base: 'linear-gradient(180deg,#12242E,#0A1216 82%)',
    css: 'radial-gradient(120% 85% at 50% -15%, rgba(62,123,250,.5), rgba(62,123,250,0) 60%), linear-gradient(180deg,#12242E,#0A1216 82%)',
    accentRgb: '62,123,250',
  },
  {
    id: 'forest',
    label: 'Лес',
    base: 'linear-gradient(180deg,#132A1E,#0B1610 82%)',
    css: 'radial-gradient(120% 85% at 50% -15%, rgba(60,180,110,.45), rgba(60,180,110,0) 60%), linear-gradient(180deg,#132A1E,#0B1610 82%)',
    accentRgb: '60,180,110',
  },
  {
    id: 'dusk',
    label: 'Сумерки',
    base: 'linear-gradient(180deg,#221E2E,#131018 82%)',
    css: 'radial-gradient(120% 85% at 50% -15%, rgba(168,142,245,.45), rgba(168,142,245,0) 60%), linear-gradient(180deg,#221E2E,#131018 82%)',
    accentRgb: '168,142,245',
  },
  {
    id: 'crimson',
    label: 'Багровый',
    base: 'linear-gradient(180deg,#2A1416,#160B0C 82%)',
    css: 'radial-gradient(120% 85% at 50% -15%, rgba(230,57,70,.45), rgba(230,57,70,0) 60%), linear-gradient(180deg,#2A1416,#160B0C 82%)',
    accentRgb: '230,57,70',
  },
  {
    id: 'mono',
    label: 'Моно',
    base: 'linear-gradient(180deg,#26262B,#101012 82%)',
    css: 'linear-gradient(180deg,#26262B,#101012 82%)',
    accentRgb: '255,255,255',
  },
  {
    id: 'teal',
    label: 'Бирюза',
    base: 'linear-gradient(180deg,#102A28,#081615 82%)',
    css: 'radial-gradient(120% 85% at 50% -15%, rgba(45,212,191,.5), rgba(45,212,191,0) 60%), linear-gradient(180deg,#102A28,#081615 82%)',
    accentRgb: '45,212,191',
  },
  {
    id: 'rose',
    label: 'Розовый',
    base: 'linear-gradient(180deg,#2A1420,#160A12 82%)',
    css: 'radial-gradient(120% 85% at 50% -15%, rgba(236,72,153,.45), rgba(236,72,153,0) 60%), linear-gradient(180deg,#2A1420,#160A12 82%)',
    accentRgb: '236,72,153',
  },
  {
    id: 'waves',
    label: 'Волны',
    base: 'linear-gradient(180deg,#241207,#120901 82%)',
    css: 'linear-gradient(180deg,#241207,#120901 82%)',
    accentRgb: '252,82,0',
    animated: true,
    waveColors: ['#FC5200', '#FF7A38', '#FF9A52', '#C7430B'],
    waveBackgroundFill: '#1B0F04',
  },
  {
    id: 'waves-ocean',
    label: 'Волны (море)',
    base: 'linear-gradient(180deg,#0A1B2E,#040D17 82%)',
    css: 'linear-gradient(180deg,#0A1B2E,#040D17 82%)',
    accentRgb: '62,123,250',
    animated: true,
    waveColors: ['#3E7BFA', '#5B9BFF', '#7AB8FF', '#2557C7'],
    waveBackgroundFill: '#040D17',
  },
  {
    id: 'waves-purple',
    label: 'Волны (фиолет)',
    base: 'linear-gradient(180deg,#1C0F30,#0D0718 82%)',
    css: 'linear-gradient(180deg,#1C0F30,#0D0718 82%)',
    accentRgb: '168,142,245',
    animated: true,
    waveColors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#6D28D9'],
    waveBackgroundFill: '#0D0718',
  },
  {
    id: 'waves-pink',
    label: 'Волны (розовый)',
    base: 'linear-gradient(180deg,#2A0F22,#180712 82%)',
    css: 'linear-gradient(180deg,#2A0F22,#180712 82%)',
    accentRgb: '236,72,153',
    animated: true,
    waveColors: ['#EC4899', '#F472B6', '#F9A8D4', '#BE185D'],
    waveBackgroundFill: '#180712',
  },
  // Aurora — slow-drifting diagonal colour bands (a repeating-linear-gradient
  // whose background-position animates, see HeroBgLive.tsx/AuroraBackground.tsx
  // and .hero-aurora-layer in globals.css). `default` keeps the original
  // teal/emerald ramp; the other three are the same effect recoloured into
  // the brand's own orange, plus pink and blue, each paired with the same
  // dark base its waves-* counterpart already uses.
  {
    id: 'aurora',
    label: 'Аврора',
    base: 'linear-gradient(180deg,#102A28,#081615 82%)',
    css: 'linear-gradient(180deg,#102A28,#081615 82%)',
    accentRgb: '20,184,166',
    animated: true,
    kind: 'aurora',
    auroraGradient: 'repeating-linear-gradient(100deg,#10b981 10%,#34d399 15%,#6ee7b7 20%,#2dd4bf 25%,#14b8a6 30%)',
  },
  {
    id: 'aurora-orange',
    label: 'Аврора (огонь)',
    base: 'linear-gradient(180deg,#241207,#120901 82%)',
    css: 'linear-gradient(180deg,#241207,#120901 82%)',
    accentRgb: '252,82,0',
    animated: true,
    kind: 'aurora',
    auroraGradient: 'repeating-linear-gradient(100deg,#FC5200 10%,#FF7A38 15%,#FF9A52 20%,#FFB347 25%,#C7430B 30%)',
  },
  {
    id: 'aurora-pink',
    label: 'Аврора (розовый)',
    base: 'linear-gradient(180deg,#2A0F22,#180712 82%)',
    css: 'linear-gradient(180deg,#2A0F22,#180712 82%)',
    accentRgb: '236,72,153',
    animated: true,
    kind: 'aurora',
    auroraGradient: 'repeating-linear-gradient(100deg,#EC4899 10%,#F472B6 15%,#F9A8D4 20%,#DB2777 25%,#BE185D 30%)',
  },
  {
    id: 'aurora-blue',
    label: 'Аврора (синий)',
    base: 'linear-gradient(180deg,#0A1B2E,#040D17 82%)',
    css: 'linear-gradient(180deg,#0A1B2E,#040D17 82%)',
    accentRgb: '62,123,250',
    animated: true,
    kind: 'aurora',
    auroraGradient: 'repeating-linear-gradient(100deg,#3E7BFA 10%,#5B9BFF 15%,#7AB8FF 20%,#1E4FBF 25%,#2557C7 30%)',
  },
  // The reference (shadcn.io/view/backgrounds/aurora) actually renders on a
  // near-white ground by default, not dark — every other preset here is
  // tuned dark for white hero text, so this is the one exception: a near-
  // white base, dark ink (textRgb), and the aurora layer itself switched to
  // multiply blending (auroraLight — screen blending, right for the dark
  // presets above, would just wash out to white here).
  {
    id: 'aurora-light',
    label: 'Аврора (светлая)',
    base: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    css: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    accentRgb: '20,184,166',
    textRgb: '23,24,27',
    animated: true,
    kind: 'aurora',
    // Unlike the dark presets' gradient (opaque wall-to-wall colour, meant
    // to glow via `screen` blending), this one bakes real transparent gaps
    // between the colour bands — over a near-white base, an opaque gradient
    // (even blended) just reads as a flat colour wash; actual transparency
    // is what lets the white ground show through as the reference's own
    // background does.
    auroraGradient:
      'repeating-linear-gradient(100deg,transparent 0%,transparent 20%,#10b981 26%,#34d399 30%,#6ee7b7 34%,#2dd4bf 38%,#14b8a6 42%,transparent 48%,transparent 100%)',
    auroraLight: true,
  },
  // Same light treatment as aurora-light — near-white base, transparent-gap
  // gradient, dark ink — recoloured into the brand's own orange, plus pink
  // and blue, mirroring the dark aurora family's own 3 extra colours.
  {
    id: 'aurora-light-orange',
    label: 'Аврора (светлая, огонь)',
    base: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    css: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    accentRgb: '252,82,0',
    textRgb: '23,24,27',
    animated: true,
    kind: 'aurora',
    auroraGradient:
      'repeating-linear-gradient(100deg,transparent 0%,transparent 20%,#FC5200 26%,#FF7A38 30%,#FF9A52 34%,#FFB347 38%,#C7430B 42%,transparent 48%,transparent 100%)',
    auroraLight: true,
  },
  {
    id: 'aurora-light-pink',
    label: 'Аврора (светлая, розовый)',
    base: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    css: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    accentRgb: '236,72,153',
    textRgb: '23,24,27',
    animated: true,
    kind: 'aurora',
    auroraGradient:
      'repeating-linear-gradient(100deg,transparent 0%,transparent 20%,#EC4899 26%,#F472B6 30%,#F9A8D4 34%,#DB2777 38%,#BE185D 42%,transparent 48%,transparent 100%)',
    auroraLight: true,
  },
  {
    id: 'aurora-light-blue',
    label: 'Аврора (светлая, синий)',
    base: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    css: 'linear-gradient(180deg,#FAFAF8,#F1F1ED 82%)',
    accentRgb: '62,123,250',
    textRgb: '23,24,27',
    animated: true,
    kind: 'aurora',
    auroraGradient:
      'repeating-linear-gradient(100deg,transparent 0%,transparent 20%,#3E7BFA 26%,#5B9BFF 30%,#7AB8FF 34%,#1E4FBF 38%,#2557C7 42%,transparent 48%,transparent 100%)',
    auroraLight: true,
  },
  // Circles — slow concentric rotating arcs (CirclesBackground.tsx), a cool
  // indigo so it reads as its own thing next to the warmer aurora family.
  {
    id: 'circles',
    label: 'Кольца',
    base: 'linear-gradient(180deg,#141A30,#0A0D1A 82%)',
    css: 'linear-gradient(180deg,#141A30,#0A0D1A 82%)',
    accentRgb: '124,140,255',
    animated: true,
    kind: 'circles',
    ringColor: '#7C8CFF',
  },
  // Halftone — a dot grid whose dot size follows a slow-orbiting focal point
  // (HalftoneBackground.tsx), in the brand's own orange over a neutral base
  // so the dots themselves carry all the colour.
  {
    id: 'halftone',
    label: 'Полутона',
    base: 'linear-gradient(180deg,#26262B,#101012 82%)',
    css: 'linear-gradient(180deg,#26262B,#101012 82%)',
    accentRgb: '252,82,0',
    animated: true,
    kind: 'halftone',
    dotColor: '#FC5200',
  },
]

export const DEFAULT_HERO_BG = 'default'

export function resolveHeroBackground(id: string | null | undefined): HeroBackground {
  return HERO_BACKGROUNDS.find((b) => b.id === id) ?? HERO_BACKGROUNDS[0]
}

// The animated presets are the ones sold in the Shop (see shop_items) — this
// id set is how ChangeColorModal decides which swatches need an ownership
// check instead of being freely selectable.
export const PREMIUM_HERO_BG_IDS = new Set(HERO_BACKGROUNDS.filter((b) => b.animated).map((b) => b.id))
