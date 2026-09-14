// Presets for the profile hero panel's background (see ChangeColorModal) —
// same "swatch, not free-form picker" approach as territoryColors.ts, and for
// the same reason: free colors would risk unreadable white hero text, so
// every preset here is pre-tuned to stay dark enough for it. Chosen once,
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
export type HeroBackground = { id: string; label: string; base: string; css: string; accentRgb: string }

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
]

export const DEFAULT_HERO_BG = 'default'

export function resolveHeroBackground(id: string | null | undefined): HeroBackground {
  return HERO_BACKGROUNDS.find((b) => b.id === id) ?? HERO_BACKGROUNDS[0]
}
