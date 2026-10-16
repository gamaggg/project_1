import { tnd } from '@/lib/i18n/runtime'
import type { TerritoryStatus } from '@/lib/data/types'

// Chosen once during onboarding (ColorStep), painted on the map on a player's
// own sectors — for the viewer from their profile, for everyone else from
// territories_with_stats.owner_territory_color (since 16.10.2026; before
// that other people's sectors were all one blue). The fixed "someone else's
// territory" blue (#3E7BFA) is now only for owners who never picked a colour.
export const TERRITORY_COLORS: { id: string; hex: string; label: string }[] = [
  { id: 'coral', hex: '#FF6B6B', get label() {
      return tnd('terrColor.coral')
    } },
  { id: 'orange', hex: '#FB6A16', get label() {
      return tnd('terrColor.orange')
    } },
  { id: 'lime', hex: '#B5E254', get label() {
      return tnd('terrColor.lime')
    } },
  { id: 'sky', hex: '#4CC9F0', get label() {
      return tnd('terrColor.sky')
    } },
  { id: 'red', hex: '#E63946', get label() {
      return tnd('terrColor.red')
    } },
  { id: 'mint', hex: '#7EF5A0', get label() {
      return tnd('terrColor.mint')
    } },
  { id: 'pink', hex: '#EEAAE3', get label() {
      return tnd('terrColor.pink')
    } },
  { id: 'purple', hex: '#A88EF5', get label() {
      return tnd('terrColor.purple')
    } },
  { id: 'yellow', hex: '#FFD60A', get label() {
      return tnd('terrColor.yellow')
    } },
]

// Same green that was hardcoded as "mine" before this feature — pre-wizard
// accounts and anyone who hasn't reached the Color step yet keep looking
// exactly as before.
export const DEFAULT_TERRITORY_COLOR = '#2FA84F'

// "other"/"free" stay fixed — only "mine" is the viewer's own chosen color.
// Shared by LeafletMap, TerritoriesListScreen and TerritoryThumbnailMap so
// the mine/other/free mapping lives in exactly one place.
export const OTHER_TERRITORY_COLOR = '#3E7BFA'
export const FREE_TERRITORY_COLOR = '#7C7E86'

// `ownerColor` is the colour the sector's owner chose (territories_with_stats
// .owner_territory_color): every player's sectors show in their own colour,
// the way their skin shows. The blue is for owners who never picked one.
export function resolveTerritoryColor(status: TerritoryStatus, myTerritoryColor: string, ownerColor?: string | null): string {
  if (status === 'mine') return myTerritoryColor
  if (status === 'other') return ownerColor ?? OTHER_TERRITORY_COLOR
  return FREE_TERRITORY_COLOR
}

// #RRGGBBAA is supported by every evergreen browser — cheaper than hand
// -tuning a "-soft" pair (like --green-soft) for each of the 10 colors.
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}

// Some palette colors (yellow, mint, lime, pink) are too light to read as
// text on their own ~16%-alpha tint — scaling every channel toward black
// keeps the hue but darkens it enough to stay legible for any of the 9
// colors, so "mine" badges use this for their text instead of the raw hex.
export function darkenForBadgeText(hex: string): string {
  const scale = (channel: string) => Math.round(parseInt(channel, 16) * 0.55).toString(16).padStart(2, '0')
  return `#${scale(hex.slice(1, 3))}${scale(hex.slice(3, 5))}${scale(hex.slice(5, 7))}`
}
