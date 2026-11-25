import { createAdminClient } from '@/lib/supabase/admin'

// Purchases for Telegram Stars (25.11.2026, supabase-drafts/economy-24-11/11): coins, keys (free secret box openings)
// and three sector skins sold only for Stars. The app asks for an order (stars_order_create, under the player), the
// server turns it into a Telegram invoice (currency XTR, no payment provider), Telegram asks the bot «may I?»
// (pre_checkout_query → stars_precheck) and then tells it the payment went through (successful_payment →
// stars_fulfill, once per order). The invoice payload is just the order id.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

export type StarsOrder = {
  order_id: string
  product_id: string
  kind: 'coins' | 'keys' | 'item'
  amount: number
  item_id: string | null
  item_name: string | null
  stars: number
}

// What the purchase is called on Telegram's payment sheet (title ≤ 32, description ≤ 255 characters).
function invoiceText(o: StarsOrder): { title: string; description: string } {
  if (o.kind === 'coins') {
    const n = o.amount.toLocaleString('ru-RU')
    return { title: `${n} монет`, description: `${n} монет RANGE — сразу на счёт в игре.` }
  }
  if (o.kind === 'keys') {
    const word = o.amount === 1 ? 'ключ' : o.amount < 5 ? 'ключа' : 'ключей'
    return {
      title: `${o.amount} ${word}`,
      description: `${o.amount} ${word} RANGE: каждый открывает секретный бокс в магазине бесплатно.`,
    }
  }
  return {
    title: `Скин «${o.item_name ?? 'сектора'}»`.slice(0, 32),
    description: `Скин сектора «${o.item_name ?? ''}» в RANGE. Только за Звёзды: за монеты и в боксе его нет.`,
  }
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json().catch(() => null)) as { ok: boolean; result?: unknown; description?: string } | null
}

// An invoice link for an order: Telegram shows it over the Mini App (WebApp.openInvoice).
export async function createStarsInvoice(order: StarsOrder): Promise<string> {
  const { title, description } = invoiceText(order)
  const r = await tg('createInvoiceLink', {
    title,
    description,
    payload: order.order_id,
    // Stars need no payment provider: an empty token and the XTR currency, one price line.
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: title, amount: order.stars }],
  })
  if (!r?.ok || typeof r.result !== 'string') throw new Error(`createInvoiceLink: ${r?.description ?? 'no answer'}`)
  return r.result
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The player's reason when Telegram is told «no» (shown on the payment sheet).
const PRECHECK_TEXT: Record<string, string> = {
  order: 'Этот счёт уже не действует. Открой покупку в игре заново.',
  amount: 'Цена поменялась. Открой покупку в игре заново.',
  product: 'Этого товара больше нет в продаже.',
  blocked: 'Покупки для этого аккаунта недоступны.',
  owned: 'Этот скин у тебя уже есть.',
}

type PreCheckout = { id: string; currency: string; total_amount: number; invoice_payload: string }

// Telegram asks before taking the Stars; it must hear back within 10 seconds.
export async function answerStarsPreCheckout(q: PreCheckout) {
  let verdict = 'order'
  if (q.currency === 'XTR' && UUID.test(q.invoice_payload)) {
    const { data, error } = await (createAdminClient().rpc as unknown as Rpc)('stars_precheck', { p_order: q.invoice_payload, p_amount: q.total_amount })
    verdict = error ? 'error' : String(data)
  }
  const ok = verdict === 'ok'
  await tg('answerPreCheckoutQuery', {
    pre_checkout_query_id: q.id,
    ok,
    ...(ok ? {} : { error_message: PRECHECK_TEXT[verdict] ?? 'Не получилось проверить покупку. Попробуй ещё раз чуть позже.' }),
  })
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

type SuccessfulPayment = {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
  provider_payment_charge_id?: string
}

// The payment went through: give the purchase (once — a repeat of the same update finds the order paid) and say so in
// the chat. A database failure throws, so the webhook answers 500 and Telegram sends the update again.
export async function fulfillStarsPayment(chatId: number, payerId: number | undefined, p: SuccessfulPayment) {
  if (p.currency !== 'XTR' || !UUID.test(p.invoice_payload)) return
  const { data, error } = await (createAdminClient().rpc as unknown as Rpc)('stars_fulfill', {
    p_order: p.invoice_payload,
    p_amount: p.total_amount,
    p_charge_id: p.telegram_payment_charge_id,
    p_provider_charge_id: p.provider_payment_charge_id ?? null,
    p_payer: payerId ?? null,
  })
  if (error) throw new Error(`stars_fulfill: ${error.message}`)
  const r = data as { already: boolean; kind: string; amount: number; item_id: string | null }
  if (r.already) return
  const what =
    r.kind === 'coins'
      ? `${r.amount.toLocaleString('ru-RU')} монет уже на счёте`
      : r.kind === 'keys'
        ? `Ключей: ${r.amount}. Секретный бокс в магазине откроется бесплатно`
        : 'Скин уже в инвентаре — надень его в магазине'
  await tg('sendMessage', { chat_id: chatId, text: `⭐ Спасибо за покупку! ${what}.` })
}
