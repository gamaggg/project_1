import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorReport } from '@/lib/serverErrors'
import { createStarsInvoice, type StarsOrder } from '@/lib/telegram/stars'

// A purchase for Telegram Stars (lib/telegram/stars.ts): the order is made under the player's own session
// (stars_order_create checks the product, that a skin isn't owned yet and that Stars are open to them), then the
// bot turns it into an invoice link the Mini App opens with WebApp.openInvoice.
async function handlePOST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { product?: unknown; preset?: unknown } | null
  const product = typeof body?.product === 'string' ? body.product : ''
  if (!/^[a-z0-9_]{1,40}$/.test(product)) return NextResponse.json({ error: 'STARS:unknown' }, { status: 400 })

  // The live background's preset picked before buying (glKits.ts): a short word, or nothing (without one the call stays the one-argument form, so it also works before migration 13).
  const preset = typeof body?.preset === 'string' && /^[a-z0-9_]{1,24}$/.test(body.preset) ? body.preset : null

  const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc.call(supabase, 'stars_order_create', preset ? { p_product: product, p_preset: preset } : { p_product: product })
  if (error) {
    const code = /STARS:\w+/.exec(error.message)?.[0] ?? 'STARS:failed'
    return NextResponse.json({ error: code }, { status: 400 })
  }

  const url = await createStarsInvoice(data as StarsOrder)
  return NextResponse.json({ url })
}

export const POST = withErrorReport('stars/invoice', handlePOST)
