import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteObject, listObjects, type R2 } from '@/lib/server/r2'

// Catch photos nobody points at. A photo is uploaded the moment it is taken (CameraScreen → FishZoneApp
// startUpload), before the catch is sent: a retake, a catch given up on the confirm screen, a catch the server
// refused (a shield copies it into the diary under a new name), each leaves the uploaded file behind. 412 such files
// (84 MB) by 13.11.2026, ~40 a week since — about a sixth of what the 1 GB free storage gains a week.
//
// The only places that point at a catch photo are catches.photo_url and diary_catches.photo_url (every text and
// jsonb column of public was searched 13.11.2026). A file is an orphan when neither has it and it is older than
// ORPHAN_MIN_AGE_MS: a catch is sent within minutes of its photo, an offline catch within a day (MAX_AGE_MS in
// lib/offlineCatches.ts), so two days leave nothing in flight.
//
// Server-only (the service role client: players may not delete photos). Used by the nightly route
// app/api/cron/cleanup-photos and the one-off scripts/cleanup-orphan-photos.mjs. Plain TypeScript Node can run
// as it is (no enums), so the script imports this file directly.

export const PHOTO_BUCKET = 'catch-photos'
export const ORPHAN_MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000

export type StoredPhoto = { path: string; size: number; createdAt: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>
type Entry = { name: string; created_at: string | null; metadata: { size?: number } | null }

async function listFolder(db: Db, prefix: string): Promise<Entry[]> {
  const out: Entry[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(PHOTO_BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    out.push(...(data as Entry[]))
    if (data.length < 1000) return out
  }
}

// Every file of the bucket: <user>/<time>.jpg and <user>/diary/<uuid>.jpg. Folders come without metadata.
export async function listPhotos(db: Db): Promise<StoredPhoto[]> {
  const files: StoredPhoto[] = []
  const walk = async (prefix: string) => {
    for (const e of await listFolder(db, prefix)) {
      const path = prefix ? `${prefix}/${e.name}` : e.name
      if (e.metadata) files.push({ path, size: Number(e.metadata.size ?? 0), createdAt: e.created_at ?? new Date().toISOString() })
      else await walk(path)
    }
  }
  await walk('')
  return files
}

// The storage paths the catches and the diary point at.
export async function usedPhotoPaths(db: Db): Promise<Set<string>> {
  const used = new Set<string>()
  const marker = `/${PHOTO_BUCKET}/`
  for (const table of ['catches', 'diary_catches']) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select('id, photo_url').not('photo_url', 'is', null).order('id').range(from, from + 999)
      if (error) throw error
      for (const row of data as { photo_url: string }[]) {
        const i = row.photo_url.indexOf(marker)
        if (i >= 0) used.add(decodeURIComponent(row.photo_url.slice(i + marker.length).split('?')[0]))
      }
      if (data.length < 1000) break
    }
  }
  return used
}

export async function findOrphanPhotos(db: Db, minAgeMs = ORPHAN_MIN_AGE_MS, now = Date.now()) {
  const [files, used] = await Promise.all([listPhotos(db), usedPhotoPaths(db)])
  // A read that came back short must never turn into deleting real catches' photos.
  if (used.size < 100) throw new Error(`only ${used.size} photos in use: refusing to look for orphans`)
  const orphans = files.filter((f) => !used.has(f.path) && now - Date.parse(f.createdAt) > minAgeMs)
  if (orphans.length > files.length / 2) throw new Error(`${orphans.length} of ${files.length} files look orphaned: refusing`)
  return { files: files.length, used: used.size, orphans }
}

export async function deletePhotos(db: Db, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from(PHOTO_BUCKET).remove(paths.slice(i, i + 100))
    if (error) throw error
  }
}

// The same on Cloudflare R2 (lib/photoUrl.ts): catch photos live under catch-photos/<path> — the path the catches
// point at, as in Supabase — each with its .t160/.t480 thumbnails. A photo nobody uses goes with its thumbnails;
// thumbnails left without their photo (an upload cut off halfway) go too.
export type R2Orphan = { path: string; keys: string[]; size: number }

export async function findR2OrphanPhotos(db: Db, r2: R2, minAgeMs = ORPHAN_MIN_AGE_MS, now = Date.now()) {
  const [objects, used] = await Promise.all([listObjects(r2, `${PHOTO_BUCKET}/`), usedPhotoPaths(db)])
  if (used.size < 100) throw new Error(`only ${used.size} photos in use: refusing to look for orphans`)
  // A photo's age is its own upload time; thumbnails without a photo are as old as the newest of them.
  const groups = new Map<string, { keys: string[]; size: number; at: string; hasMain: boolean }>()
  for (const o of objects) {
    const main = o.key.replace(/\.t\d+\.jpg$/, '.jpg')
    const g = groups.get(main) ?? { keys: [], size: 0, at: o.lastModified, hasMain: false }
    g.keys.push(o.key)
    g.size += o.size
    if (o.key === main) {
      g.hasMain = true
      g.at = o.lastModified
    } else if (!g.hasMain && o.lastModified > g.at) g.at = o.lastModified
    groups.set(main, g)
  }
  const orphans: R2Orphan[] = []
  for (const [main, g] of groups) {
    if (used.has(main.slice(PHOTO_BUCKET.length + 1)) || now - Date.parse(g.at) <= minAgeMs) continue
    orphans.push({ path: main, keys: g.keys, size: g.size })
  }
  if (orphans.length > groups.size / 2) throw new Error(`${orphans.length} of ${groups.size} R2 photos look orphaned: refusing`)
  return { files: groups.size, used: used.size, orphans }
}

export async function deleteR2Photos(r2: R2, keys: string[]) {
  for (let i = 0; i < keys.length; i += 8) await Promise.all(keys.slice(i, i + 8).map((k) => deleteObject(r2, k)))
}
