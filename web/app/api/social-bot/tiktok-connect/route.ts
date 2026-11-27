import { NextResponse } from 'next/server'
import { authorizeUrl, makeTicket, ticketValid, tiktokConfigured } from '@/lib/tiktokPublish'
import { withErrorReport } from '@/lib/serverErrors'

// «Connect TikTok»: opened from the link the bot sends the owner on /tiktok (valid
// 15 minutes). Sends the browser on to TikTok's consent screen; the answer comes to
// /api/social-bot/tiktok-callback. Without a valid link nothing happens.
async function handleGET(req: Request) {
  const url = new URL(req.url)
  if (!tiktokConfigured()) return new NextResponse('TikTok is not set up yet.', { status: 503 })
  if (!ticketValid(url.searchParams.get('t'))) return new NextResponse('The link has expired. Send /tiktok to the bot again.', { status: 403 })
  return NextResponse.redirect(authorizeUrl(makeTicket()))
}

export const GET = withErrorReport('social-bot/tiktok-connect', handleGET)
