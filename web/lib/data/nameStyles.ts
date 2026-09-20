// Visual catalog for the "Стиль имени" shop items — the shop_items DB rows
// only carry id/category/name/price, so the actual gradient lives here,
// keyed by the same id the DB row uses (see shopItems.ts's identical
// reasoning for avatar frames).
export type NameStyle = {
  id: string
  label: string
  gradient: string
}

export const NAME_STYLES: NameStyle[] = [
  { id: 'name_fire', label: 'Огненное имя', gradient: 'linear-gradient(90deg,#FC5200,#FFC24B)' },
  { id: 'name_ocean', label: 'Океаническое имя', gradient: 'linear-gradient(90deg,#1E7FD1,#4FD0C5)' },
  { id: 'name_gold', label: 'Золотое имя', gradient: 'linear-gradient(90deg,#B8860B,#FFD700,#FFF6C8)' },
  { id: 'name_emerald', label: 'Изумрудное имя', gradient: 'linear-gradient(90deg,#0E7A4E,#34D399)' },
  { id: 'name_rose', label: 'Розовое имя', gradient: 'linear-gradient(90deg,#E0447B,#FFA5C4)' },
  { id: 'name_neon', label: 'Неоновое имя', gradient: 'linear-gradient(90deg,#FF2E9E,#7C3AED,#00E5FF)' },
]

export function resolveNameStyle(id: string | null | undefined): NameStyle | null {
  if (!id) return null
  return NAME_STYLES.find((s) => s.id === id) ?? null
}
