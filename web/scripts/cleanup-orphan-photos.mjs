// One-off: deletes the catch photos nobody points at (no catch, no diary entry) that are older than two days —
// photos uploaded at the shutter and then retaken, given up on, or refused. What counts as an orphan and why:
// lib/server/orphanPhotos.ts. The nightly route app/api/cron/cleanup-photos keeps it clean afterwards.
//
//   node --env-file=.env.local --import ./scripts/test-register.mjs scripts/cleanup-orphan-photos.mjs           (dry run: lists, deletes nothing)
//   node --env-file=.env.local --import ./scripts/test-register.mjs scripts/cleanup-orphan-photos.mjs --apply   (saves a copy of each, then deletes)
//   --min-age-days=2  --limit=N  --no-backup
//
// Every file it deletes is first saved under scripts/.cache/orphan-backup/ (gitignored): putting one back is an
// upload of that copy to the same path.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { PHOTO_BUCKET, deletePhotos, findOrphanPhotos } from '@/lib/server/orphanPhotos'

const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.startsWith('--') ? a.slice(2).split('=') : [a, true])).map(([k, v]) => [k, v ?? true]))
const APPLY = args.apply === true
const BACKUP = args['no-backup'] !== true
const MIN_AGE_MS = Number(args['min-age-days'] || 2) * 24 * 60 * 60 * 1000
const LIMIT = Number(args.limit || Infinity)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run with --env-file=.env.local')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { files, used, orphans: all } = await findOrphanPhotos(db, MIN_AGE_MS)
const orphans = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, LIMIT)
const mb = (n) => (n / 1e6).toFixed(1)
const bytes = orphans.reduce((s, f) => s + f.size, 0)
console.log(`${PHOTO_BUCKET}: ${files} files, ${used} in use by catches and the diary`)
console.log(`orphans older than ${MIN_AGE_MS / 86400000} days: ${orphans.length} files, ${mb(bytes)} MB${APPLY ? ' — APPLYING' : ' — dry run'}`)
if (orphans.length) console.log(`oldest ${orphans[0].createdAt.slice(0, 10)}, newest ${orphans.at(-1).createdAt.slice(0, 10)}; e.g. ${orphans.slice(0, 3).map((f) => f.path).join(', ')}`)
if (!APPLY || !orphans.length) process.exit(0)

if (BACKUP) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '.cache', 'orphan-backup', PHOTO_BUCKET)
  for (const [i, f] of orphans.entries()) {
    const { data, error } = await db.storage.from(PHOTO_BUCKET).download(f.path)
    if (error) throw new Error(`backup ${f.path}: ${error.message}`)
    const to = join(dir, f.path)
    mkdirSync(dirname(to), { recursive: true })
    writeFileSync(to, Buffer.from(await data.arrayBuffer()))
    if ((i + 1) % 50 === 0) console.log(`saved ${i + 1}/${orphans.length}`)
  }
  console.log(`copies saved under ${dir}`)
}
await deletePhotos(db, orphans.map((f) => f.path))
console.log(`deleted ${orphans.length} files, ${mb(bytes)} MB`)
