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
    label: 'Глубина',
    level: 1,
    base: 'linear-gradient(180deg,#0F2B3A,#071820 85%)',
    css: 'radial-gradient(120% 90% at 50% -10%, rgba(29,111,201,.55), rgba(29,111,201,0) 60%), linear-gradient(180deg,#0F2B3A,#071820 85%)',
    accentRgb: '29,111,201',
  },
  {
    id: 'topo',
    label: 'Топо-карта',
    level: 1,
    base: 'linear-gradient(180deg,#1C2E26,#0B1611 85%)',
    css: 'repeating-radial-gradient(circle at 26% 18%, rgba(255,255,255,.08) 0 1.5px, transparent 1.5px 15px), repeating-radial-gradient(circle at 80% 72%, rgba(255,255,255,.06) 0 1.5px, transparent 1.5px 19px), linear-gradient(180deg,#1C2E26,#0B1611 85%)',
    accentRgb: '80,200,140',
  },
  {
    id: 'waves',
    label: 'Волны',
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
    label: 'Аврора',
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
    label: 'Аврора (светлая)',
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
    label: 'Аврора (светлая, синий)',
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
    label: 'Аврора (светлая, розовый)',
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
    label: 'Аврора (светлая, огонь)',
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
    label: 'Камыш',
    level: 1,
    base: 'linear-gradient(180deg,#1A2A2E,#0C1517 85%)',
    css: "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='76' viewBox='0 0 160 76'><g fill='none' stroke='%23060D0F' stroke-linecap='round'><path d='M12 76Q14 46 10 16' stroke-width='2.2'/><path d='M22 76Q21 52 26 30' stroke-width='1.8'/><path d='M30 76Q34 50 42 36' stroke-width='1.4'/><path d='M58 76Q56 44 60 10' stroke-width='2.4'/><path d='M70 76Q72 56 66 38' stroke-width='1.6'/><path d='M96 76Q98 48 92 22' stroke-width='2.2'/><path d='M108 76Q104 58 114 40' stroke-width='1.5'/><path d='M132 76Q130 50 136 18' stroke-width='2.2'/><path d='M146 76Q150 60 156 50' stroke-width='1.4'/></g><g fill='%23060D0F'><rect x='7.5' y='14' width='5.5' height='17' rx='2.75'/><rect x='57' y='8' width='6' height='18' rx='3'/><rect x='89.5' y='20' width='5.5' height='16' rx='2.75'/><rect x='133.5' y='16' width='5.5' height='17' rx='2.75'/></g></svg>\") left bottom/112px 53px repeat-x, radial-gradient(120% 70% at 50% 100%, rgba(255,170,80,.30), rgba(255,170,80,0) 62%), linear-gradient(180deg,#1A2A2E,#0C1517 85%)",
    accentRgb: '255,170,80',
  },
  {
    id: 'rain',
    label: 'Дождь',
    level: 1,
    base: 'linear-gradient(180deg,#26343F,#111A21 85%)',
    css: "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 80' preserveAspectRatio='none'><g fill='none' stroke='%23CFE6F5' stroke-width='1'><ellipse cx='60' cy='52' rx='14' ry='3.2' stroke-opacity='.28'/><ellipse cx='60' cy='52' rx='28' ry='6.4' stroke-opacity='.14'/><ellipse cx='210' cy='30' rx='11' ry='2.6' stroke-opacity='.28'/><ellipse cx='210' cy='30' rx='22' ry='5.1' stroke-opacity='.14'/><ellipse cx='330' cy='58' rx='15' ry='3.5' stroke-opacity='.28'/><ellipse cx='330' cy='58' rx='31' ry='7.0' stroke-opacity='.14'/><ellipse cx='140' cy='68' rx='8' ry='1.9' stroke-opacity='.28'/><ellipse cx='140' cy='68' rx='17' ry='3.8' stroke-opacity='.14'/></g></svg>\") left bottom/100% 70px no-repeat, url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><g stroke='%23CFE6F5' stroke-opacity='.24' stroke-width='1' stroke-linecap='round'><path d='M10 4l-2 9M34 18l-2 9M58 2l-2 9M72 30l-2 9M22 40l-2 9M46 52l-2 9M66 64l-2 9M8 62l-2 9M38 72l-2 9M54 26l-2 9'/></g></svg>\") 0 0/80px 80px, linear-gradient(180deg,#26343F,#111A21 85%)",
    accentRgb: '160,200,230',
  },
  {
    id: 'scales',
    label: 'Чешуя',
    level: 2,
    base: 'linear-gradient(180deg,#26303A,#10161C 85%)',
    css: 'radial-gradient(circle at 50% 100%, transparent 8px, rgba(255,255,255,.09) 9px, transparent 10.5px) 0 0/20px 12px, radial-gradient(circle at 50% 100%, transparent 8px, rgba(255,255,255,.09) 9px, transparent 10.5px) 10px 6px/20px 12px, linear-gradient(180deg,#26303A,#10161C 85%)',
    accentRgb: '140,170,200',
  },
  {
    id: 'bubbles',
    label: 'Пузыри',
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
    label: 'Круги на воде',
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
    label: 'Полутон',
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
    label: 'Светлячки',
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
    label: 'Закат',
    level: 8,
    base: 'linear-gradient(180deg,#2A1436 0%,#5C2138 50%,#A4412A 100%)',
    css: 'radial-gradient(90% 70% at 50% 115%, rgba(255,170,70,.8), rgba(255,170,70,0) 62%), linear-gradient(180deg,#2A1436 0%,#5C2138 50%,#A4412A 100%)',
    accentRgb: '255,150,60',
  },
]

export function resolveClanBackground(id: string | null | undefined): ClanBackground {
  return CLAN_BACKGROUNDS.find((b) => b.id === id) ?? CLAN_BACKGROUNDS[0]
}
