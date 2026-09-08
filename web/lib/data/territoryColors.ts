// Chosen once during onboarding (ColorStep), painted on the map wherever the
// viewer's OWN territories render — see DECISIONS.md for why this doesn't
// extend to showing every player's own color (would need a new join in
// useTerritories()/territories_with_stats, out of scope for now). None of
// these overlap the fixed "someone else's territory" blue (#3E7BFA) or the
// error red (#D33), so a viewer's own color is never confused with either.
export const TERRITORY_COLORS: { id: string; hex: string; label: string }[] = [
  { id: 'green', hex: '#2FA84F', label: 'Зелёный' },
  { id: 'teal', hex: '#12B5A6', label: 'Бирюзовый' },
  { id: 'purple', hex: '#8B5CF6', label: 'Фиолетовый' },
  { id: 'magenta', hex: '#E0459C', label: 'Малиновый' },
  { id: 'amber', hex: '#F2B705', label: 'Янтарный' },
  { id: 'coral', hex: '#FF7A59', label: 'Коралловый' },
  { id: 'indigo', hex: '#5B5FEF', label: 'Индиго' },
  { id: 'mint', hex: '#00C48C', label: 'Мятный' },
  { id: 'rose', hex: '#EF476F', label: 'Розовый' },
  { id: 'gold', hex: '#FFB100', label: 'Золотой' },
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
