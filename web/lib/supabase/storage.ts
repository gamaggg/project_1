import { createClient } from '@/lib/supabase/client'
import { isR2Photo, photosOnR2, THUMB_SIZES, type PhotoKind } from '@/lib/photoUrl'
import { squareThumb } from '@/lib/photoThumbs'

// Every public photo here gets a new name on upload (a time or a uuid) and is never written again, so the
// browser may keep it for a year instead of the default hour: a feed scrolled again, a profile opened again
// download nothing (the 5 GB monthly egress of the free plan is mostly photos). Support screenshots are private
// (signed links) and keep the default.
const IMMUTABLE = '31536000'

// Cloudflare R2 (lib/photoUrl.ts; on while NEXT_PUBLIC_PHOTO_BASE_URL is set): the server (app/api/photos/upload)
// checks the player and the limits and hands back presigned PUTs; the photo and its two square thumbnails go
// straight to R2. The URL is returned only once all three are there, so a list never asks for a missing thumbnail.
// «unauthorized» in the error lets FishZoneApp restore a lost session and try once more, as with Supabase.
async function sessionToken(): Promise<string> {
  const { data } = await createClient().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('unauthorized: no session')
  return token
}

async function uploadToR2(kind: PhotoKind, blob: Blob): Promise<string> {
  const thumbs = await Promise.all(THUMB_SIZES.map((s) => squareThumb(blob, s)))
  const res = await fetch('/api/photos/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await sessionToken()}` },
    body: JSON.stringify({ kind, bytes: blob.size, thumbBytes: thumbs.map((t) => t.size) }),
  })
  if (!res.ok) throw new Error(`photo upload refused: ${res.status} ${await res.text().catch(() => '')}`)
  const plan = (await res.json()) as { url: string; uploads: { url: string; headers: Record<string, string> }[] }
  const bodies = [blob, ...thumbs]
  await Promise.all(
    plan.uploads.map(async (u, i) => {
      const put = await fetch(u.url, { method: 'PUT', headers: u.headers, body: bodies[i] })
      if (!put.ok) throw new Error(`photo upload failed: ${put.status}`)
    })
  )
  return plan.url
}

// Called immediately after a catch photo is captured (see CameraScreen/FishZoneApp) —
// not at form-submit time — so the upload runs in the background while the user
// fills in species/length/etc. Throws on failure; caller drives the retry UI.
export async function uploadCatchPhoto(userId: string, blob: Blob): Promise<string> {
  if (photosOnR2) return uploadToR2('catch', blob)
  const supabase = createClient()
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('catch-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: IMMUTABLE,
  })
  if (error) throw error
  const { data } = supabase.storage.from('catch-photos').getPublicUrl(path)
  return data.publicUrl
}

// Same shape as uploadCatchPhoto, separate bucket. Caller downscales the blob
// before calling this (see ProfileScreen) — avatars don't need 1280px source photos.
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  if (photosOnR2) return uploadToR2('avatar', blob)
  const supabase = createClient()
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: IMMUTABLE,
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

// Not user-folder-scoped like the two above — the bucket's own RLS policy
// (see migration add_announcement_photos_bucket_and_column) restricts
// uploads to super admins directly, so any path works here.
export async function uploadAnnouncementPhoto(blob: Blob): Promise<string> {
  if (photosOnR2) return uploadToR2('announcement', blob)
  const supabase = createClient()
  const path = `${Date.now()}.jpg`
  const { error } = await supabase.storage.from('announcement-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: IMMUTABLE,
  })
  if (error) throw error
  const { data } = supabase.storage.from('announcement-photos').getPublicUrl(path)
  return data.publicUrl
}

// A catch refused by someone else's shield, kept in the diary instead:
// diary_catches only takes URLs under <uid>/diary/, so the photo already
// uploaded for the catch is copied there on the server (no second upload
// from the phone). Storage lets anyone read catch-photos and a user write to
// their own folder, which is all a copy needs.
export async function copyCatchPhotoToDiary(userId: string, photoUrl: string): Promise<string> {
  // A photo already on R2: the server copies it (with its thumbnails); the app has no key.
  if (isR2Photo(photoUrl)) {
    const res = await fetch('/api/photos/copy-to-diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await sessionToken()}` },
      body: JSON.stringify({ url: photoUrl }),
    })
    if (!res.ok) throw new Error(`diary copy refused: ${res.status} ${await res.text().catch(() => '')}`)
    return ((await res.json()) as { url: string }).url
  }
  const supabase = createClient()
  const marker = '/catch-photos/'
  const from = decodeURIComponent(photoUrl.slice(photoUrl.indexOf(marker) + marker.length))
  const to = `${userId}/diary/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('catch-photos').copy(from, to)
  if (error) throw error
  const { data } = supabase.storage.from('catch-photos').getPublicUrl(to)
  return data.publicUrl
}

// «Улов из галереи» for the diary: same bucket and folder rule as catch
// photos, under <uid>/diary/ (diary_catches only accepts URLs from there),
// with a random name — these never show up anywhere public.
export async function uploadDiaryPhoto(userId: string, blob: Blob): Promise<string> {
  if (photosOnR2) return uploadToR2('diary', blob)
  const supabase = createClient()
  const path = `${userId}/diary/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('catch-photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: IMMUTABLE })
  if (error) throw error
  const { data } = supabase.storage.from('catch-photos').getPublicUrl(path)
  return data.publicUrl
}

// A screenshot for «Написать в поддержку»: a private bucket (no public URL —
// only the server reads it, handing Telegram a short-lived signed link), so
// what's stored is the path, not a URL.
export async function uploadSupportPhoto(userId: string, blob: Blob): Promise<string> {
  const supabase = createClient()
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('support').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}
