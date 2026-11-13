import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import { copyObject, headObject, r2FromEnv } from '@/lib/server/r2'
import { THUMB_SIZES, r2KeyOf, r2PhotoUrl, thumbKey } from '@/lib/photoUrl'

// A catch refused by someone else's shield is kept in the diary (lib/supabase/storage.ts copyCatchPhotoToDiary):
// diary_catches only takes photos under <player>/diary/, so the photo already uploaded for the catch is copied
// there — on R2 this is a server copy (the app has no key). Only the player's own catch photo, never a diary one.
type Db = { from: (t: 'photo_uploads') => { insert: (row: { user_id: string; kind: string; key: string; bytes: number }) => PromiseLike<{ error: { message: string } | null }> } }

async function handlePOST(req: Request) {
  const r2 = r2FromEnv()
  if (!r2) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: auth } = await admin.auth.getUser(token)
  const uid = auth.user?.id
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { url } = (await req.json().catch(() => ({}))) as { url?: string }
  const from = typeof url === 'string' ? r2KeyOf(url) : null
  if (!from || !from.startsWith(`catch-photos/${uid}/`) || from.includes('/diary/')) return NextResponse.json({ error: 'bad_photo' }, { status: 400 })
  const source = await headObject(r2, from)
  if (!source) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const to = `catch-photos/${uid}/diary/${randomUUID()}.jpg`
  await copyObject(r2, from, to)
  for (const s of THUMB_SIZES) await copyObject(r2, thumbKey(from, s), thumbKey(to, s))
  const { error } = await (admin as unknown as Db).from('photo_uploads').insert({ user_id: uid, kind: 'diary', key: to, bytes: source.size })
  if (error) throw new Error(`photo_uploads: ${error.message}`)
  return NextResponse.json({ url: r2PhotoUrl(to) })
}

export const POST = withErrorReport('photos/copy-to-diary', handlePOST)
