import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import { escapeHtml, ownerChatId, tg } from '@/lib/socialBot'
import { connectWithCode, ticketValid, tiktokConfigured } from '@/lib/tiktokPublish'

// TikTok sends the owner back here after the consent screen (the Redirect URI of
// the app «RANGE»). The state must be one the bot's link produced, so nobody else
// can attach an account. The page says who is connected; the bot tells the owner too.
function page(title: string, text: string, status = 200) {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — RANGE</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.4rem">${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p><p><a href="https://catchrange.com">catchrange.com</a></p></body></html>`
  return new NextResponse(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } })
}

async function handleGET(req: Request) {
  const url = new URL(req.url)
  if (!tiktokConfigured()) return page('TikTok is not set up', 'The app keys are missing.', 503)
  if (!ticketValid(url.searchParams.get('state'))) return page('Link expired', 'Send /tiktok to the bot again.', 403)
  const code = url.searchParams.get('code')
  if (!code) return page('TikTok was not connected', url.searchParams.get('error_description') ?? 'Access was not granted.', 400)
  try {
    const admin = createAdminClient()
    const name = await connectWithCode(admin, code)
    const chatId = await ownerChatId(admin)
    if (chatId) await tg('sendMessage', { chat_id: chatId, text: `✅ TikTok подключён: ${name}.` }).catch(() => {})
    return page('TikTok connected', `Account: ${name}. RANGE can now publish the posts you approve in the bot to this account.`)
  } catch (err) {
    return page('TikTok was not connected', err instanceof Error ? err.message : String(err), 500)
  }
}

export const GET = withErrorReport('social-bot/tiktok-callback', handleGET)
