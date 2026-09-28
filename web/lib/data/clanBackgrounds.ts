import type { HeroBackground } from '@/lib/data/heroBackgrounds'

// Backgrounds for the clan screen's hero. Same shape as the profile hero
// presets so HeroBgLive renders the animated ones unchanged; `level` is the
// clan level that unlocks it and must match public._clan_item_level().
export type ClanBackground = HeroBackground & { level: number }

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
    id: 'scales',
    label: 'Чешуя',
    level: 2,
    base: 'linear-gradient(180deg,#26303A,#10161C 85%)',
    css: 'radial-gradient(circle at 50% 100%, transparent 8px, rgba(255,255,255,.09) 9px, transparent 10.5px) 0 0/20px 12px, radial-gradient(circle at 50% 100%, transparent 8px, rgba(255,255,255,.09) 9px, transparent 10.5px) 10px 6px/20px 12px, linear-gradient(180deg,#26303A,#10161C 85%)',
    accentRgb: '140,170,200',
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
