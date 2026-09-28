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
  { id: 'bronze', label: 'Бронза', min: 0, color: '#B8743F' },
  { id: 'silver', label: 'Серебро', min: 200, color: '#9AA4B2' },
  { id: 'gold', label: 'Золото', min: 500, color: '#E0A63A' },
  { id: 'diamond', label: 'Алмаз', min: 900, color: '#4FB6E8' },
  { id: 'legend', label: 'Легенда', min: 1400, color: '#B45CFF' },
]

export function leagueFor(trophies: number): League {
  let league = LEAGUES[0]
  for (const l of LEAGUES) if (trophies >= l.min) league = l
  return league
}

export type ClanRole = 'leader' | 'co_leader' | 'elder' | 'member'
export const CLAN_ROLE_LABEL: Record<ClanRole, string> = {
  leader: 'Глава',
  co_leader: 'Соруководитель',
  elder: 'Старейшина',
  member: 'Участник',
}
export const CLAN_ROLE_RANK: Record<ClanRole, number> = { leader: 4, co_leader: 3, elder: 2, member: 1 }

export type ClanJoinType = 'open' | 'request' | 'invite'
export const JOIN_TYPE_LABEL: Record<ClanJoinType, string> = {
  open: 'Открытый',
  request: 'По заявке',
  invite: 'По приглашению',
}
export const MIN_SECTORS_OPTIONS = [0, 1, 3, 5, 10]

// Texts for the CLAN:<code> errors the clan RPCs raise, plus the name-check
// codes from check_clan_name / moderate_text.
const CLAN_ERRORS: Record<string, string> = {
  blocked: 'Аккаунт заблокирован',
  in_clan: 'Ты уже состоишь в клане',
  not_in_clan: 'Ты не состоишь в клане',
  cooldown: 'После выхода из клана нужно подождать сутки',
  not_enough_sectors: 'Не хватает захваченных секторов',
  not_enough_coins: 'Не хватает монет',
  name_short: 'Минимум 3 символа',
  too_long: 'Слишком длинно',
  name_chars: 'Только буквы, цифры, пробел и дефис',
  name_taken: 'Такой клан уже есть',
  reserved: 'Это название занято системой',
  profanity: 'Без мата и оскорблений',
  link: 'Без ссылок',
  phone: 'Без номеров телефонов',
  caps: 'Не пиши капсом',
  repeat: 'Слишком много повторов',
  empty: 'Напиши название',
  crest_invalid: 'Герб не подходит',
  crest_locked: 'Этот элемент герба откроется на следующем уровне клана',
  background_locked: 'Этот фон откроется на следующем уровне клана',
  settings_invalid: 'Проверь настройки клана',
  other_city: 'Клан из другого города',
  kicked_recently: 'Тебя недавно исключили из этого клана',
  clan_full: 'В клане нет свободных мест',
  invite_only: 'В этот клан вступают только по приглашению',
  no_clan: 'Клан не найден',
  no_request: 'Заявка уже обработана',
  not_allowed: 'Недостаточно прав',
  rename_cooldown: 'Переименовать клан можно раз в 14 дней',
}

export function clanErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? '')
  const match = raw.match(/CLAN:([a-z_]+)/)
  const code = match?.[1] ?? raw
  const fieldPrefix = code.match(/^(motto|announcement)_(.+)$/)
  if (fieldPrefix) return `${fieldPrefix[1] === 'motto' ? 'Девиз' : 'Объявление'}: ${(CLAN_ERRORS[fieldPrefix[2]] ?? 'не подходит').toLowerCase()}`
  return CLAN_ERRORS[code] ?? 'Что-то пошло не так, попробуй ещё раз'
}
