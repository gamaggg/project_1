import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import { translate, type TKey } from '@/lib/i18n/core'
import { partnerPdfFilename } from '@/lib/data/partnerPoints'
import { renderPartnerStatsPdf, type PdfStats } from '@/lib/server/partnerStatsPdf'

// «Скачать PDF» on a partner point's statistics (PartnerStatsView): the super admin's or the partner's own.
// Two steps, because inside Telegram a Mini App can save a file only by handing Telegram a plain link
// (WebApp.downloadFile), and that request carries no session:
// 1. POST with the session token: the server checks the player and answers with a link valid 10 minutes. The link
//    carries the request (point, period) and the session token, encrypted (AES-256-GCM, a key derived from the
//    server secret), so nobody can read or change it.
// 2. GET that link: the numbers are read AS THAT PLAYER (partner_point_stats lets in only the super admin and those
//    the point was shared with — the same rule as the screen), then the PDF is drawn (lib/server/partnerStatsPdf.ts).

const TICKET_TTL_MS = 10 * 60_000
const PERIODS: Record<string, string> = { '1': 'Сутки', '7': '7 дней', '30': '30 дней', all: 'Весь срок' }

type Ticket = { tk: string; p: number; f: string; t: string; per: string; e: number }

function key(): Buffer {
  return createHash('sha256').update(`partner-stats-pdf:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest()
}

function seal(t: Ticket): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([c.update(JSON.stringify(t), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')
}

function open(s: string): Ticket | null {
  try {
    const buf = Buffer.from(s, 'base64url')
    const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12))
    d.setAuthTag(buf.subarray(12, 28))
    const t = JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8')) as Ticket
    return t.e > Date.now() ? t : null
  } catch {
    return null
  }
}

async function handlePOST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: auth } = await createAdminClient().auth.getUser(token)
  if (!auth.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { pointId?: number; from?: string; to?: string; period?: string }
  const pointId = Number(body.pointId)
  if (!Number.isInteger(pointId) || pointId <= 0) return NextResponse.json({ error: 'bad_point' }, { status: 400 })
  if (!body.from || !body.to || Number.isNaN(Date.parse(body.from)) || Number.isNaN(Date.parse(body.to))) {
    return NextResponse.json({ error: 'bad_period' }, { status: 400 })
  }
  const per = body.period && body.period in PERIODS ? body.period : 'all'
  const ticket = seal({ tk: token, p: pointId, f: body.from, t: body.to, per, e: Date.now() + TICKET_TTL_MS })
  return NextResponse.json({ url: `/api/partner-stats-pdf?t=${ticket}` })
}

// Google Fonts hands plain TTF to an old user agent (as the story cards do); fetched once per server instance.
const fontCache = new Map<string, Promise<ArrayBuffer>>()
function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const k = `${family}:${weight}`
  let p = fontCache.get(k)
  if (!p) {
    p = fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, { headers: { 'User-Agent': 'Mozilla/4.0' } })
      .then((r) => r.text())
      .then((css) => {
        const url = /src: url\(([^)]+)\) format\('truetype'\)/.exec(css)?.[1]
        if (!url) throw new Error(`no ttf for ${family}`)
        return fetch(url).then((r) => r.arrayBuffer())
      })
    p.catch(() => fontCache.delete(k))
    fontCache.set(k, p)
  }
  return p
}

let logoCache: Promise<{ paths: string[]; viewBox: [number, number] }> | null = null
function logo(origin: string) {
  if (!logoCache) {
    logoCache = fetch(`${origin}/brand/logo_2.svg`)
      .then((r) => r.text())
      .then((svg) => {
        const vb = /viewBox="([^"]+)"/.exec(svg)?.[1].split(/[\s,]+/).map(Number) ?? [0, 0, 1611.65, 464.51]
        return { paths: [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]), viewBox: [vb[2], vb[3]] as [number, number] }
      })
    logoCache.catch(() => (logoCache = null))
  }
  return logoCache
}

async function handleGET(req: Request) {
  const url = new URL(req.url)
  const t = open(url.searchParams.get('t') ?? '')
  if (!t) return new Response('Ссылка устарела: нажмите «Скачать PDF» ещё раз.', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  // As the player: the function itself decides whether they may see this point.
  const asPlayer = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${t.tk}` } },
  }) as unknown as SupabaseClient
  const { data: stats, error } = await asPlayer.rpc('partner_point_stats', { p_point: t.p, p_from: t.f, p_to: t.t })
  if (error) {
    const msg = error.message ?? ''
    if (/not_authorized|JWT/i.test(msg)) return new Response('Нет доступа к статистике этой точки', { status: 403 })
    if (/not_found/.test(msg)) return new Response('Точка не найдена', { status: 404 })
    throw new Error(`partner_point_stats: ${msg}`)
  }

  type Row = { name: string; city: string; address: string | null; promo_code: string | null; promo_discount: string | null }
  const admin = createAdminClient() as unknown as SupabaseClient
  const { data: row } = (await admin.from('partner_points').select('name, city, address, promo_code, promo_discount').eq('id', t.p).maybeSingle()) as { data: Row | null }
  if (!row) return new Response('Точка не найдена', { status: 404 })

  const [regular, bold, black, display, lg] = await Promise.all([
    googleFont('Manrope', 500),
    googleFont('Manrope', 700),
    googleFont('Manrope', 800),
    googleFont('Oswald', 700),
    logo(url.origin),
  ])
  const pdf = await renderPartnerStatsPdf({
    point: {
      name: row.name,
      cityName: translate('ru', `city.${row.city}Name` as TKey),
      address: row.address,
      promoCode: row.promo_code,
      promoDiscount: row.promo_discount,
    },
    stats: stats as PdfStats,
    from: t.f,
    to: t.t,
    periodLabel: PERIODS[t.per] ?? PERIODS.all,
    fonts: { regular, bold, black, display },
    logoPaths: lg.paths,
    logoViewBox: lg.viewBox,
  })

  const day = new Intl.DateTimeFormat('en-CA', { timeZone: (stats as PdfStats).tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const filename = partnerPdfFilename(row.name, day)
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="range-stats-${t.p}-${day}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export const POST = withErrorReport('partner-stats-pdf', handlePOST)
export const GET = withErrorReport('partner-stats-pdf', handleGET)
