import { currentLocale, labels, tn } from '@/lib/i18n/runtime'
// Texts for the reason codes that the server-side filter (public.moderate_text,
// see DECISIONS.md «Модерация текста») and post_comment return. The swear-word
// list itself lives only in the DB; the client repeats just the cheap checks
// below so an obvious link or CAPS gets flagged before a round trip.

export const COMMENT_MAX_LENGTH = 300

const REASON_TEXT: Record<string, string | undefined> = labels('modReason', ['empty', 'too_long', 'profanity', 'link', 'phone', 'caps', 'repeat', 'reserved', 'duplicate', 'rate_hour', 'rate_day', 'rate_catch', 'blocked', 'no_catch', 'no_parent'] as const)

export function moderationMessage(reason: string, extra?: { retryAfter?: number | null; mutedUntil?: string | null }): string {
  if (reason === 'rate_fast') return tn('modReason.rate_fast', { sec: extra?.retryAfter ?? 8 })
  if (reason === 'muted') return mutedMessage(extra?.mutedUntil ?? null)
  return REASON_TEXT[reason] ?? tn('modReason.fail')
}

export function mutedMessage(mutedUntil: string | null): string {
  if (!mutedUntil) return tn('modReason.mutedUnknown')
  const time = new Date(mutedUntil).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })
  return tn('modReason.muted', { time })
}

// Clan chat (post_clan_message): the same filter minus the swear-word check,
// its own length and rate limits, and the same mute as comments.
export const CLAN_CHAT_MAX_LENGTH = 500

const CHAT_REASON_TEXT: Record<string, string | undefined> = labels('chatReason', ['empty', 'duplicate', 'rate_burst', 'rate_day', 'not_member', 'blocked'] as const)

export function chatModerationMessage(reason: string, extra?: { mutedUntil?: string | null }): string {
  if (reason === 'rate_fast') return tn('chatReason.rate_fast')
  if (reason === 'muted') return chatMutedMessage(extra?.mutedUntil ?? null)
  return CHAT_REASON_TEXT[reason] ?? REASON_TEXT[reason] ?? tn('chatReason.fail')
}

export function chatMutedMessage(mutedUntil: string | null): string {
  if (!mutedUntil) return tn('chatReason.mutedUnknown')
  const time = new Date(mutedUntil).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })
  return tn('chatReason.muted', { time })
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
