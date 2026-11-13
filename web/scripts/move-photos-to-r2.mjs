// Moves the public photo buckets from Supabase Storage to Cloudflare R2 (docs «Перенос фото в Cloudflare R2»):
// every file goes to <bucket>/<path> in the one R2 bucket — the same path, so a URL only changes its start
// (supabase-drafts/db-load-13-11/08_photo_urls_to_r2.sql). Catch photos, avatars and announcement photos get the two
// square thumbnails the app now makes on upload (<name>.t160.jpg, .t480.jpg — lib/photoUrl.ts); panoramas already
// have their own small copies (_s.jpg). Safe to run again: what R2 already has (same size) is skipped.
//
//   node --env-file=.env.local --import ./scripts/test-register.mjs scripts/move-photos-to-r2.mjs            (dry run)
//   node --env-file=.env.local --import ./scripts/test-register.mjs scripts/move-photos-to-r2.mjs --apply    (copies)
//   node --env-file=.env.local --import ./scripts/test-register.mjs scripts/move-photos-to-r2.mjs --verify   (checks only)
//   --bucket=catch-photos  --limit=N
//
// Supabase files are not touched (they go a week after the switch, separately). Uses macOS `sips` for thumbnails.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { listObjects, putObject, r2FromEnv } from '@/lib/server/r2'
import { IMMUTABLE_CACHE, THUMB_SIZES, thumbKey } from '@/lib/photoUrl'

const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.startsWith('--') ? a.slice(2).split('=') : [a, true])).map(([k, v]) => [k, v ?? true]))
const APPLY = args.apply === true
const VERIFY = args.verify === true
const LIMIT = Number(args.limit || Infinity)
const BUCKETS = args.bucket ? [args.bucket] : ['catch-photos', 'avatars', 'announcement-photos', 'geo-panoramas']
const WITH_THUMBS = new Set(['catch-photos', 'avatars', 'announcement-photos'])

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run with --env-file=.env.local')
const r2 = r2FromEnv()
if (!r2) throw new Error('R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET missing in .env.local')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const work = join(dirname(fileURLToPath(import.meta.url)), '.cache', 'r2-move')
mkdirSync(work, { recursive: true })

async function listBucket(bucket) {
  const files = []
  const walk = async (prefix) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw error
      for (const e of data) {
        const path = prefix ? `${prefix}/${e.name}` : e.name
        if (e.metadata) files.push({ path, size: Number(e.metadata.size ?? 0), type: e.metadata.mimetype || 'image/jpeg' })
        else await walk(path)
      }
      if (data.length < 1000) return
    }
  }
  await walk('')
  return files
}

// A square center crop, side × side, JPEG 75 — the same as lib/photoThumbs.ts does in the app.
function thumb(src, side, out) {
  const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', src], { encoding: 'utf8' })
  const w = Number(dims.match(/pixelWidth: (\d+)/)[1])
  const h = Number(dims.match(/pixelHeight: (\d+)/)[1])
  const s = Math.min(side, w, h) / Math.min(w, h)
  const rw = Math.max(1, Math.round(w * s))
  const rh = Math.max(1, Math.round(h * s))
  const n = Math.min(side, rw, rh)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', '-z', String(rh), String(rw), src, '--out', out], { stdio: 'ignore' })
  execFileSync('sips', ['-c', String(n), String(n), out, '--out', out], { stdio: 'ignore' })
  return readFileSync(out)
}

const mb = (n) => (n / 1e6).toFixed(1)
let problems = 0
for (const bucket of BUCKETS) {
  const files = (await listBucket(bucket)).slice(0, LIMIT)
  const have = new Map((await listObjects(r2, `${bucket}/`)).map((o) => [o.key, o.size]))
  const todo = files.filter((f) => have.get(`${bucket}/${f.path}`) !== f.size || (WITH_THUMBS.has(bucket) && THUMB_SIZES.some((s) => !have.has(thumbKey(`${bucket}/${f.path}`, s)))))
  const bytes = files.reduce((s, f) => s + f.size, 0)
  console.log(`${bucket}: ${files.length} files, ${mb(bytes)} MB in Supabase; ${files.length - todo.length} already in R2, ${todo.length} to copy${APPLY ? '' : ' (dry run)'}`)

  if (APPLY) {
    for (const [i, f] of todo.entries()) {
      const { data, error } = await db.storage.from(bucket).download(f.path)
      if (error) throw new Error(`download ${bucket}/${f.path}: ${error.message}`)
      const body = Buffer.from(await data.arrayBuffer())
      const k = `${bucket}/${f.path}`
      await putObject(r2, k, body, { 'content-type': f.type, 'cache-control': IMMUTABLE_CACHE })
      if (WITH_THUMBS.has(bucket)) {
        const src = join(work, `src-${i % 4}.jpg`)
        writeFileSync(src, body)
        for (const s of THUMB_SIZES) await putObject(r2, thumbKey(k, s), thumb(src, s, join(work, `t${s}-${i % 4}.jpg`)), { 'content-type': 'image/jpeg', 'cache-control': IMMUTABLE_CACHE })
      }
      if ((i + 1) % 50 === 0) console.log(`  …${i + 1}/${todo.length}`)
    }
  }

  if (APPLY || VERIFY) {
    // Every Supabase file must be in R2 with the same size, and its thumbnails beside it.
    const now = new Map((await listObjects(r2, `${bucket}/`)).map((o) => [o.key, o.size]))
    const missing = files.filter((f) => now.get(`${bucket}/${f.path}`) !== f.size)
    const noThumbs = WITH_THUMBS.has(bucket) ? files.filter((f) => THUMB_SIZES.some((s) => !now.has(thumbKey(`${bucket}/${f.path}`, s)))) : []
    problems += missing.length + noThumbs.length
    console.log(`  check: ${files.length - missing.length}/${files.length} in R2 with the same size${WITH_THUMBS.has(bucket) ? `, thumbnails missing for ${noThumbs.length}` : ''}${missing.length ? `; e.g. ${missing.slice(0, 3).map((f) => f.path).join(', ')}` : ''}`)
    // One file through the public address, if the domain is already live.
    const sample = files[0] && (await fetch(`https://photos.catchrange.com/${bucket}/${files[0].path}`, { method: 'HEAD' }).then((r) => r.status, () => 'no answer'))
    if (sample) console.log(`  photos.catchrange.com/${bucket}/${files[0].path}: ${sample}`)
  }
}
if (APPLY || VERIFY) console.log(problems ? `NOT READY: ${problems} problems` : 'READY: everything is in R2')
process.exitCode = problems ? 1 : 0
