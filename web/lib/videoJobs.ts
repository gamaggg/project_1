import { randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { escapeHtml, tg } from '@/lib/socialBot'
import type { createAdminClient } from '@/lib/supabase/admin'

// Reels from the owner's own videos. The owner sends a video to the social bot (@smm_range_bot); it is kept in the
// storage bucket social-videos and a row of video_jobs is made. The edit itself is done on the owner's Mac (tools/reels-lab,
// docs/10 Продукт/Монтаж роликов (Reels).md): the finished silent video is uploaded back, the row gets result_path and the
// caption and goes to 'ready'. The tick then sends the video to the owner with the caption and the buttons «Всё ок / Изменить».
// «Изменить» + a reply with what to change puts the job to 'changes' and the video is made again. The owner posts it himself.

type Admin = ReturnType<typeof createAdminClient>

export const VIDEO_BUCKET = 'social-videos'
const TG_FILE_LIMIT = 20 * 1024 * 1024 // what a bot may download from Telegram

export type IncomingVideo = { file_id: string; file_size?: number; mime_type?: string }

// A video, a video sent as a file, or an animation.
export function incomingVideo(msg: {
  video?: IncomingVideo
  animation?: IncomingVideo
  document?: IncomingVideo
}): IncomingVideo | null {
  if (msg.video) return msg.video
  if (msg.animation) return msg.animation
  if (msg.document?.mime_type?.startsWith('video/')) return msg.document
  return null
}

export function publicUrl(admin: Admin, path: string): string {
  return admin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function acceptVideo(admin: Admin, chatId: number, file: IncomingVideo, caption: string): Promise<void> {
  if ((file.file_size ?? 0) > TG_FILE_LIMIT) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Видео больше 20 МБ: Telegram не даёт боту скачать такой файл. Отправь его как «видео» (не как файл), тогда Telegram сам сожмёт, или сократи ролик до 30–40 секунд.',
    })
    return
  }
  try {
    const info = await tg<{ file_path?: string }>('getFile', { file_id: file.file_id })
    if (!info.file_path) throw new Error('Telegram did not give a file path')
    const res = await fetch(`https://api.telegram.org/file/bot${process.env.SOCIAL_BOT_TOKEN}/${info.file_path}`, { signal: AbortSignal.timeout(50_000) })
    if (!res.ok) throw new Error(`download HTTP ${res.status}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    const ext = info.file_path.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4'
    const path = `in/${randomUUID()}.${ext}`
    const up = await admin.storage.from(VIDEO_BUCKET).upload(path, bytes, { contentType: ext === 'mov' ? 'video/quicktime' : 'video/mp4' })
    if (up.error) throw new Error(`storage: ${up.error.message}`)
    const { data, error } = await admin
      .from('video_jobs')
      .insert({ chat_id: chatId, src_path: path, caption_in: caption.slice(0, 1000), token: randomBytes(18).toString('hex') })
      .select('id')
      .single()
    if (error) throw new Error(`job: ${error.message}`)
    await tg('sendMessage', {
      chat_id: chatId,
      text: `🎬 Принял видео #${data.id}${caption ? ` («${caption.slice(0, 80)}»)` : ''}.\nМонтирую без звука, с оболочкой RANGE, и пришлю сюда с описанием. Если Mac с монтажом выключен, ролик будет ждать.${caption ? '' : '\n\nПодсказка: в подписи к видео можно написать рыбу, вес и место, тогда описание получится точнее.'}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await tg('sendMessage', { chat_id: chatId, text: `⚠️ Видео не приняли: ${msg.slice(0, 300)}` }).catch(() => {})
  }
}

// The tick: finished videos go to the owner once (sent_at), with the caption in a block that copies with one tap.
export async function sendReadyJobs(admin: Admin, chatId: number): Promise<number> {
  const { data: jobs } = await admin.from('video_jobs').select('*').eq('status', 'ready').is('sent_at', null).order('id').limit(3)
  let sent = 0
  for (const j of jobs ?? []) {
    if (!j.result_path) continue
    try {
      await tg('sendVideo', { chat_id: chatId, video: publicUrl(admin, j.result_path), supports_streaming: true, caption: `🎬 Ролик #${j.id}: без звука, с оболочкой RANGE.` })
      const msg = await tg<{ message_id: number }>('sendMessage', {
        chat_id: chatId,
        text: `<b>Описание к ролику #${j.id}:</b>\n<pre>${escapeHtml((j.caption_out ?? '(без описания)').slice(0, 3800))}</pre>\nСкачай видео, вставь описание и выложи сам. Всё устраивает?`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '✅ Всё ок', callback_data: `vj:ok:${j.id}` }, { text: '✏️ Изменить', callback_data: `vj:edit:${j.id}` }]] },
      })
      await admin.from('video_jobs').update({ sent_at: new Date().toISOString(), bot_message_id: msg.message_id, updated_at: new Date().toISOString() }).eq('id', j.id)
      sent++
    } catch (err) {
      await admin.from('video_jobs').update({ error: (err instanceof Error ? err.message : String(err)).slice(0, 500), updated_at: new Date().toISOString() }).eq('id', j.id)
    }
  }
  return sent
}

// «✅ Всё ок» / «✏️ Изменить» under a finished video.
export async function onJobButton(admin: Admin, chatId: number, action: string, id: number, messageId?: number): Promise<string> {
  const { data: j } = await admin.from('video_jobs').select('id, status, src_path, result_path').eq('id', id).maybeSingle()
  if (!j) return 'Такого ролика нет'
  if (action === 'ok') {
    await admin.from('video_jobs').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id)
    // the owner has the file: the copies in the storage are not needed any more
    const paths = [j.src_path, j.result_path].filter((p): p is string => !!p)
    if (paths.length) await admin.storage.from(VIDEO_BUCKET).remove(paths).catch(() => {})
    if (messageId) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {})
    await tg('sendMessage', { chat_id: chatId, text: `🎉 Ролик #${id} закрыт. Файлы с сервера удалены.` })
    return 'Готово'
  }
  if (action === 'edit') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✏️ Что поменять в ролике #${id}? Ответь на это сообщение: про видео (где оболочка, что вырезать, другой кусок) или про описание.`,
      reply_markup: { force_reply: true, input_field_placeholder: 'Например: оболочка позже, описание короче' },
    })
    return 'Напиши, что поменять'
  }
  return 'Не понял кнопку'
}

// A reply to «Что поменять в ролике #N?» (or to the message with the buttons) is the wanted change.
export async function videoFeedbackFor(admin: Admin, replyTo: { message_id: number; text?: string }): Promise<number | null> {
  const byMessage = await admin.from('video_jobs').select('id').eq('bot_message_id', replyTo.message_id).maybeSingle()
  const id = byMessage.data?.id ?? Number(replyTo.text?.match(/ролике #(\d+)/)?.[1] ?? NaN)
  return Number.isFinite(id) ? id : null
}

export async function saveJobFeedback(admin: Admin, chatId: number, id: number, text: string): Promise<void> {
  const { data: j } = await admin.from('video_jobs').select('status, feedback').eq('id', id).maybeSingle()
  if (!j || j.status === 'done') {
    await tg('sendMessage', { chat_id: chatId, text: `Ролик #${id} уже закрыт или не найден.` })
    return
  }
  const feedback = [j.feedback, text].filter(Boolean).join('\n— ')
  await admin.from('video_jobs').update({ status: 'changes', feedback: feedback.slice(0, 3000), sent_at: null, updated_at: new Date().toISOString() }).eq('id', id)
  await tg('sendMessage', { chat_id: chatId, text: `Записал правку к ролику #${id}. Переделаю и пришлю новый вариант.` })
}

// The upload address for the finished video: the Mac asks for it with the job's own token.
export function tokenMatches(want: string, got: string | null): boolean {
  if (!got) return false
  const a = Buffer.from(want)
  const b = Buffer.from(got)
  return a.length === b.length && timingSafeEqual(a, b)
}
