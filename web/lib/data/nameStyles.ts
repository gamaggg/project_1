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
}

export const NAME_STYLES: NameStyle[] = [
  { id: 'name_fire', label: 'Огненное имя', gradient: 'linear-gradient(90deg,#FC5200,#FFC24B)' },
  { id: 'name_ocean', label: 'Океаническое имя', gradient: 'linear-gradient(90deg,#1E7FD1,#4FD0C5)' },
  { id: 'name_gold', label: 'Золотое имя', gradient: 'linear-gradient(90deg,#B8860B,#FFD700,#FFF6C8)' },
  { id: 'name_emerald', label: 'Изумрудное имя', gradient: 'linear-gradient(90deg,#0E7A4E,#34D399)' },
  { id: 'name_rose', label: 'Розовое имя', gradient: 'linear-gradient(90deg,#E0447B,#FFA5C4)' },
  { id: 'name_neon', label: 'Неоновое имя', gradient: 'linear-gradient(90deg,#FF2E9E,#7C3AED,#00E5FF)' },
  {
    id: 'name_aurora',
    label: 'Имя «Северное сияние»',
    gradient: 'linear-gradient(90deg,#0FB98A,#13A9D6,#7C4DFF,#D63FA0,#0FB98A,#13A9D6,#7C4DFF,#D63FA0,#0FB98A)',
    fx: 'flow',
  },
  {
    id: 'name_lava',
    label: 'Имя «Лава»',
    gradient: 'linear-gradient(90deg,#D61F00,#FF6A00,#FFAA00,#FF6A00,#D61F00,#FF6A00,#FFAA00,#FF6A00,#D61F00)',
    fx: 'flow',
  },
  {
    id: 'name_holo',
    label: 'Имя «Голограмма»',
    gradient:
      'linear-gradient(90deg,#FF3D8B,#FF9F1C,#22C55E,#1FA2FF,#8B5CF6,#FF3D8B,#FF9F1C,#22C55E,#1FA2FF,#8B5CF6,#FF3D8B)',
    fx: 'flow',
  },
  {
    id: 'name_gold_shine',
    label: 'Имя «Золотой блеск»',
    gradient:
      'linear-gradient(105deg,transparent 40%,#FFF6CF 48%,#FFFFFF 50%,#FFF6CF 52%,transparent 60%),linear-gradient(90deg,#9A6A08,#D9A21B,#F2C230,#C68F12,#9A6A08)',
    fx: 'shine',
  },
]

export function resolveNameStyle(id: string | null | undefined): NameStyle | null {
  if (!id) return null
  return NAME_STYLES.find((s) => s.id === id) ?? null
}
