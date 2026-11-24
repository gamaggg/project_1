import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/cronAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import {
  DECIDE_KEYBOARD,
  PREVIEW_LEAD_MIN,
  WEBHOOK_URL,
  botConfigured,
  escapeHtml,
  ownerChatId,
  platformsText,
  previewHtml,
  publishedCaptions,
  readPost,
  sendMedia,
  tg,
  type SocialPost,
} from '@/lib/socialBot'
import { publishToThreads, threadsConfigured } from '@/lib/threadsPublish'

// Called every 5 minutes by the social-bot-tick cron job (only when there is
// work, and once an hour to check the webhook). In order:
//   1. the bot's webhook points at /api/social-bot/webhook (set it if not);
//   2. a post whose time came without «Принять» is marked expired — it does not go out;
//   3. an accepted post whose time came: «Пора выкладывать» with the files and the
//      text to copy (until a platform publishes by itself, the owner posts by hand);
//   4. previews for posts due within the hour.
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

const BATCH = 10

async function handleGET(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!botConfigured()) return NextResponse.json({ skipped: 'SOCIAL_BOT_TOKEN or SOCIAL_BOT_WEBHOOK_SECRET not set' })

  const admin = createAdminClient()
  const report = { webhook: 'ok', expired: 0, reminded: 0, published: 0, previews: 0, errors: [] as string[] }

  const info = await tg<{ url?: string }>('getWebhookInfo', {})
  if (info.url !== WEBHOOK_URL) {
    await tg('setWebhook', {
      url: WEBHOOK_URL,
      secret_token: process.env.SOCIAL_BOT_WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
    })
    report.webhook = 'set'
  }

  const chatId = await ownerChatId(admin)
  if (!chatId) return NextResponse.json({ ...report, skipped: 'no owner telegram' })
  const now = new Date()

  // 2. Time is up without a decision.
  const { data: late } = await admin
    .from('social_posts')
    .select('*')
    .in('status', ['draft', 'sent'])
    .lte('scheduled_at', now.toISOString())
    .limit(BATCH)
  for (const row of late ?? []) {
    const p = readPost(row)
    const { error } = await admin.from('social_posts').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', p.id).in('status', ['draft', 'sent'])
    if (error) {
      report.errors.push(`expire #${p.id}: ${error.message}`)
      continue
    }
    report.expired++
    try {
      if (p.tg_message_id) {
        await tg('editMessageText', {
          chat_id: chatId,
          message_id: p.tg_message_id,
          text: previewHtml(p, '⏰ <b>Время вышло без ответа, пост не вышел.</b>'),
          parse_mode: 'HTML',
        })
      } else {
        await tg('sendMessage', { chat_id: chatId, text: `⏰ Пост #${p.id} не успел уйти на согласование, время прошло. Он не вышел.` })
      }
    } catch (err) {
      report.errors.push(`expire msg #${p.id}: ${err instanceof Error ? err.message : err}`)
    }
  }

  // 3. Accepted and due: time to post by hand.
  const { data: due } = await admin
    .from('social_posts')
    .select('*')
    .eq('status', 'approved')
    .lte('scheduled_at', now.toISOString())
    .limit(BATCH)
  for (const row of due ?? []) {
    const p = readPost(row)
    try {
      // Threads goes out by itself; the other platforms are still posted by hand.
      let manual = p
      if (p.platforms.includes('threads') && threadsConfigured()) {
        let link = typeof p.captions._threads_link === 'string' ? p.captions._threads_link : null
        if (!p.captions._threads_id) {
          try {
            const done = await publishToThreads(p)
            link = done.link
            await admin
              .from('social_posts')
              .update({ captions: { ...p.captions, _threads_id: done.id, _threads_link: done.link ?? '' }, updated_at: new Date().toISOString() })
              .eq('id', p.id)
            report.published++
            await tg('sendMessage', { chat_id: chatId, text: `✅ #${p.id} вышел в Threads.${link ? `\n${link}` : ''}`, link_preview_options: { is_disabled: true } })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            report.errors.push(`threads #${p.id}: ${msg}`)
            await tg('sendMessage', { chat_id: chatId, text: `⚠️ #${p.id} не вышел в Threads сам: ${msg.slice(0, 300)}\nВыложи его в Threads вручную.` }).catch(() => {})
          }
        }
        if (p.captions._threads_id || link) manual = { ...p, platforms: p.platforms.filter((x) => x !== 'threads') }
      }
      if (manual.platforms.length === 0) {
        await admin.from('social_posts').update({ status: 'published', published_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() }).eq('id', p.id)
        continue
      }
      await remind(chatId, manual)
      await admin.from('social_posts').update({ status: 'reminded', error: null, updated_at: new Date().toISOString() }).eq('id', p.id)
      report.reminded++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      report.errors.push(`remind #${p.id}: ${msg}`)
      await admin.from('social_posts').update({ error: msg.slice(0, 500) }).eq('id', p.id)
    }
  }

  // 4. Previews for the next hour.
  const { data: soon } = await admin
    .from('social_posts')
    .select('*')
    .eq('status', 'draft')
    .gt('scheduled_at', now.toISOString())
    .lte('scheduled_at', new Date(now.getTime() + PREVIEW_LEAD_MIN * 60_000).toISOString())
    .order('scheduled_at')
    .limit(BATCH)
  for (const row of soon ?? []) {
    const p = readPost(row)
    try {
      const mediaNote = await sendMedia(chatId, p)
      const text = previewHtml(p) + (mediaNote ? `\n\n${escapeHtml(mediaNote)}` : '')
      const msg = await tg<{ message_id: number }>('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: DECIDE_KEYBOARD(p.id),
      })
      await admin
        .from('social_posts')
        .update({ status: 'sent', tg_message_id: msg.message_id, preview_sent_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() })
        .eq('id', p.id)
        .eq('status', 'draft')
      report.previews++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      report.errors.push(`preview #${p.id}: ${msg}`)
      await admin.from('social_posts').update({ error: msg.slice(0, 500) }).eq('id', p.id)
    }
  }

  return NextResponse.json(report)
}

// «Пора выкладывать»: the files again, then each platform's text in a block
// that copies with one tap, and «Выложил» to mark it done.
async function remind(chatId: number, p: SocialPost) {
  const mediaNote = await sendMedia(chatId, p)
  const texts: [string, string][] = [['Текст', p.body || '(без текста)']]
  for (const [platform, text] of publishedCaptions(p)) if (p.platforms.includes(platform)) texts.push([`Для ${platform}`, text])
  // One message per text, each cut to Telegram's limit, so a long text never breaks the markup.
  for (const [label, text] of texts) {
    await tg('sendMessage', { chat_id: chatId, text: `<b>${escapeHtml(label)}:</b>\n<pre>${escapeHtml(text.slice(0, 3800))}</pre>`, parse_mode: 'HTML' })
  }
  const head = [`⏰ <b>Пора выкладывать #${p.id}</b>`, `📍 ${escapeHtml(platformsText(p))}`, 'Текст выше: нажми на блок, и он скопируется.']
  if (mediaNote) head.push('', escapeHtml(mediaNote))
  await tg('sendMessage', {
    chat_id: chatId,
    text: head.join('\n'),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: '✅ Выложил', callback_data: `sp:done:${p.id}` }]] },
  })
}

export const GET = withErrorReport('social-bot/tick', handleGET)
