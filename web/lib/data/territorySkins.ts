import { tnd } from '@/lib/i18n/runtime'
// Visual catalog for the "Скин сектора" shop items — same reasoning as
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
  // Painted live by lib/map/animatedSkins.ts instead of tiled from public/skins/<id>.svg.
  animated?: boolean
}

export const TERRITORY_SKINS: TerritorySkin[] = [
  { id: 'skin_stripes', get label() {
      return tnd('skin.skin_stripes')
    } },
  { id: 'skin_horizon', get label() {
      return tnd('skin.skin_horizon')
    } },
  { id: 'skin_diagonal', get label() {
      return tnd('skin.skin_diagonal')
    } },
  { id: 'skin_zigzag', get label() {
      return tnd('skin.skin_zigzag')
    } },
  { id: 'skin_herringbone', get label() {
      return tnd('skin.skin_herringbone')
    } },
  { id: 'skin_rain', get label() {
      return tnd('skin.skin_rain')
    } },
  { id: 'skin_wave', get label() {
      return tnd('skin.skin_wave')
    } },
  { id: 'skin_scribble', get label() {
      return tnd('skin.skin_scribble')
    } },
  { id: 'skin_net', get label() {
      return tnd('skin.skin_net')
    } },
  { id: 'skin_grass', get label() {
      return tnd('skin.skin_grass')
    } },
  // Premium (800+): same hex/viewBox and single ink as the hand-drawn ones,
  // with tonal depth from opacity alone (source-in keeps each pixel's alpha).
  { id: 'skin_scales', get label() {
      return tnd('skin.skin_scales')
    } },
  { id: 'skin_depth', get label() {
      return tnd('skin.skin_depth')
    } },
  { id: 'skin_compass', get label() {
      return tnd('skin.skin_compass')
    } },
  { id: 'skin_school', get label() {
      return tnd('skin.skin_school')
    } },
  // Animated (see lib/map/animatedSkins.ts): drawn live over the sector, no SVG.
  { id: 'skin_sonar', animated: true, get label() {
      return tnd('skin.skin_sonar')
    } },
  { id: 'skin_aquarium', animated: true, get label() {
      return tnd('skin.skin_aquarium')
    } },
  { id: 'skin_lighthouse', animated: true, get label() {
      return tnd('skin.skin_lighthouse')
    } },
  { id: 'skin_lightning', animated: true, get label() {
      return tnd('skin.skin_lightning')
    } },
]

export function resolveTerritorySkin(id: string | null | undefined): TerritorySkin | null {
  if (!id) return null
  return TERRITORY_SKINS.find((s) => s.id === id) ?? null
}
