// Visual catalog for the "Скин территории" shop items — same reasoning as
// nameStyles.ts/shopItems.ts: the DB row is just id/category/name/price, the
// name/order lives here. Unlike frames/name styles, a skin has no fixed color
// of its own: the actual look — a repeating line pattern — is drawn by
// lib/map/skinPattern.ts's buildSkinPattern, tinted with whichever color the
// territory itself is already rendered in (the owner's own chosen
// territory_color on the real map, myTerritoryColor in the color/skin
// picker), so equipping a skin never clashes with the color you picked. Both
// the map and the Shop's own preview (see SkinPreview.tsx) call the same
// drawing code, so what you see in the Shop is exactly what the sector looks
// like — no separate CSS approximation to keep in sync.
export type TerritorySkin = {
  id: string
  label: string
}

export const TERRITORY_SKINS: TerritorySkin[] = [
  { id: 'skin_stripes', label: 'Полосы' },
  { id: 'skin_horizon', label: 'Горизонт' },
  { id: 'skin_diagonal', label: 'Диагональ' },
  { id: 'skin_zigzag', label: 'Зигзаг' },
  { id: 'skin_herringbone', label: 'Ёлочка' },
  { id: 'skin_rain', label: 'Дождь' },
  { id: 'skin_wave', label: 'Течение' },
  { id: 'skin_scribble', label: 'Вихрь' },
  { id: 'skin_net', label: 'Сеть' },
  { id: 'skin_grass', label: 'Трава' },
]

export function resolveTerritorySkin(id: string | null | undefined): TerritorySkin | null {
  if (!id) return null
  return TERRITORY_SKINS.find((s) => s.id === id) ?? null
}
