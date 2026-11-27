import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SocialPost } from '@/lib/socialBot'
import { SITE_URL } from '@/lib/site'
import type { createAdminClient } from '@/lib/supabase/admin'

// Publishing to the brand TikTok account through TikTok's official Login Kit and
// Content Posting API (Direct Post, file upload). The app «RANGE» is made on
// developers.tiktok.com; the owner puts its keys in Vercel: TIKTOK_CLIENT_KEY and
// TIKTOK_CLIENT_SECRET. The owner connects the account once: the bot's /tiktok
// command sends a link (valid 15 minutes) that goes through TikTok's consent
// screen to /api/social-bot/tiktok-callback; the refresh token is kept in the
// table social_tokens (service role only) and renewed on every use.
// Until TikTok approves the app, posts can only be private (SELF_ONLY); after the
// approval set TIKTOK_PRIVACY=PUBLIC_TO_EVERYONE in Vercel.
// Plan: docs/10 Продукт/Продвижение в соцсетях.md, docs/10 Продукт/Подача TikTok и YouTube на проверку.md

type Admin = ReturnType<typeof createAdminClient>

const API = 'https://open.tiktokapis.com/v2'
export const TIKTOK_REDIRECT_URI = `${SITE_URL}/api/social-bot/tiktok-callback`
const SCOPES = 'user.info.basic,video.publish,video.upload'
const TITLE_LIMIT = 2200
const TICKET_TTL_MS = 15 * 60_000

export function tiktokConfigured(): boolean {
  return !!process.env.TIKTOK_CLIENT_KEY && !!process.env.TIKTOK_CLIENT_SECRET
}

// A short-lived signed ticket: proves that the link was made by the bot for the owner
// (and, as «state», that the callback belongs to a connection the owner started).
function sign(part: string): string {
  return createHmac('sha256', process.env.SOCIAL_BOT_WEBHOOK_SECRET ?? '').update(`tiktok:${part}`).digest('base64url')
}

export function makeTicket(): string {
  const exp = String(Date.now() + TICKET_TTL_MS)
  return `${exp}.${sign(exp)}`
}

export function ticketValid(ticket: string | null): boolean {
  if (!ticket || !process.env.SOCIAL_BOT_WEBHOOK_SECRET) return false
  const [exp, sig] = ticket.split('.')
  if (!exp || !sig || !(Number(exp) > Date.now())) return false
  const want = Buffer.from(sign(exp))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}

export function connectLink(): string {
  return `${SITE_URL}/api/social-bot/tiktok-connect?t=${makeTicket()}`
}

export function authorizeUrl(state: string): string {
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY ?? '')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', TIKTOK_REDIRECT_URI)
  url.searchParams.set('state', state)
  return url.toString()
}

type TokenAnswer = {
  access_token?: string
  refresh_token?: string
  refresh_expires_in?: number
  open_id?: string
  error?: string
  error_description?: string
}

async function tokenCall(params: Record<string, string>): Promise<Required<Pick<TokenAnswer, 'access_token' | 'refresh_token'>> & { refreshExpiresIn: number }> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY ?? '', client_secret: process.env.TIKTOK_CLIENT_SECRET ?? '', ...params }),
    signal: AbortSignal.timeout(30_000),
  })
  const json = (await res.json().catch(() => ({}))) as TokenAnswer
  if (!res.ok || !json.access_token || !json.refresh_token) throw new Error(`tiktok token: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`)
  return { access_token: json.access_token, refresh_token: json.refresh_token, refreshExpiresIn: json.refresh_expires_in ?? 365 * 86400 }
}

async function saveRefresh(admin: Admin, refresh: string, expiresInSec: number) {
  const { error } = await admin
    .from('social_tokens')
    .upsert({ name: 'tiktok', token: refresh, expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(), refreshed_at: new Date().toISOString() })
  if (error) throw new Error(`tiktok token save: ${error.message}`)
}

// The consent screen sent the owner back with a code: exchange it and keep the token.
// Returns the account's display name for the «Connected» page.
export async function connectWithCode(admin: Admin, code: string): Promise<string> {
  const t = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: TIKTOK_REDIRECT_URI })
  await saveRefresh(admin, t.refresh_token, t.refreshExpiresIn)
  const res = await fetch(`${API}/user/info/?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(30_000) })
  const json = (await res.json().catch(() => ({}))) as { data?: { user?: { display_name?: string } } }
  return json.data?.user?.display_name ?? 'TikTok'
}

// A working access token (they live a day): made from the saved refresh token, which is renewed too.
async function accessToken(admin: Admin): Promise<string> {
  const { data: row } = await admin.from('social_tokens').select('token').eq('name', 'tiktok').maybeSingle()
  if (!row?.token) throw new Error('tiktok: the account is not connected (send /tiktok to the bot)')
  const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: row.token })
  if (t.refresh_token !== row.token) await saveRefresh(admin, t.refresh_token, t.refreshExpiresIn)
  return t.access_token
}

async function api<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } }
  if (!res.ok || (json.error?.code && json.error.code !== 'ok')) throw new Error(`tiktok ${path}: ${json.error?.message ?? `HTTP ${res.status}`}`)
  return json
}

export function tiktokTitle(p: SocialPost): string {
  const own = p.captions.tiktok
  const text = (typeof own === 'string' && own.trim() ? own : p.body).trim()
  return text.length > TITLE_LIMIT ? text.slice(0, TITLE_LIMIT - 1) + '…' : text
}

// Direct Post of one video (TikTok has no text posts; photos need a verified media
// domain and are not done). The file is downloaded here and uploaded in one piece.
export async function publishToTikTok(admin: Admin, p: SocialPost): Promise<{ id: string; link: string | null }> {
  const media = p.media[0]
  if (!media || media.type !== 'video') throw new Error('tiktok: the post has no video')
  const token = await accessToken(admin)

  const file = await fetch(media.url, { signal: AbortSignal.timeout(60_000) })
  if (!file.ok) throw new Error(`tiktok: cannot read the video (HTTP ${file.status})`)
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > 64 * 1024 * 1024) throw new Error('tiktok: the video is over 64 MB')

  const init = await api<{ data?: { publish_id?: string; upload_url?: string } }>('/post/publish/video/init/', token, {
    post_info: { title: tiktokTitle(p), privacy_level: process.env.TIKTOK_PRIVACY || 'SELF_ONLY' },
    source_info: { source: 'FILE_UPLOAD', video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 },
  })
  const { publish_id: id, upload_url: uploadUrl } = init.data ?? {}
  if (!id || !uploadUrl) throw new Error('tiktok: no upload address in the answer')

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length), 'Content-Range': `bytes 0-${bytes.length - 1}/${bytes.length}` },
    body: bytes,
    signal: AbortSignal.timeout(120_000),
  })
  if (!put.ok) throw new Error(`tiktok upload: HTTP ${put.status}`)

  // Processing takes a little; report the real status instead of assuming success.
  for (let i = 0; i < 12; i++) {
    const s = await api<{ data?: { status?: string; fail_reason?: string } }>('/post/publish/status/fetch/', token, { publish_id: id })
    const status = s.data?.status
    if (status === 'PUBLISH_COMPLETE') return { id, link: null }
    if (status === 'FAILED') throw new Error(`tiktok: ${s.data?.fail_reason ?? 'failed'}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  return { id, link: null }
}
