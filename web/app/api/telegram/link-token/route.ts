import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorReport } from '@/lib/serverErrors'
import { getBotUsername } from '@/lib/telegram/botUsername'

// Hands the signed-in user a one-tap link that connects their Telegram to
// this account. The token is minted by create_telegram_link_token under the
// caller's own session, so a person can only ever link their own account.
async function handlePOST() {
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

export const POST = withErrorReport('telegram/link-token', handlePOST)
