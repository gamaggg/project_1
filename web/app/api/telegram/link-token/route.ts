import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

// The bot's @username never changes at runtime, and there's no env var
// holding it — asking Telegram once per server instance keeps it from
// drifting out of sync with whatever bot the token actually belongs to.
let cachedBotUsername: string | null = null

async function getBotUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
  if (!res.ok) return null
  const body = await res.json()
  cachedBotUsername = body?.result?.username ?? null
  return cachedBotUsername
}

// Hands the signed-in user a one-tap link that connects their Telegram to
// this account. The token is minted by create_telegram_link_token under the
// caller's own session, so a person can only ever link their own account.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [{ data: token, error }, botUsername] = await Promise.all([
    supabase.rpc('create_telegram_link_token'),
    getBotUsername(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!botUsername) return NextResponse.json({ error: 'bot unavailable' }, { status: 502 })

  return NextResponse.json({ url: `https://t.me/${botUsername}?start=link_${token}` })
}
