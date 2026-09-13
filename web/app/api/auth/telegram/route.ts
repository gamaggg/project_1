import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTelegramInitData } from '@/lib/telegram/verifyInitData'

// Bridges a Telegram Mini App session into Supabase Auth. Supabase has no
// native "Sign in with Telegram" provider, so this mints a magic-link token
// server-side (via the admin API, using the SERVICE ROLE key — never exposed
// to the client) and hands it back for the client to redeem with
// `supabase.auth.verifyOtp(...)`, the same primitive OtpCodeStep already
// uses for email codes. No email is ever actually sent — generateLink alone
// creates the token, nothing dispatches it.
function telegramEmail(telegramId: number) {
  return `tg_${telegramId}@telegram.catchrange.com`
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const { initData } = await request.json()
  if (typeof initData !== 'string') return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const tgUser = verifyTelegramInitData(initData, botToken)
  if (!tgUser) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  const admin = createAdminClient()
  const email = telegramEmail(tgUser.id)

  const { data: existing } = await admin.from('profiles').select('id').eq('telegram_id', tgUser.id).maybeSingle()

  if (!existing) {
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || `tg${tgUser.id}`
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: displayName, telegram_username: tgUser.username ?? null },
    })
    if (createError || !created.user) return NextResponse.json({ error: 'could not create account' }, { status: 500 })
    // handle_new_user() just inserted the profiles row (see the trigger) — attach the telegram_id to it.
    const { error: linkError } = await admin.from('profiles').update({ telegram_id: tgUser.id }).eq('id', created.user.id)
    if (linkError) return NextResponse.json({ error: 'could not link account' }, { status: 500 })
  }

  const { data: linkData, error: linkGenError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkGenError || !linkData.properties) return NextResponse.json({ error: 'could not sign in' }, { status: 500 })

  return NextResponse.json({ email, token: linkData.properties.email_otp })
}
