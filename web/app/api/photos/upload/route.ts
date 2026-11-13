import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import { presignPut, r2FromEnv } from '@/lib/server/r2'
import { IMMUTABLE_CACHE, THUMB_SIZES, r2PhotoUrl, thumbKey, type PhotoKind } from '@/lib/photoUrl'

// A photo going to R2 (lib/photoUrl.ts, docs «Перенос фото в Cloudflare R2»): the app asks here, gets one presigned
// PUT per file (the photo and its two thumbnails), each valid 15 minutes, with type, size and cache header fixed by
// the signature, and uploads straight to R2. What the storage rules of the Supabase buckets did is done here:
// - who: a signed-in player (the session token, as /api/recognize-fish); announcements — the super admin only;
// - where: catches and avatars only into the player's own folder, under a name the server picks;
// - how many: photo_upload_allowed (40 an hour, 120 a day, not for a frozen player — as _may_upload_photo did), every
//   upload written to photo_uploads, which it counts (and abuse_scan reads);
// - how big: the bucket limits (8 MB a catch photo, 2 MB an avatar, 5 MB an announcement photo), 1 MB a thumbnail.

const MAX_BYTES: Record<PhotoKind, number> = { catch: 8 << 20, diary: 8 << 20, avatar: 2 << 20, announcement: 5 << 20 }
const MAX_THUMB_BYTES = 1 << 20

type Body = { kind?: string; bytes?: number; thumbBytes?: number[] }
// photo_uploads and photo_upload_allowed are not in the generated types until their migration is applied.
type Db = {
  rpc: (fn: 'photo_upload_allowed', args: { p_user: string }) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>
  from: (t: 'photo_uploads') => { insert: (row: { user_id: string; kind: string; key: string; bytes: number }) => PromiseLike<{ error: { message: string } | null }> }
}

function keyFor(kind: PhotoKind, uid: string): string {
  const now = Date.now()
  switch (kind) {
    case 'catch':
      return `catch-photos/${uid}/${now}.jpg`
    case 'diary':
      return `catch-photos/${uid}/diary/${randomUUID()}.jpg`
    case 'avatar':
      return `avatars/${uid}/${now}.jpg`
    case 'announcement':
      return `announcement-photos/${now}.jpg`
  }
}

async function handlePOST(req: Request) {
  const r2 = r2FromEnv()
  if (!r2) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: auth } = await admin.auth.getUser(token)
  const uid = auth.user?.id
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Body
  const kind = body.kind as PhotoKind
  if (!(kind in MAX_BYTES)) return NextResponse.json({ error: 'bad_kind' }, { status: 400 })
  const bytes = Number(body.bytes)
  const thumbBytes = Array.isArray(body.thumbBytes) ? body.thumbBytes.map(Number) : []
  if (!(bytes > 0 && bytes <= MAX_BYTES[kind])) return NextResponse.json({ error: 'too_big' }, { status: 413 })
  if (thumbBytes.length !== THUMB_SIZES.length || !thumbBytes.every((n) => n > 0 && n <= MAX_THUMB_BYTES)) {
    return NextResponse.json({ error: 'bad_thumbs' }, { status: 400 })
  }

  if (kind === 'announcement') {
    const { data: me } = await admin.from('profiles').select('is_super_admin').eq('id', uid).maybeSingle()
    if (!me?.is_super_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const db = admin as unknown as Db
  const { data: allowed, error: limitError } = await db.rpc('photo_upload_allowed', { p_user: uid })
  if (limitError) throw new Error(`photo_upload_allowed: ${limitError.message}`)
  if (!allowed) return NextResponse.json({ error: 'limit' }, { status: 429 })

  const key = keyFor(kind, uid)
  const { error: logError } = await db.from('photo_uploads').insert({ user_id: uid, kind, key, bytes })
  if (logError) throw new Error(`photo_uploads: ${logError.message}`)

  const put = (k: string, n: number) => {
    const headers = { 'content-type': 'image/jpeg', 'cache-control': IMMUTABLE_CACHE, 'content-length': String(n) }
    // content-length is set by the browser from the body; the rest the app sends as given.
    return { url: presignPut(r2, k, headers), headers: { 'Content-Type': headers['content-type'], 'Cache-Control': headers['cache-control'] } }
  }
  return NextResponse.json({
    url: r2PhotoUrl(key),
    uploads: [put(key, bytes), ...THUMB_SIZES.map((s, i) => put(thumbKey(key, s), thumbBytes[i]))],
  })
}

export const POST = withErrorReport('photos/upload', handlePOST)
