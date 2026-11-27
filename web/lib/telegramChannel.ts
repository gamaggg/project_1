import { readPoll, tg, type SocialPost } from '@/lib/socialBot'

// Publishing to RANGE's Telegram channel (@catchrange) with the same bot that sends
// the owner the previews (SOCIAL_BOT_TOKEN). The owner makes that bot an administrator
// of the channel with the right to post; the channel can be changed with
// TELEGRAM_CHANNEL in Vercel (default @catchrange).
// A post is a text, a photo/video with a caption, and/or a poll: captions._poll holds
// {"type":"quiz"|"regular","question":"…","options":["…"],"correct":0,"explanation":"…"}.
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

const CAPTION_LIMIT = 1024

export function telegramChannelConfigured(): boolean {
  return !!process.env.SOCIAL_BOT_TOKEN
}

function channel(): string {
  return process.env.TELEGRAM_CHANNEL || '@catchrange'
}

// The text for the channel: its own caption if the post has one, else the common text.
export function telegramText(p: SocialPost): string {
  const own = p.captions.telegram
  return (typeof own === 'string' && own.trim() ? own : p.body).trim()
}

export async function publishToTelegram(p: SocialPost): Promise<{ id: string; link: string | null }> {
  const chat_id = channel()
  const text = telegramText(p)
  const media = p.media[0]
  const poll = readPoll(p)
  let firstId: number | null = null

  if (media) {
    const caption = text.length <= CAPTION_LIMIT ? text : ''
    const sent =
      media.type === 'photo'
        ? await tg<{ message_id: number }>('sendPhoto', { chat_id, photo: media.url, ...(caption ? { caption } : {}) })
        : await tg<{ message_id: number }>('sendVideo', { chat_id, video: media.url, supports_streaming: true, ...(caption ? { caption } : {}) })
    firstId = sent.message_id
    if (text && !caption) await tg('sendMessage', { chat_id, text: text.slice(0, 4000), link_preview_options: { is_disabled: true } })
  } else if (text) {
    const sent = await tg<{ message_id: number }>('sendMessage', { chat_id, text: text.slice(0, 4000), link_preview_options: { is_disabled: true } })
    firstId = sent.message_id
  }

  if (poll) {
    const sent = await tg<{ message_id: number }>('sendPoll', {
      chat_id,
      question: poll.question.slice(0, 300),
      options: poll.options.slice(0, 10).map((o) => ({ text: o.slice(0, 100) })),
      is_anonymous: true,
      type: poll.type,
      ...(poll.type === 'quiz' ? { correct_option_id: poll.correct ?? 0, ...(poll.explanation ? { explanation: poll.explanation.slice(0, 200) } : {}) } : {}),
    })
    firstId ??= sent.message_id
  }

  if (firstId == null) throw new Error('telegram channel: the post has no text, picture or poll')
  const handle = chat_id.replace(/^@/, '')
  return { id: String(firstId), link: /^[A-Za-z0-9_]+$/.test(handle) ? `https://t.me/${handle}/${firstId}` : null }
}
