import { timingSafeEqual } from 'crypto'
import { SITE_URL } from '@/lib/site'
import type { createAdminClient } from '@/lib/supabase/admin'

// The approval bot for RANGE's social media (a separate bot from @catchrangebot).
// Posts are prepared as rows of social_posts; an hour before a post is due the
// bot sends the owner a preview with «Принять / Изменить / Отменить». Nothing
// goes out without «Принять». Plan: docs/10 Продукт/Продвижение в соцсетях.md
//
// Environment (entered by the owner in Vercel): SOCIAL_BOT_TOKEN — the bot's key
// from @BotFather; SOCIAL_BOT_WEBHOOK_SECRET — any long random string, Telegram
// sends it back with every update so the webhook knows the update is real.

type Admin = ReturnType<typeof createAdminClient>

export type SocialPost = {
  id: number
  platforms: string[]
  kind: string
  scheduled_at: string
  status: string
  body: string
  captions: Record<string, string>
  media: { type: 'photo' | 'video'; url: string }[]
  feedback: string | null
  tg_message_id: number | null
}

// How long before its time a post's preview is sent.
export const PREVIEW_LEAD_MIN = 60
export const WEBHOOK_URL = `${SITE_URL}/api/social-bot/webhook`

const PLATFORM: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  instagram_story: 'Истории Instagram',
  threads: 'Threads',
  youtube: 'YouTube Shorts',
  facebook: 'Facebook',
  telegram: 'Telegram-канал',
}
const KIND: Record<string, string> = { reel: 'Рилс', post: 'Пост', story: 'История', carousel: 'Карусель', quiz: 'Викторина' }

export function botConfigured(): boolean {
  return !!process.env.SOCIAL_BOT_TOKEN && !!process.env.SOCIAL_BOT_WEBHOOK_SECRET
}

export function isTelegramUpdate(req: Request): boolean {
  const want = process.env.SOCIAL_BOT_WEBHOOK_SECRET
  if (!want) return false
  const got = Buffer.from(req.headers.get('x-telegram-bot-api-secret-token') ?? '')
  const w = Buffer.from(want)
  return got.length === w.length && timingSafeEqual(got, w)
}

type TgResult<T> = { ok: boolean; result?: T; description?: string }

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${process.env.SOCIAL_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const json = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as TgResult<T>
  if (!json.ok) throw new Error(`${method}: ${json.description ?? 'error'}`)
  return json.result as T
}

// The owner is the super admin's Telegram (one account; see profiles.is_super_admin).
export async function ownerChatId(admin: Admin): Promise<number | null> {
  const { data } = await admin
    .from('profiles')
    .select('telegram_id')
    .eq('is_super_admin', true)
    .not('telegram_id', 'is', null)
    .limit(1)
    .maybeSingle()
  return data?.telegram_id ? Number(data.telegram_id) : null
}

export function readPost(row: Record<string, unknown>): SocialPost {
  const captions = row.captions && typeof row.captions === 'object' && !Array.isArray(row.captions) ? (row.captions as Record<string, string>) : {}
  const media = Array.isArray(row.media)
    ? (row.media as { type?: string; url?: string }[])
        .filter((m) => typeof m?.url === 'string' && (m.type === 'photo' || m.type === 'video'))
        .map((m) => ({ type: m.type as 'photo' | 'video', url: m.url as string }))
    : []
  return {
    id: Number(row.id),
    platforms: (row.platforms as string[]) ?? [],
    kind: String(row.kind ?? 'post'),
    scheduled_at: String(row.scheduled_at),
    status: String(row.status),
    body: String(row.body ?? ''),
    captions,
    media,
    feedback: (row.feedback as string | null) ?? null,
    tg_message_id: row.tg_message_id == null ? null : Number(row.tg_message_id),
  }
}

// A poll or quiz for the Telegram channel, kept in captions._poll as JSON.
export type PostPoll = { type: 'quiz' | 'regular'; question: string; options: string[]; correct?: number; explanation?: string }
export function readPoll(p: SocialPost): PostPoll | null {
  const raw = p.captions._poll
  if (typeof raw !== 'string') return null
  try {
    const v = JSON.parse(raw) as Partial<PostPoll>
    if (!v.question || !Array.isArray(v.options) || v.options.length < 2) return null
    return { type: v.type === 'quiz' ? 'quiz' : 'regular', question: v.question, options: v.options.map(String), correct: v.correct, explanation: v.explanation }
  } catch {
    return null
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// «вт, 25 нояб., 18:00» — Batumi time, where the owner is.
export function whenText(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tbilisi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function platformsText(p: SocialPost): string {
  return p.platforms.map((x) => PLATFORM[x] ?? x).join(', ')
}

// The preview: when, where, the text, and the texts that differ per platform.
// `tail` is the status line added once a decision is made.
export function previewHtml(p: SocialPost, tail?: string): string {
  const end = tail ? `\n\n${tail}` : '\n\n<i>Чтобы попросить правку, ответь на это сообщение или нажми «Изменить».</i>'
  // Texts are cut before escaping, so a cut never lands inside markup; a very
  // long post falls back to a shorter preview (Telegram's limit is 4096).
  const build = (bodyMax: number, withCaptions: boolean) => {
    const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)
    const lines = [
      `<b>${KIND[p.kind] ?? 'Пост'} #${p.id}</b>`,
      `🕕 ${escapeHtml(whenText(p.scheduled_at))} (Батуми)`,
      `📍 ${escapeHtml(platformsText(p))}`,
      '',
      escapeHtml(cut(p.body || '(без текста)', bodyMax)),
    ]
    const poll = readPoll(p)
    if (poll) {
      lines.push('', `<b>${poll.type === 'quiz' ? 'Викторина' : 'Опрос'}:</b> ${escapeHtml(poll.question)}`)
      poll.options.forEach((o, i) => lines.push(`${poll.type === 'quiz' && i === (poll.correct ?? 0) ? '✅' : '▫️'} ${escapeHtml(o)}`))
      if (poll.explanation) lines.push(`<i>Разбор: ${escapeHtml(poll.explanation)}</i>`)
    }
    const other = publishedCaptions(p)
    if (withCaptions)
      for (const [platform, text] of other) {
        lines.push('', `<b>${escapeHtml(PLATFORM[platform] ?? platform)}:</b>`, escapeHtml(cut(text, 900)))
        const ru = p.captions[platform + TRANSLATION_SUFFIX]
        if (typeof ru === 'string' && ru.trim()) lines.push(`<i>Перевод: ${escapeHtml(cut(ru, 900))}</i>`)
      }
    else if (other.length) lines.push('', `(+ отдельный текст для: ${escapeHtml(other.map(([k]) => PLATFORM[k] ?? k).join(', '))})`)
    if (!p.media.length) lines.push('', '(без картинки и видео)')
    return lines.join('\n') + end
  }
  const full = build(2400, true)
  if (full.length <= 4000) return full
  for (const max of [1200, 500, 150]) {
    const short = build(max, false)
    if (short.length <= 4000) return short
  }
  return build(0, false)
}

// captions may carry a Russian translation for the owner next to a text in
// another language: {"facebook": "<Georgian>", "facebook_ru": "<Russian>"}.
// The translation is shown in the preview only and never published.
export const TRANSLATION_SUFFIX = '_ru'
// Keys starting with «_» are the bot's own notes (e.g. _threads_id), never texts.
export function publishedCaptions(p: SocialPost): [string, string][] {
  return Object.entries(p.captions).filter(([k, t]) => !k.startsWith('_') && !k.endsWith(TRANSLATION_SUFFIX) && typeof t === 'string' && t.trim() !== '')
}

export const DECIDE_KEYBOARD = (id: number) => ({
  inline_keyboard: [
    [
      { text: '✅ Принять', callback_data: `sp:ok:${id}` },
      { text: '✏️ Изменить', callback_data: `sp:edit:${id}` },
      { text: '❌ Отменить', callback_data: `sp:cancel:${id}` },
    ],
  ],
})

// Photos and videos go first (Telegram fetches them by link); if that fails
// (a video over 20 MB, a dead link) the links are listed in the text instead.
export async function sendMedia(chatId: number, p: SocialPost): Promise<string | null> {
  if (!p.media.length) return null
  try {
    if (p.media.length === 1) {
      const m = p.media[0]
      if (m.type === 'photo') await tg('sendPhoto', { chat_id: chatId, photo: m.url })
      else await tg('sendVideo', { chat_id: chatId, video: m.url, supports_streaming: true })
    } else {
      await tg('sendMediaGroup', { chat_id: chatId, media: p.media.slice(0, 10).map((m) => ({ type: m.type, media: m.url })) })
    }
    return null
  } catch (err) {
    return `Файлы не прикрепились (${err instanceof Error ? err.message : 'ошибка'}), ссылки:\n` + p.media.map((m) => m.url).join('\n')
  }
}
