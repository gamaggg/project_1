import { tnd } from '@/lib/i18n/runtime'
import { GL_FAMILY_IDS, GL_LOOKS, glNameId } from '@/lib/data/glKits'
// Visual catalog for the "Стиль имени" shop items — the shop_items DB rows
// only carry id/category/name/price, so the actual gradient lives here,
// keyed by the same id the DB row uses (see shopItems.ts's identical
// reasoning for avatar frames).
export type NameStyle = {
  id: string
  label: string
  gradient: string
  // Premium (800+) styles move — see .name-fx-* in globals.css. A flow
  // gradient must repeat once across its own length (first colour = middle
  // colour = last) so the drift loops without a seam; a shine gradient is
  // two layers: the glint first, then the base.
  fx?: 'flow' | 'shine'
  // 24.11.2026: effects that are not a gradient fill at all (StyledName.tsx draws them; `gradient` is then only the
  // shop swatch / fallback): «Стикер» — white letters, dark outline, orange drop; «Неоновая вывеска» — glowing tube
  // letters that flicker now and then; «Волна» — each letter bobs in turn like a float; «Пузырьки» — an ocean fill
  // with bubbles rising off the name.
  effect?: 'sticker' | 'neon' | 'wave' | 'bubbles'
}

export const NAME_STYLES: NameStyle[] = [
  // Новинки 24.11.2026 (shop_items sort_order −4…−1): sticker 300, neon sign 700, wave 1 100, bubbles 1 800.
  { id: 'name_sticker', get label() {
      return tnd('nameStyle.name_sticker')
    }, gradient: 'linear-gradient(90deg,#FFFFFF,#FFFFFF)', effect: 'sticker' },
  { id: 'name_neon_sign', get label() {
      return tnd('nameStyle.name_neon_sign')
    }, gradient: 'linear-gradient(90deg,#FF5FC8,#FF9BE0)', effect: 'neon' },
  { id: 'name_wave', get label() {
      return tnd('nameStyle.name_wave')
    }, gradient: 'linear-gradient(90deg,#12B5C9,#2F7BEF)', effect: 'wave' },
  { id: 'name_bubbles', get label() {
      return tnd('nameStyle.name_bubbles')
    }, gradient: 'linear-gradient(180deg,#7FE7FF,#1E8FD6 55%,#0B5FA8)', effect: 'bubbles' },
  { id: 'name_fire', get label() {
      return tnd('nameStyle.name_fire')
    }, gradient: 'linear-gradient(90deg,#FC5200,#FFC24B)' },
  { id: 'name_ocean', get label() {
      return tnd('nameStyle.name_ocean')
    }, gradient: 'linear-gradient(90deg,#1E7FD1,#4FD0C5)' },
  { id: 'name_gold', get label() {
      return tnd('nameStyle.name_gold')
    }, gradient: 'linear-gradient(90deg,#B8860B,#FFD700,#FFF6C8)' },
  { id: 'name_emerald', get label() {
      return tnd('nameStyle.name_emerald')
    }, gradient: 'linear-gradient(90deg,#0E7A4E,#34D399)' },
  { id: 'name_rose', get label() {
      return tnd('nameStyle.name_rose')
    }, gradient: 'linear-gradient(90deg,#E0447B,#FFA5C4)' },
  { id: 'name_neon', get label() {
      return tnd('nameStyle.name_neon')
    }, gradient: 'linear-gradient(90deg,#FF2E9E,#7C3AED,#00E5FF)' },
  {
    id: 'name_aurora',
    get label() {
      return tnd('nameStyle.name_aurora')
    },
    gradient: 'linear-gradient(90deg,#0FB98A,#13A9D6,#7C4DFF,#D63FA0,#0FB98A,#13A9D6,#7C4DFF,#D63FA0,#0FB98A)',
    fx: 'flow',
  },
  {
    id: 'name_lava',
    get label() {
      return tnd('nameStyle.name_lava')
    },
    gradient: 'linear-gradient(90deg,#D61F00,#FF6A00,#FFAA00,#FF6A00,#D61F00,#FF6A00,#FFAA00,#FF6A00,#D61F00)',
    fx: 'flow',
  },
  {
    id: 'name_holo',
    get label() {
      return tnd('nameStyle.name_holo')
    },
    gradient:
      'linear-gradient(90deg,#FF3D8B,#FF9F1C,#22C55E,#1FA2FF,#8B5CF6,#FF3D8B,#FF9F1C,#22C55E,#1FA2FF,#8B5CF6,#FF3D8B)',
    fx: 'flow',
  },
  {
    id: 'name_gold_shine',
    get label() {
      return tnd('nameStyle.name_gold_shine')
    },
    gradient:
      'linear-gradient(105deg,transparent 40%,#FFF6CF 48%,#FFFFFF 50%,#FFF6CF 52%,transparent 60%),linear-gradient(90deg,#9A6A08,#D9A21B,#F2C230,#C68F12,#9A6A08)',
    fx: 'shine',
  },
  // The name styles of the paid live backgrounds (sold only for Telegram Stars): the family's colours drifting through the letters.
  ...GL_FAMILY_IDS.map(
    (f): NameStyle => ({
      id: glNameId(f),
      get label() {
        return tnd(`nameStyle.${glNameId(f)}`)
      },
      gradient: GL_LOOKS[f].nameGradient,
      fx: GL_LOOKS[f].nameFx,
    }),
  ),
]

export function resolveNameStyle(id: string | null | undefined): NameStyle | null {
  if (!id) return null
  return NAME_STYLES.find((s) => s.id === id) ?? null
}
