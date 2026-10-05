import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const CITY: Record<string, string> = { batumi: 'Батуми', moscow: 'Москва' }

// «Написать в поддержку» (supabase-drafts/support.sql): forwards a player's
// new request to every super admin's Telegram — the text, who wrote it and
// the screenshot, if any (a 1-hour signed link: the bucket is private). The
// admin answers by replying to that message in the bot (see the webhook), so
// each sent message is recorded against the request. Called by the app right
// after the request is saved, for the player's own request only; a second
// call for the same request does nothing.
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { ticketId } = (await req.json().catch(() => ({}))) as { ticketId?: number }
  if (!ticketId) return NextResponse.json({ error: 'ticketId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ticket } = await admin.from('support_tickets').select('id, user_id, body, photo_path, created_at').eq('id', ticketId).single()
  if (!ticket || ticket.user_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { count: already } = await admin.from('support_telegram_messages').select('ticket_id', { count: 'exact', head: true }).eq('ticket_id', ticketId)
  if (already) return NextResponse.json({ sent: 0, already: true })

  const [{ data: author }, { data: admins }] = await Promise.all([
    admin.from('profiles').select('display_name, public_id, city').eq('id', user.id).single(),
    admin.from('profiles').select('telegram_id').eq('is_super_admin', true).not('telegram_id', 'is', null),
  ])
  const who = [author?.display_name ?? 'Игрок', author?.public_id ? `ID ${author.public_id}` : null, CITY[author?.city ?? ''] ?? null].filter(Boolean).join(' · ')
  const head = `🆘 Обращение #${ticket.id}\nот ${who}`
  const foot = '↩️ Ответь на это сообщение, чтобы ответить игроку'
  let photoUrl: string | null = null
  if (ticket.photo_path) {
    const { data } = await admin.storage.from('support').createSignedUrl(ticket.photo_path, 3600)
    photoUrl = data?.signedUrl ?? null
  }

  let sent = 0
  for (const a of admins ?? []) {
    const chatId = a.telegram_id as number
    const ids: number[] = []
    const send = async (method: string, body: Record<string, unknown>) => {
      const res = await fetch(`${TELEGRAM_API}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (json?.result?.message_id) ids.push(json.result.message_id)
    }
    if (photoUrl) {
      // A photo caption holds 1024 characters — a longer request goes as its
      // own message right after; a reply to either one reaches the player.
      const caption = `${head}\n\n${ticket.body}\n\n${foot}`
      if (caption.length <= 1024) {
        await send('sendPhoto', { chat_id: chatId, photo: photoUrl, caption })
      } else {
        await send('sendPhoto', { chat_id: chatId, photo: photoUrl, caption: head })
        await send('sendMessage', { chat_id: chatId, text: `${ticket.body}\n\n${foot}` })
      }
    } else {
      await send('sendMessage', { chat_id: chatId, text: `${head}\n\n${ticket.body}\n\n${foot}` })
    }
    if (ids.length) {
      await admin.from('support_telegram_messages').insert(ids.map((message_id) => ({ chat_id: chatId, message_id, ticket_id: ticket.id })))
      sent++
    }
  }
  return NextResponse.json({ sent })
}
