import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { record, withErrorReport } from '@/lib/serverErrors'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const CITY: Record<string, string> = { batumi: 'Батуми', moscow: 'Москва и область' }
const PLAN: Record<string, string> = { start: 'Старт', partner: 'Партнёр' }
const LANGS = ['ru', 'en', 'ka']

// A person at one address may send a few in an hour; the whole page, a few dozen. More is somebody's script.
const PER_ADDRESS_HOUR = 5
const PER_PAGE_HOUR = 60

// partner_leads (supabase-drafts/partner-leads-02-11) isn't in the generated lib/types.ts, hence the narrow cast.
type LeadRow = { city: string; lang: string; name: string; contact: string; interest: string[]; comment: string | null; ip_hash: string | null }
type Result = { data: { id: number } | null; count: number | null; error: { message: string } | null }
type Query = PromiseLike<Result> & {
  select: (cols: string, opts?: { count: 'exact'; head: true }) => Query
  insert: (row: LeadRow) => Query
  update: (values: { notified_at: string }) => Query
  gte: (col: string, value: string) => Query
  eq: (col: string, value: string | number) => Query
  single: () => Query
}
type Leads = { from: (table: 'partner_leads') => Query }

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

// The form on /partners/*: saves the request and forwards it to every super admin's Telegram. The request is saved first, so it
// is not lost if Telegram does not answer; then notified_at stays empty and an «api:partner-lead» error is recorded.
async function handlePOST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  // A field a person never sees: a script fills everything, a person leaves it empty.
  if (clean(body.website, 50)) return NextResponse.json({ ok: true })

  const city = clean(body.city, 20)
  const lang = clean(body.lang, 5)
  const name = clean(body.name, 120)
  const contact = clean(body.contact, 160)
  const comment = clean(body.comment, 1000)
  const interest = Array.isArray(body.interest) ? [...new Set(body.interest.filter((x): x is string => typeof x === 'string' && x in PLAN))] : []
  if (!(city in CITY) || !LANGS.includes(lang) || !name || !contact) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  // The day goes into the hash: the same address cannot be followed from one day to the next.
  const ipHash = createHash('sha256').update(`${ip}|${new Date().toISOString().slice(0, 10)}`).digest('hex').slice(0, 32)

  const db = createAdminClient() as unknown as Leads
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const [{ count: fromAddress }, { count: fromPage }] = await Promise.all([
    db.from('partner_leads').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo).eq('ip_hash', ipHash),
    db.from('partner_leads').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo),
  ])
  if ((fromAddress ?? 0) >= PER_ADDRESS_HOUR || (fromPage ?? 0) >= PER_PAGE_HOUR) return NextResponse.json({ error: 'too many' }, { status: 429 })

  const { data: lead, error } = await db.from('partner_leads').insert({ city, lang, name, contact, interest, comment: comment || null, ip_hash: ipHash }).select('id').single()
  if (error || !lead) return NextResponse.json({ error: 'not saved' }, { status: 500 })

  // To every super admin who has Telegram linked.
  const admin = createAdminClient()
  const { data: supers } = await admin.from('profiles').select('telegram_id').eq('is_super_admin', true).not('telegram_id', 'is', null)
  const text = [
    `🆕 Заявка со страницы для бизнеса #${lead.id}`,
    `Город: ${CITY[city]} (${lang})`,
    `Название: ${name}`,
    `Контакт: ${contact}`,
    interest.length ? `Интересует: ${interest.map((p) => PLAN[p]).join(', ')}` : null,
    comment ? `Комментарий: ${comment}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  // A Telegram name in the contact field becomes a button that opens a chat with them.
  const handle = contact.match(/^(?:https?:\/\/)?(?:t\.me\/)?@?([A-Za-z][A-Za-z0-9_]{3,31})$/)?.[1]
  const reply_markup = handle ? { inline_keyboard: [[{ text: `Написать @${handle}`, url: `https://t.me/${handle}` }]] } : undefined

  let sent = 0
  for (const a of supers ?? []) {
    try {
      const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: a.telegram_id, text, reply_markup, disable_web_page_preview: true }),
      })
      if (res.ok) sent += 1
    } catch {}
  }
  if (sent) await db.from('partner_leads').update({ notified_at: new Date().toISOString() }).eq('id', lead.id)
  else await record('partner-lead', `Заявка #${lead.id} сохранена, но в Telegram не ушла`)

  return NextResponse.json({ ok: true })
}

export const POST = withErrorReport('partner-lead', handlePOST)
