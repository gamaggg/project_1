import { labels, tn } from '@/lib/i18n/runtime'

// Clan progression. Level thresholds and capacity must match the SQL
// public._clan_level() / public._clan_capacity().

export const CLAN_PRICE = 700
export const CLAN_SECTORS_NEEDED = 3
export const CLAN_LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]

export function clanLevel(xp: number): number {
  let level = 1
  CLAN_LEVEL_XP.forEach((min, i) => {
    if (xp >= min) level = i + 1
  })
  return level
}

export function clanCapacity(level: number): number {
  if (level >= 7) return 30
  if (level >= 5) return 25
  if (level >= 3) return 20
  return 15
}

// How far into the current level, for the XP bar on the clan screen.
export function clanLevelProgress(xp: number): { level: number; from: number; to: number | null; pct: number } {
  const level = clanLevel(xp)
  const from = CLAN_LEVEL_XP[level - 1]
  const to = CLAN_LEVEL_XP[level] ?? null
  return { level, from, to, pct: to === null ? 1 : (xp - from) / (to - from) }
}

export type League = { id: string; label: string; min: number; color: string }
export const LEAGUES: League[] = [
  { id: 'bronze', get label() { return tn('league.bronze') }, min: 0, color: '#B8743F' },
  { id: 'silver', get label() { return tn('league.silver') }, min: 200, color: '#9AA4B2' },
  { id: 'gold', get label() { return tn('league.gold') }, min: 500, color: '#E0A63A' },
  { id: 'diamond', get label() { return tn('league.diamond') }, min: 900, color: '#4FB6E8' },
  { id: 'legend', get label() { return tn('league.legend') }, min: 1400, color: '#B45CFF' },
]

export function leagueFor(trophies: number): League {
  let league = LEAGUES[0]
  for (const l of LEAGUES) if (trophies >= l.min) league = l
  return league
}

export type ClanRole = 'leader' | 'co_leader' | 'elder' | 'member'
export const CLAN_ROLE_LABEL: Record<ClanRole, string> = labels('clanRole', ['leader', 'co_leader', 'elder', 'member'] as const)
export const CLAN_ROLE_RANK: Record<ClanRole, number> = { leader: 4, co_leader: 3, elder: 2, member: 1 }

export type ClanJoinType = 'open' | 'request' | 'invite'
export const JOIN_TYPE_LABEL: Record<ClanJoinType, string> = labels('clanJoin', ['open', 'request', 'invite'] as const)
export const MIN_SECTORS_OPTIONS = [0, 1, 3, 5, 10]

// Texts for the CLAN:<code> errors the clan RPCs raise, plus the name-check
// codes from check_clan_name / moderate_text.
const CLAN_ERRORS: Record<string, string | undefined> = labels('clanError', ['blocked', 'in_clan', 'not_in_clan', 'cooldown', 'not_enough_sectors', 'not_enough_coins', 'name_short', 'too_long', 'name_chars', 'name_taken', 'reserved', 'profanity', 'link', 'phone', 'caps', 'repeat', 'empty', 'crest_invalid', 'crest_locked', 'background_locked', 'settings_invalid', 'other_city', 'kicked_recently', 'clan_full', 'invite_only', 'no_clan', 'no_request', 'not_allowed', 'rename_cooldown', 'war_not_open', 'war_exists', 'war_roster_small', 'war_bad_roster', 'war_not_started', 'war_finished', 'war_nothing_to_add'] as const)

export function clanErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? '')
  const match = raw.match(/CLAN:([a-z_]+)/)
  const code = match?.[1] ?? raw
  const fieldPrefix = code.match(/^(motto|announcement)_(.+)$/)
  if (fieldPrefix) return `${fieldPrefix[1] === 'motto' ? tn('clanError.fieldMotto') : tn('clanError.fieldAnnouncement')}: ${(CLAN_ERRORS[fieldPrefix[2]] ?? tn('clanError.fieldBad')).toLowerCase()}`
  return CLAN_ERRORS[code] ?? tn('clanError.generic')
}
