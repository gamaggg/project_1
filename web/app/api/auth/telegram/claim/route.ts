import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTelegramInitData } from '@/lib/telegram/verifyInitData'
import { TELEGRAM_EMAIL_DOMAIN, isEmptyTelegramAccount } from '@/lib/telegram/accounts'
import { isLinkToken } from '@/lib/telegram/startParamCodec'
import { withErrorReport } from '@/lib/serverErrors'

// «Купить в Telegram», the Telegram side (26.11.2026; the link comes from app/api/telegram/buy-link). The Mini App was
// opened with ?tglink=<key>: the key (telegram_link_tokens, one-time, 15 minutes, minted under the account's own
// session on the website) proves the account, the signed initData proves this Telegram. So this Telegram is tied to that
// account and the Mini App is signed in to it, even if the person never opened RANGE in Telegram before.
//
// When this Telegram already belongs to another account:
//   · an empty one the Mini App made by itself (no catches, no clan) lets go of it at once, as in ../link;
//   · one with real play is not touched without the person's word: the answer is `conflict` with both accounts, and the
//     app asks. `decision: 'move'` then moves this Telegram to the account from the website (the other one is kept, only
//     untied; if it had no email it can no longer be entered — the app says so before asking); `decision: 'stay'` keeps
//     everything as it is and only spends the key.
// The two accounts' play can't be merged.
type Decision = 'move' | 'stay' | undefined

async function handlePOST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const { initData, token, decision } = (await request.json().catch(() => ({}))) as { initData?: unknown; token?: unknown; decision?: Decision }
  if (typeof initData !== 'string' || typeof token !== 'string' || !isLinkToken(token)) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const tgUser = verifyTelegramInitData(initData, botToken)
  if (!tgUser) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  const admin = createAdminClient()
  const { data: row } = await admin.from('telegram_link_tokens').select('user_id, expires_at, used_at').eq('token', token).maybeSingle()
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return NextResponse.json({ status: 'expired' })
  const spend = () => admin.from('telegram_link_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  if (decision === 'stay') {
    await spend()
    return NextResponse.json({ status: 'stayed' })
  }

  const accountId = row.user_id
  const { data: taken } = await admin.from('profiles').select('id, display_name').eq('telegram_id', tgUser.id).neq('id', accountId).maybeSingle()
  if (taken && decision !== 'move' && !(await isEmptyTelegramAccount(admin, taken.id))) {
    const [{ data: mine }, { data: other }, { data: otherAuth }] = await Promise.all([
      admin.from('profiles').select('display_name').eq('id', accountId).maybeSingle(),
      admin.from('profiles_with_stats').select('catches_count, territories_count').eq('id', taken.id).maybeSingle(),
      admin.auth.admin.getUserById(taken.id),
    ])
    return NextResponse.json({
      status: 'conflict',
      main: { name: mine?.display_name ?? '' },
      other: {
        name: taken.display_name ?? '',
        catches: other?.catches_count ?? 0,
        sectors: other?.territories_count ?? 0,
        // An account with a real email can still be entered by email once untied from this Telegram.
        hasEmail: !!otherAuth.user?.email && !otherAuth.user.email.endsWith(TELEGRAM_EMAIL_DOMAIN),
      },
    })
  }

  if (taken) {
    const { error } = await admin.from('profiles').update({ telegram_id: null, tg_notifications_enabled: false }).eq('id', taken.id)
    if (error) return NextResponse.json({ error: 'could not release' }, { status: 500 })
  }
  // The account may have been tied to another Telegram before: this one, where the person is now, takes its place.
  const { error: linkError } = await admin.from('profiles').update({ telegram_id: tgUser.id }).eq('id', accountId)
  if (linkError) {
    // Put a released link back, so the other account still opens in the Mini App.
    if (taken) await admin.from('profiles').update({ telegram_id: tgUser.id }).eq('id', taken.id)
    return NextResponse.json({ error: 'could not link' }, { status: 500 })
  }
  await spend()

  // The same sign-in as ../route.ts: a magic-link code for the account's own address, redeemed by the app.
  const { data: owner } = await admin.auth.admin.getUserById(accountId)
  const email = owner.user?.email
  if (!email) return NextResponse.json({ error: 'no email' }, { status: 500 })
  const { data: linkData, error: genError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (genError || !linkData.properties) return NextResponse.json({ error: `could not sign in: ${genError?.message ?? 'no link'}` }, { status: 500 })
  return NextResponse.json({ status: 'ok', email, token: linkData.properties.email_otp, moved: !!taken })
}

export const POST = withErrorReport('auth/telegram/claim', handlePOST)
