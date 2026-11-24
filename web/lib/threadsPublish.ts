import type { SocialPost } from '@/lib/socialBot'

// Publishing to Threads (the owner's personal account) through the official
// Threads API. The token is a long-lived user token made in the Meta app's
// «Генератор маркеров» and entered by the owner in Vercel as THREADS_ACCESS_TOKEN
// (it lives 60 days; /api/social-bot/refresh-token renews it, see there).
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

const API = 'https://graph.threads.net/v1.0'
const TEXT_LIMIT = 500

export function threadsConfigured(): boolean {
  return !!process.env.THREADS_ACCESS_TOKEN
}

async function call<T>(path: string, params: Record<string, string>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const url = new URL(`${API}${path}`)
  const body = new URLSearchParams({ ...params, access_token: process.env.THREADS_ACCESS_TOKEN ?? '' })
  if (method === 'GET') body.forEach((v, k) => url.searchParams.set(k, v))
  const res = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    body: method === 'POST' ? body : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok || json.error) throw new Error(`threads ${path}: ${json.error?.message ?? `HTTP ${res.status}`}`)
  return json
}

// The text for Threads: its own caption if the post has one, else the common text.
export function threadsText(p: SocialPost): string {
  const own = p.captions.threads
  const text = (typeof own === 'string' && own.trim() ? own : p.body).trim()
  return text.length > TEXT_LIMIT ? text.slice(0, TEXT_LIMIT - 1) + '…' : text
}

// A video container takes time to process; publishing before FINISHED fails.
async function waitFinished(id: string) {
  for (let i = 0; i < 12; i++) {
    const s = await call<{ status?: string; error_message?: string }>(`/${id}`, { fields: 'status,error_message' }, 'GET')
    if (s.status === 'FINISHED') return
    if (s.status === 'ERROR' || s.status === 'EXPIRED') throw new Error(`threads media ${s.status}: ${s.error_message ?? ''}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('threads media: processing timed out')
}

// Publishes a text post, or a post with one photo or one video. Returns the link.
export async function publishToThreads(p: SocialPost): Promise<{ id: string; link: string | null }> {
  const text = threadsText(p)
  const media = p.media[0]
  const params: Record<string, string> = { text }
  if (!media) params.media_type = 'TEXT'
  else if (media.type === 'photo') Object.assign(params, { media_type: 'IMAGE', image_url: media.url })
  else Object.assign(params, { media_type: 'VIDEO', video_url: media.url })

  const container = await call<{ id: string }>('/me/threads', params)
  if (media?.type === 'video') await waitFinished(container.id)
  const published = await call<{ id: string }>('/me/threads_publish', { creation_id: container.id })
  const info = await call<{ permalink?: string }>(`/${published.id}`, { fields: 'permalink' }, 'GET').catch(() => ({ permalink: undefined }))
  return { id: published.id, link: info.permalink ?? null }
}

// A fresh 60-day token from the current one (allowed after the token is 24 h old).
export async function refreshThreadsToken(): Promise<{ expiresInDays: number; token: string }> {
  const url = new URL('https://graph.threads.net/refresh_access_token')
  url.searchParams.set('grant_type', 'th_refresh_token')
  url.searchParams.set('access_token', process.env.THREADS_ACCESS_TOKEN ?? '')
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: { message?: string } }
  if (!res.ok || !json.access_token) throw new Error(`threads refresh: ${json.error?.message ?? `HTTP ${res.status}`}`)
  return { token: json.access_token, expiresInDays: Math.round((json.expires_in ?? 0) / 86400) }
}
