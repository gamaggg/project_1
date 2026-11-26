import type { SocialPost } from '@/lib/socialBot'

// Publishing to the brand Instagram account (@catchrange) through the official
// Instagram API (Graph API). The token is a system-user token (no expiry) made in
// the Meta app «RANGE Posting» and entered by the owner in Vercel as
// INSTAGRAM_ACCESS_TOKEN. INSTAGRAM_USER_ID is the account's id (not a secret;
// the default is @catchrange).
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

const API = 'https://graph.facebook.com/v21.0'
const CAPTION_LIMIT = 2200
const DEFAULT_USER_ID = '17841458283057334'

export function instagramConfigured(): boolean {
  return !!process.env.INSTAGRAM_ACCESS_TOKEN
}

function userId(): string {
  return process.env.INSTAGRAM_USER_ID || DEFAULT_USER_ID
}

async function call<T>(path: string, params: Record<string, string>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const url = new URL(`${API}${path}`)
  const body = new URLSearchParams({ ...params, access_token: process.env.INSTAGRAM_ACCESS_TOKEN ?? '' })
  if (method === 'GET') body.forEach((v, k) => url.searchParams.set(k, v))
  const res = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    body: method === 'POST' ? body : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok || json.error) throw new Error(`instagram ${path}: ${json.error?.message ?? `HTTP ${res.status}`}`)
  return json
}

// The caption: Instagram's own text if the post has one, else the common text.
export function instagramCaption(p: SocialPost): string {
  const own = p.captions.instagram
  const text = (typeof own === 'string' && own.trim() ? own : p.body).trim()
  return text.length > CAPTION_LIMIT ? text.slice(0, CAPTION_LIMIT - 1) + '…' : text
}

// A video container takes time to process; publishing before FINISHED fails.
async function waitFinished(id: string) {
  for (let i = 0; i < 12; i++) {
    const s = await call<{ status_code?: string }>(`/${id}`, { fields: 'status_code' }, 'GET')
    if (s.status_code === 'FINISHED') return
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`instagram media ${s.status_code}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('instagram media: processing timed out')
}

// `story` = true publishes to Stories (no caption there), false to the feed
// (a photo post, or a video as a Reel). Needs a media file: Instagram has no text posts.
export async function publishToInstagram(p: SocialPost, story: boolean): Promise<{ id: string; link: string | null }> {
  const media = p.media[0]
  if (!media) throw new Error('instagram: the post has no photo or video')
  const params: Record<string, string> = {}
  if (story) params.media_type = 'STORIES'
  else if (media.type === 'video') params.media_type = 'REELS'
  if (media.type === 'video') params.video_url = media.url
  else params.image_url = media.url
  if (!story) params.caption = instagramCaption(p)

  const container = await call<{ id: string }>(`/${userId()}/media`, params)
  if (media.type === 'video') await waitFinished(container.id)
  const published = await call<{ id: string }>(`/${userId()}/media_publish`, { creation_id: container.id })
  const info = await call<{ permalink?: string }>(`/${published.id}`, { fields: 'permalink' }, 'GET').catch(() => ({ permalink: undefined }))
  return { id: published.id, link: info.permalink ?? null }
}
