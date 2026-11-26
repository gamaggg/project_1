import type { SocialPost } from '@/lib/socialBot'

// Publishing to the Facebook Page «RANGE CATCH» (texts in Georgian) through the
// Pages API. The token is a system-user token (no expiry) made in Meta Business
// Settings for the app «RANGE Posting» and entered by the owner in Vercel as
// FACEBOOK_ACCESS_TOKEN. FACEBOOK_PAGE_ID is the page's id (not a secret; the
// default is «RANGE CATCH»). From the system-user token we get the Page's own
// access token, which posts on its behalf.
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

const API = 'https://graph.facebook.com/v21.0'
const DEFAULT_PAGE_ID = '1392195013986425'

export function facebookConfigured(): boolean {
  return !!process.env.FACEBOOK_ACCESS_TOKEN
}

function pageId(): string {
  return process.env.FACEBOOK_PAGE_ID || DEFAULT_PAGE_ID
}

async function call<T>(path: string, params: Record<string, string>, token: string, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const url = new URL(`${API}${path}`)
  const body = new URLSearchParams({ ...params, access_token: token })
  if (method === 'GET') body.forEach((v, k) => url.searchParams.set(k, v))
  const res = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    body: method === 'POST' ? body : undefined,
    signal: AbortSignal.timeout(60_000),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok || json.error) throw new Error(`facebook ${path}: ${json.error?.message ?? `HTTP ${res.status}`}`)
  return json
}

// The text for the Page: its own (Georgian) caption if the post has one, else the common text.
export function facebookText(p: SocialPost): string {
  const own = p.captions.facebook
  return (typeof own === 'string' && own.trim() ? own : p.body).trim()
}

// Publishes a text post, or a post with one photo or one video. Returns the link.
export async function publishToFacebook(p: SocialPost): Promise<{ id: string; link: string | null }> {
  const id = pageId()
  const page = await call<{ access_token?: string }>(`/${id}`, { fields: 'access_token' }, process.env.FACEBOOK_ACCESS_TOKEN ?? '', 'GET')
  const token = page.access_token
  if (!token) throw new Error('facebook: no page access token (is the page assigned to the system user?)')

  const text = facebookText(p)
  const media = p.media[0]
  let res: { id?: string; post_id?: string }
  if (!media) res = await call(`/${id}/feed`, { message: text }, token)
  else if (media.type === 'photo') res = await call(`/${id}/photos`, { url: media.url, caption: text }, token)
  else res = await call(`/${id}/videos`, { file_url: media.url, description: text }, token)
  const postId = res.post_id ?? res.id
  if (!postId) throw new Error('facebook: no post id in the answer')
  return { id: postId, link: `https://www.facebook.com/${postId}` }
}
