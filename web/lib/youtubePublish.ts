import type { SocialPost } from '@/lib/socialBot'

// Publishing to the YouTube channel RANGE (Shorts) through the YouTube Data API v3.
// The owner made the Google Cloud project «RANGE Posting», the OAuth client and a
// refresh token (OAuth Playground, scope youtube.upload) and entered them in Vercel:
// YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN. The refresh token
// does not expire while the app is published, so nothing is stored in the database.
// Until Google audits the app, videos uploaded through the API are private no matter
// what is asked; after the audit set YOUTUBE_PRIVACY=public in Vercel.
// An upload costs about 1600 of the 10 000 daily quota units: roughly 6 uploads a day.
// Plan: docs/10 Продукт/Продвижение в соцсетях.md, docs/10 Продукт/Подача TikTok и YouTube на проверку.md

const TITLE_LIMIT = 100
const DESC_LIMIT = 4900
const MAX_BYTES = 64 * 1024 * 1024

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_CLIENT_ID && !!process.env.YOUTUBE_CLIENT_SECRET && !!process.env.YOUTUBE_REFRESH_TOKEN
}

async function accessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID ?? '',
      client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(30_000),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) throw new Error(`youtube token: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`)
  return json.access_token
}

// The text for YouTube: its own caption if the post has one, else the common text.
// The first line is the title, the rest (and the whole text) goes to the description.
export function youtubeText(p: SocialPost): { title: string; description: string } {
  const own = p.captions.youtube
  const text = (typeof own === 'string' && own.trim() ? own : p.body).trim()
  const title = (text.split('\n')[0] || 'RANGE').slice(0, TITLE_LIMIT)
  const description = `${text}\n\n#Shorts`.slice(0, DESC_LIMIT)
  return { title, description }
}

// Uploads one video (a vertical clip up to 60 seconds shows up as a Short).
export async function publishToYouTube(p: SocialPost): Promise<{ id: string; link: string | null }> {
  const media = p.media[0]
  if (!media || media.type !== 'video') throw new Error('youtube: the post has no video')
  const file = await fetch(media.url, { signal: AbortSignal.timeout(60_000) })
  if (!file.ok) throw new Error(`youtube: cannot read the video (HTTP ${file.status})`)
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_BYTES) throw new Error('youtube: the video is over 64 MB')
  const token = await accessToken()
  const { title, description } = youtubeText(p)

  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(bytes.length),
      'X-Upload-Content-Type': 'video/*',
    },
    body: JSON.stringify({
      snippet: { title, description, categoryId: '17' },
      status: { privacyStatus: process.env.YOUTUBE_PRIVACY || 'private', selfDeclaredMadeForKids: false },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  const uploadUrl = start.headers.get('location')
  if (!start.ok || !uploadUrl) {
    const err = (await start.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(`youtube start: ${err.error?.message ?? `HTTP ${start.status}`}`)
  }

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/*', 'Content-Length': String(bytes.length) },
    body: bytes,
    signal: AbortSignal.timeout(120_000),
  })
  const done = (await put.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!put.ok || !done.id) throw new Error(`youtube upload: ${done.error?.message ?? `HTTP ${put.status}`}`)
  return { id: done.id, link: `https://youtube.com/shorts/${done.id}` }
}
