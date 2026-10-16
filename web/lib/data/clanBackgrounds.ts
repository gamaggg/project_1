import { tnd } from '@/lib/i18n/runtime'
import type { HeroBackground } from '@/lib/data/heroBackgrounds'

// Backgrounds for the clan screen's hero. Same shape as the profile hero
// presets so HeroBgLive renders the animated ones unchanged; `level` is the
// clan level that unlocks it and must match public._clan_item_level().
export type ClanBackground = HeroBackground & { level: number }

// Light presets (the light auroras) need dark ink in the hero — same textRgb
// convention as the profile hero.
export function isLightClanBackground(bg: ClanBackground): boolean {
  return !!bg.textRgb
}

export const CLAN_BACKGROUNDS: ClanBackground[] = [
  {
    id: 'deep',
    get label() {
      return tnd('clanBg.deep')
    },
    level: 1,
    base: 'linear-gradient(180deg,#0F2B3A,#071820 85%)',
    css: 'radial-gradient(120% 90% at 50% -10%, rgba(29,111,201,.55), rgba(29,111,201,0) 60%), linear-gradient(180deg,#0F2B3A,#071820 85%)',
    accentRgb: '29,111,201',
  },
  {
    id: 'topo',
    get label() {
      return tnd('clanBg.topo')
    },
    level: 1,
    base: 'linear-gradient(180deg,#1C2E26,#0B1611 85%)',
    css: 'repeating-radial-gradient(circle at 26% 18%, rgba(255,255,255,.08) 0 1.5px, transparent 1.5px 15px), repeating-radial-gradient(circle at 80% 72%, rgba(255,255,255,.06) 0 1.5px, transparent 1.5px 19px), linear-gradient(180deg,#1C2E26,#0B1611 85%)',
    accentRgb: '80,200,140',
  },
  {
    id: 'waves',
    get label() {
      return tnd('clanBg.waves')
    },
    level: 1,
    base: 'linear-gradient(180deg,#0A1B2E,#040D17 82%)',
    css: 'linear-gradient(180deg,#0A1B2E,#040D17 82%)',
    accentRgb: '62,123,250',
    animated: true,
    waveColors: ['#3E7BFA', '#5B9BFF', '#7AB8FF', '#2557C7'],
    waveBackgroundFill: '#040D17',
  },
  {
    id: 'aurora',
    get label() {
      return tnd('clanBg.aurora')
    },
    level: 1,
    base: 'linear-gradient(180deg,#102A28,#081615 82%)',
    css: 'linear-gradient(180deg,#102A28,#081615 82%)',
    accentRgb: '20,184,166',
    animated: true,
    kind: 'aurora',
    auroraGradient: 'repeating-linear-gradient(100deg,#10b981 10%,#34d399 15%,#6ee7b7 20%,#2dd4bf 25%,#14b8a6 30%)',
  },
  {
    id: 'aurora-light',
    get label() {
      return tnd('clanBg.aurora_light')
    },
    level: 1,
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
  {
    id: 'aurora-light-blue',
    get label() {
      return tnd('clanBg.aurora_light_blue')
    },
    level: 1,
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
  {
    id: 'aurora-light-pink',
    get label() {
      return tnd('clanBg.aurora_light_pink')
    },
    level: 1,
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
    id: 'aurora-light-orange',
    get label() {
      return tnd('clanBg.aurora_light_orange')
    },
    level: 1,
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
    id: 'reeds',
    get label() {
      return tnd('clanBg.reeds')
    },
    level: 1,
    // Live (PremiumBackgrounds' reeds scene): stems swaying in the wind.
    base: 'radial-gradient(120% 70% at 50% 100%, rgba(255,170,80,.30), rgba(255,170,80,0) 62%), linear-gradient(180deg,#1A2A2E,#0C1517 85%)',
    css: 'radial-gradient(120% 70% at 50% 100%, rgba(255,170,80,.30), rgba(255,170,80,0) 62%), linear-gradient(180deg,#1A2A2E,#0C1517 85%)',
    accentRgb: '255,170,80',
    animated: true,
    kind: 'reeds',
  },
  {
    id: 'rain',
    get label() {
      return tnd('clanBg.rain')
    },
    level: 1,
    // Live (PremiumBackgrounds' rain scene): falling streaks, rings on the water.
    base: 'linear-gradient(180deg,#26343F,#111A21 85%)',
    css: 'linear-gradient(180deg,#26343F,#111A21 85%)',
    accentRgb: '160,200,230',
    animated: true,
    kind: 'rain',
  },
  {
    id: 'scales',
    get label() {
      return tnd('clanBg.scales')
    },
    level: 2,
    base: 'linear-gradient(180deg,#26303A,#10161C 85%)',
    // Still version (reduced motion draws the scene's own frame): even rows
    // of half-rings, each row offset by half a scale, arcs meeting end to end.
    css: "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M0 0a12 12 0 0 0 24 0M-12 12a12 12 0 0 0 24 0M12 12a12 12 0 0 0 24 0' fill='none' stroke='%23FFFFFF' stroke-opacity='.11' stroke-width='1.2'/></svg>\") 0 0/22px 22px, linear-gradient(180deg,#26303A,#10161C 85%)",
    accentRgb: '140,170,200',
    // Live (PremiumBackgrounds' scales scene): a sheen runs over the scales.
    animated: true,
    kind: 'scales',
  },
  {
    id: 'bubbles',
    get label() {
      return tnd('clanBg.bubbles')
    },
    level: 3,
    base: 'linear-gradient(180deg,#0B3340,#05161D 85%)',
    css: 'linear-gradient(180deg,#0B3340,#05161D 85%)',
    accentRgb: '90,200,230',
    animated: true,
    kind: 'bubbles',
    bubbleColor: '#7FD8F0',
  },
  {
    id: 'circles',
    get label() {
      return tnd('clanBg.circles')
    },
    level: 4,
    base: 'linear-gradient(180deg,#141A30,#0A0D1A 82%)',
    css: 'linear-gradient(180deg,#141A30,#0A0D1A 82%)',
    accentRgb: '124,140,255',
    animated: true,
    kind: 'circles',
    ringColor: '#7C8CFF',
  },
  {
    id: 'halftone',
    get label() {
      return tnd('clanBg.halftone')
    },
    level: 6,
    base: 'linear-gradient(180deg,#26262B,#101012 82%)',
    css: 'linear-gradient(180deg,#26262B,#101012 82%)',
    accentRgb: '252,82,0',
    animated: true,
    kind: 'halftone',
    dotColor: '#FC5200',
  },
  {
    id: 'fireflies',
    get label() {
      return tnd('clanBg.fireflies')
    },
    level: 7,
    base: 'linear-gradient(180deg,#0F1A2E,#070B14 85%)',
    css: 'linear-gradient(180deg,#0F1A2E,#070B14 85%)',
    accentRgb: '217,242,107',
    animated: true,
    kind: 'fireflies',
    fireflyColor: '#D9F26B',
  },
  {
    id: 'sunset',
    get label() {
      return tnd('clanBg.sunset')
    },
    level: 8,
    base: 'linear-gradient(180deg,#2A1436 0%,#5C2138 50%,#A4412A 100%)',
    css: 'radial-gradient(90% 70% at 50% 115%, rgba(255,170,70,.8), rgba(255,170,70,0) 62%), linear-gradient(180deg,#2A1436 0%,#5C2138 50%,#A4412A 100%)',
    accentRgb: '255,150,60',
  },
]

export function resolveClanBackground(id: string | null | undefined): ClanBackground {
  return CLAN_BACKGROUNDS.find((b) => b.id === id) ?? CLAN_BACKGROUNDS[0]
}
