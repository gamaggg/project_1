// Texts for the reason codes that the server-side filter (public.moderate_text,
// see DECISIONS.md «Модерация текста») and post_comment return. The swear-word
// list itself lives only in the DB; the client repeats just the cheap checks
// below so an obvious link or CAPS gets flagged before a round trip.

export const COMMENT_MAX_LENGTH = 300

const REASON_TEXT: Record<string, string> = {
  empty: 'Напиши текст комментария',
  too_long: 'Слишком длинно',
  profanity: 'Без мата и оскорблений, пожалуйста',
  link: 'Ссылки публиковать нельзя',
  phone: 'Номера телефонов публиковать нельзя',
  caps: 'Не кричи — убери капс',
  repeat: 'Слишком много повторов',
  reserved: 'Это название занято системой',
  duplicate: 'Ты уже это писал',
  rate_hour: 'Слишком много комментариев за час — сделай паузу',
  rate_day: 'Лимит комментариев на сегодня исчерпан',
  rate_catch: 'Слишком много комментариев под этим уловом — подожди немного',
  blocked: 'Аккаунт заблокирован — комментарии недоступны',
  no_catch: 'Улов удалён',
  no_parent: 'Комментарий, на который ты отвечаешь, удалён',
}

export function moderationMessage(reason: string, extra?: { retryAfter?: number | null; mutedUntil?: string | null }): string {
  if (reason === 'rate_fast') return `Не так быстро — подожди ${extra?.retryAfter ?? 8} с`
  if (reason === 'muted') return mutedMessage(extra?.mutedUntil ?? null)
  return REASON_TEXT[reason] ?? 'Не удалось отправить комментарий'
}

export function mutedMessage(mutedUntil: string | null): string {
  if (!mutedUntil) return 'Комментарии временно недоступны'
  const time = new Date(mutedUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `Комментарии недоступны до ${time} за нарушения правил`
}

// Clan chat (post_clan_message): the same filter minus the swear-word check,
// its own length and rate limits, and the same mute as comments.
export const CLAN_CHAT_MAX_LENGTH = 500

const CHAT_REASON_TEXT: Record<string, string> = {
  empty: 'Напиши сообщение',
  duplicate: 'Ты только что это писал',
  rate_burst: 'Слишком много сообщений — подожди пару минут',
  rate_day: 'Лимит сообщений на сегодня исчерпан',
  not_member: 'Ты больше не в этом клане',
  blocked: 'Аккаунт заблокирован — чат недоступен',
}

export function chatModerationMessage(reason: string, extra?: { mutedUntil?: string | null }): string {
  if (reason === 'rate_fast') return 'Не так быстро'
  if (reason === 'muted') return chatMutedMessage(extra?.mutedUntil ?? null)
  return CHAT_REASON_TEXT[reason] ?? REASON_TEXT[reason] ?? 'Не удалось отправить сообщение'
}

export function chatMutedMessage(mutedUntil: string | null): string {
  if (!mutedUntil) return 'Чат временно недоступен'
  const time = new Date(mutedUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `Чат недоступен до ${time} за нарушения правил`
}

// Links to RANGE itself (a sector, catch, clan, profile, invite) are allowed
// in comments and the clan chat — only outside links are blocked. The exact
// domain only: «fakecatchrange.com» or «catchrange.com.evil.ru» still count
// as outside links. moderate_text does the same on the server.
export const APP_LINK_RE = /(?<![\w.-])(?:https?:\/\/)?(?:www\.)?catchrange\.com(?![\w-])(?:\/\S*)?/gi

// Mirrors the link/phone/caps/repeat branches of moderate_text — never the
// only line of defence, just instant feedback while typing.
export function quickCheck(text: string, maxLength = COMMENT_MAX_LENGTH): string | null {
  if (!text.trim()) return null
  if (text.trim().length > maxLength) return 'too_long'
  const t = text.replace(APP_LINK_RE, ' ').trim()
  if (!t) return null
  if (/(https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{4,}|\b[a-z0-9-]+\.(ru|com|net|org|io|me|ge|рф)\b)/i.test(t)) return 'link'
  if (/\d([\s\-().]?\d){6,}/.test(t)) return 'phone'
  const letters = t.match(/[A-Za-zА-Яа-яЁё]/g)?.length ?? 0
  const upper = t.match(/[A-ZА-ЯЁ]/g)?.length ?? 0
  if (letters >= 10 && upper / letters > 0.7) return 'caps'
  if (/(.)\1{6,}/u.test(t)) return 'repeat'
  return null
}
