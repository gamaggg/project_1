// Chosen once during onboarding (ColorStep), painted on the map wherever the
// viewer's OWN territories render — see DECISIONS.md for why this doesn't
// extend to showing every player's own color (would need a new join in
// useTerritories()/territories_with_stats, out of scope for now). None of
// these overlap the fixed "someone else's territory" blue (#3E7BFA) or the
// error red (#D33), so a viewer's own color is never confused with either.
export const TERRITORY_COLORS: { id: string; hex: string; label: string }[] = [
  { id: 'coral', hex: '#FF6B6B', label: 'Коралловый' },
  { id: 'orange', hex: '#FB6A16', label: 'Оранжевый' },
  { id: 'lime', hex: '#B5E254', label: 'Лаймовый' },
  { id: 'sky', hex: '#4CC9F0', label: 'Голубой' },
  { id: 'red', hex: '#E63946', label: 'Красный' },
  { id: 'mint', hex: '#7EF5A0', label: 'Мятный' },
  { id: 'pink', hex: '#EEAAE3', label: 'Розовый' },
  { id: 'purple', hex: '#A88EF5', label: 'Фиолетовый' },
  { id: 'yellow', hex: '#FFD60A', label: 'Жёлтый' },
]

// Same green that was hardcoded as "mine" before this feature — pre-wizard
// accounts and anyone who hasn't reached the Color step yet keep looking
// exactly as before.
export const DEFAULT_TERRITORY_COLOR = '#2FA84F'

// #RRGGBBAA is supported by every evergreen browser — cheaper than hand
// -tuning a "-soft" pair (like --green-soft) for each of the 10 colors.
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}
