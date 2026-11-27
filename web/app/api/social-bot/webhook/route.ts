import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import { connectLink, tiktokConfigured } from '@/lib/tiktokPublish'
import { acceptVideo, incomingVideo, onJobButton, saveJobFeedback, videoFeedbackFor } from '@/lib/videoJobs'
import { escapeHtml, isTelegramUpdate, ownerChatId, previewHtml, readPost, tg, whenText } from '@/lib/socialBot'

// Updates of the social-media approval bot (lib/socialBot.ts). Only the owner
// (the super admin's Telegram) is listened to:
//   · «Принять» / «Отменить» under a preview — decides the post;
//   · «Изменить», or a reply to the preview — the text of the reply is saved as
//     the wanted change (feedback) and the post waits for a new version;
//   · «Выложил» under «Пора выкладывать» — the post is marked published.
// Anyone else gets one line saying the bot is not for players.

type FileInfo = { file_id: string; file_size?: number; mime_type?: string }
type Msg = { message_id: number; chat: { id: number }; from?: { id: number }; text?: string; caption?: string; video?: FileInfo; animation?: FileInfo; document?: FileInfo; reply_to_message?: { message_id: number; text?: string } }

// A video takes a while to download and store: answer Telegram at once, finish afterwards.
export const maxDuration = 60
type Callback = { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: { id: number } } }

const nowIso = () => new Date().toISOString()

async function handlePOST(req: Request) {
  if (!isTelegramUpdate(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const update = (await req.json()) as { message?: Msg; callback_query?: Callback }
  const admin = createAdminClient()
  const owner = await ownerChatId(admin)

  const cb = update.callback_query
  if (cb) {
    if (cb.from.id !== owner) {
      await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Это служебный бот RANGE.' }).catch(() => {})
      return NextResponse.json({ ok: true })
    }
    await onButton(admin, owner, cb)
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  const vid = msg ? incomingVideo(msg) : null
  if (msg && vid && msg.from) {
    if (msg.from.id !== owner) {
      await tg('sendMessage', { chat_id: msg.chat.id, text: 'Это служебный бот RANGE. Сама игра: @catchrangebot' }).catch(() => {})
      return NextResponse.json({ ok: true })
    }
    after(() => acceptVideo(admin, owner, vid, msg.caption ?? ''))
    return NextResponse.json({ ok: true })
  }
  if (msg?.text && msg.from) {
    if (msg.from.id !== owner) {
      await tg('sendMessage', { chat_id: msg.chat.id, text: 'Это служебный бот RANGE. Сама игра: @catchrangebot' }).catch(() => {})
      return NextResponse.json({ ok: true })
    }
    await onOwnerText(admin, owner, msg)
  }
  return NextResponse.json({ ok: true })
}

async function onButton(admin: ReturnType<typeof createAdminClient>, chatId: number, cb: Callback) {
  const parts = (cb.data ?? '').split(':')
  if (parts[0] === 'vj') {
    const text = await onJobButton(admin, chatId, parts[1] ?? '', Number(parts[2]), cb.message?.message_id)
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text }).catch(() => {})
    return
  }
  const [, action, idText] = parts
  const id = Number(idText)
  const answer = (text: string) => tg('answerCallbackQuery', { callback_query_id: cb.id, text }).catch(() => {})
  const { data: row } = await admin.from('social_posts').select('*').eq('id', id).maybeSingle()
  if (!row) return answer('Пост не найден')
  const p = readPost(row)

  if (action === 'done') {
    if (p.status !== 'reminded') return answer('Уже отмечен')
    await admin.from('social_posts').update({ status: 'published', published_at: nowIso(), updated_at: nowIso() }).eq('id', id)
    if (cb.message) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {})
    await tg('sendMessage', { chat_id: chatId, text: `🎉 #${id} отмечен как выложенный.` })
    return answer('Готово')
  }

  if (p.status !== 'sent') {
    const why: Record<string, string> = {
      approved: 'Уже принят',
      changes: 'Ждёт правку',
      cancelled: 'Уже отменён',
      expired: 'Время вышло, пост не вышел',
      reminded: 'Уже пора выкладывать',
      published: 'Уже вышел',
    }
    return answer(why[p.status] ?? 'Решение уже принято')
  }

  if (action === 'ok' || action === 'cancel') {
    const status = action === 'ok' ? 'approved' : 'cancelled'
    const { data: changed } = await admin
      .from('social_posts')
      .update({ status, decided_at: nowIso(), updated_at: nowIso() })
      .eq('id', id)
      .eq('status', 'sent')
      .select('id')
    if (!changed?.length) return answer('Решение уже принято')
    const tail = action === 'ok' ? `✅ <b>Принято.</b> Выйдет ${escapeHtml(whenText(p.scheduled_at))}.` : '❌ <b>Отменён.</b>'
    if (p.tg_message_id) await tg('editMessageText', { chat_id: chatId, message_id: p.tg_message_id, text: previewHtml(p, tail), parse_mode: 'HTML' }).catch(() => {})
    return answer(action === 'ok' ? 'Принято' : 'Отменён')
  }

  if (action === 'edit') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✏️ Что поменять в посте #${id}? Ответь на это сообщение.`,
      reply_markup: { force_reply: true, input_field_placeholder: 'Например: другая обложка, текст короче' },
    })
    return answer('Напиши, что поменять')
  }
  return answer('Не понял кнопку')
}

// A reply to a preview (or to «Что поменять в посте #N?») is the wanted change.
async function onOwnerText(admin: ReturnType<typeof createAdminClient>, chatId: number, msg: Msg) {
  const text = msg.text!.trim()
  if (text.startsWith('/start')) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Привет! Сюда за час до выхода будут приходить посты для соцсетей RANGE.\n\n✅ Принять: пост выйдет.\n✏️ Изменить: напиши, что поменять, пришлю новый вариант.\n❌ Отменить: пост не выйдет.\n\nБез «Принять» ничего не публикуется.\n\n🎬 Ролики: пришли сюда видео (как «видео», до 20 МБ), в подписи можно написать рыбу, вес и место. Я смонтирую без звука, с оболочкой RANGE, и верну с описанием и кнопками «Всё ок / Изменить». Выкладываешь сам.',
    })
    return
  }
  if (text.startsWith('/tiktok')) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: tiktokConfigured() ? `Ссылка, чтобы подключить TikTok (действует 15 минут):\n${connectLink()}` : 'TikTok ещё не настроен: в Vercel нет TIKTOK_CLIENT_KEY и TIKTOK_CLIENT_SECRET.',
      link_preview_options: { is_disabled: true },
    })
    return
  }
  const reply = msg.reply_to_message
  if (reply) {
    const jobId = await videoFeedbackFor(admin, reply)
    if (jobId) {
      await saveJobFeedback(admin, chatId, jobId, text)
      return
    }
  }
  let id: number | null = null
  if (reply) {
    const byMessage = await admin.from('social_posts').select('id').eq('tg_message_id', reply.message_id).maybeSingle()
    id = byMessage.data?.id ?? Number(reply.text?.match(/посте #(\d+)/)?.[1] ?? NaN)
  }
  if (!id || !Number.isFinite(id)) {
    await tg('sendMessage', { chat_id: chatId, text: 'Чтобы попросить правку, ответь (Reply) на превью поста или нажми под ним «Изменить».' })
    return
  }
  const { data: row } = await admin.from('social_posts').select('*').eq('id', id).maybeSingle()
  if (!row) return
  const p = readPost(row)
  if (!['sent', 'approved', 'changes'].includes(p.status)) {
    await tg('sendMessage', { chat_id: chatId, text: `Пост #${id} уже нельзя поменять: он ${p.status === 'published' || p.status === 'reminded' ? 'уже вышел' : 'не выйдет'}.` })
    return
  }
  const feedback = [p.feedback, text].filter(Boolean).join('\n— ')
  await admin.from('social_posts').update({ status: 'changes', feedback: feedback.slice(0, 4000), decided_at: nowIso(), updated_at: nowIso() }).eq('id', id)
  if (p.tg_message_id) {
    await tg('editMessageText', {
      chat_id: chatId,
      message_id: p.tg_message_id,
      text: previewHtml(p, `✏️ <b>Ждёт правку:</b> ${escapeHtml(text.slice(0, 300))}`),
      parse_mode: 'HTML',
    }).catch(() => {})
  }
  await tg('sendMessage', { chat_id: chatId, text: `Записал правку к посту #${id}. Переделаю и пришлю новый вариант.` })
}

export const POST = withErrorReport('social-bot/webhook', handlePOST)
