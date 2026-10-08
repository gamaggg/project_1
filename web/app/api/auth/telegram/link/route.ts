import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTelegramInitData } from '@/lib/telegram/verifyInitData'
import { TELEGRAM_EMAIL_DOMAIN, isEmptyTelegramAccount } from '@/lib/telegram/accounts'
import { withErrorReport } from '@/lib/serverErrors'

// Someone signed in to their own (email) account inside the Telegram Mini
// App: this attaches that Telegram to it, so the next launch signs them
// straight in (see ../route.ts) and the bot can reach them. Both sides are
// proven — the account by its session token, the Telegram by initData's
// signature — so no bot /start round trip is needed. If the Telegram sits
// on the empty account the Mini App once made by itself, it moves over;
// a Telegram tied to an account with real play, or an account already tied
// to a different Telegram, is left alone.
async function handlePOST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const { initData } = await request.json()
  if (!accessToken || typeof initData !== 'string') return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const tgUser = verifyTelegramInitData(initData, botToken)
  if (!tgUser) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  const admin = createAdminClient()
  const { data: auth } = await admin.auth.getUser(accessToken)
  const user = auth.user
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  // The Mini App's own account for this Telegram is already the linked one.
  if (user.email?.endsWith(TELEGRAM_EMAIL_DOMAIN)) return NextResponse.json({ status: 'telegram_account' })

  const { data: me } = await admin.from('profiles').select('telegram_id').eq('id', user.id).maybeSingle()
  if (!me) return NextResponse.json({ error: 'no profile' }, { status: 404 })
  if (me.telegram_id === tgUser.id) return NextResponse.json({ status: 'linked' })
  if (me.telegram_id !== null) return NextResponse.json({ status: 'linked_elsewhere' })

  const { data: taken } = await admin.from('profiles').select('id').eq('telegram_id', tgUser.id).neq('id', user.id).maybeSingle()
  if (taken) {
    if (!(await isEmptyTelegramAccount(admin, taken.id))) return NextResponse.json({ status: 'taken' })
    const { error } = await admin.from('profiles').update({ telegram_id: null, tg_notifications_enabled: false }).eq('id', taken.id)
    if (error) return NextResponse.json({ error: 'could not release' }, { status: 500 })
  }

  const { error } = await admin.from('profiles').update({ telegram_id: tgUser.id }).eq('id', user.id)
  if (error) {
    // Put a released link back, so the empty account still opens in the Mini App.
    if (taken) await admin.from('profiles').update({ telegram_id: tgUser.id }).eq('id', taken.id)
    return NextResponse.json({ error: 'could not link' }, { status: 500 })
  }
  return NextResponse.json({ status: 'linked', moved: !!taken })
}

export const POST = withErrorReport('auth/telegram/link', handlePOST)
