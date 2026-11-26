import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorReport } from '@/lib/serverErrors'
import { getBotUsername } from '@/lib/telegram/botUsername'
import { PRODUCT_ID, buyQuery, buyStartPayload, encodeStartParam } from '@/lib/telegram/startParamCodec'

// «Купить в Telegram» (26.11.2026): Stars are paid only inside Telegram, so on the website and in the installed app the
// buy button hands out a link that opens RANGE in Telegram at the same product, signed in to THIS account even if the
// person has never opened RANGE in Telegram (app/api/auth/telegram/claim). The key is the same one-time, 15-minute
// token as «Подключить Telegram» (create_telegram_link_token, minted under the caller's own session).
// With a Main Mini App link (NEXT_PUBLIC_TG_APP_LINK) the link opens the app straight away; without it, it goes through
// the bot's /start, which answers with a button into the app (app/api/telegram/webhook).
async function handlePOST(request: Request) {
  const { productId } = (await request.json().catch(() => ({}))) as { productId?: unknown }
  if (typeof productId !== 'string' || !PRODUCT_ID.test(productId)) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // The product itself is checked in the app it opens (a product it does not know just opens the Shop).
  const [{ data: token, error }, botUsername] = await Promise.all([supabase.rpc('create_telegram_link_token'), getBotUsername()])
  if (error || typeof token !== 'string') return NextResponse.json({ error: error?.message ?? 'no token' }, { status: 500 })

  const appLink = process.env.NEXT_PUBLIC_TG_APP_LINK
  if (appLink) return NextResponse.json({ url: `${appLink}?startapp=${encodeStartParam(buyQuery(token, productId))}` })
  const payload = buyStartPayload(token, productId)
  if (!botUsername || !payload) return NextResponse.json({ error: 'bot unavailable' }, { status: 502 })
  return NextResponse.json({ url: `https://t.me/${botUsername}?start=${payload}` })
}

export const POST = withErrorReport('telegram/buy-link', handlePOST)
