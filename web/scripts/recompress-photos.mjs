// One-off: shrinks the catch photos already in storage to the size the camera
// now saves (1600 px on the long side, JPEG 82) — the 05.10 change to 1920 px
// had made them ~700 KB each and the 1 GB free-plan storage fill ~28 MB a day.
// Same path, same URL: only the file's bytes change.
//
//   node --env-file=.env.local scripts/recompress-photos.mjs            (dry run: downloads, converts, reports)
//   node --env-file=.env.local scripts/recompress-photos.mjs --apply    (overwrites the files in storage)
//   --bucket=catch-photos  --min-kb=300  --limit=N
//
// Every original it replaces is first saved under scripts/.cache/photo-backup/
// (gitignored) — putting a file back is an upload of that copy to the same path.
// Uses macOS `sips`, so it runs on a Mac.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.startsWith('--') ? a.slice(2).split('=') : [a, true])).map(([k, v]) => [k, v ?? true]))
const APPLY = args.apply === true
const BUCKET = args.bucket || 'catch-photos'
const MIN_BYTES = Number(args['min-kb'] || 300) * 1024
const LIMIT = Number(args.limit || Infinity)
const SIDE = 1600
const QUALITY = 82

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run with --env-file=.env.local')
const auth = { Authorization: `Bearer ${key}`, apikey: key }

const here = dirname(fileURLToPath(import.meta.url))
const backupDir = join(here, '.cache', 'photo-backup', BUCKET)
const workDir = join(here, '.cache', 'photo-work')
mkdirSync(workDir, { recursive: true })

async function list(prefix) {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    if (!res.ok) throw new Error(`list ${prefix}: ${res.status} ${await res.text()}`)
    const page = await res.json()
    out.push(...page)
    if (page.length < 1000) break
  }
  return out
}

// Folders (one per user) have no metadata; files do.
async function allFiles() {
  const files = []
  for (const top of await list('')) {
    if (top.metadata) files.push({ path: top.name, size: top.metadata.size })
    else for (const f of await list(top.name)) if (f.metadata) files.push({ path: `${top.name}/${f.name}`, size: f.metadata.size })
  }
  return files
}

const dims = (file) => {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' })
  return Math.max(...[...out.matchAll(/pixel(?:Width|Height): (\d+)/g)].map((m) => Number(m[1])))
}

const files = (await allFiles()).filter((f) => /\.jpe?g$/i.test(f.path) && f.size >= MIN_BYTES).sort((a, b) => b.size - a.size).slice(0, LIMIT)
console.log(`${BUCKET}: ${files.length} files of ${MIN_BYTES / 1024} KB or more${APPLY ? ' — APPLYING' : ' — dry run'}`)

let before = 0
let after = 0
let changed = 0
let skipped = 0
for (const [i, f] of files.entries()) {
  const src = join(workDir, `src-${i % 4}.jpg`)
  const dst = join(workDir, `dst-${i % 4}.jpg`)
  try {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${f.path.split('/').map(encodeURIComponent).join('/')}`, { headers: auth })
    if (!res.ok) throw new Error(`download ${res.status}`)
    const original = Buffer.from(await res.arrayBuffer())
    writeFileSync(src, original)
    if (dims(src) <= SIDE) {
      skipped++
      continue
    }
    execFileSync('sips', ['-Z', String(SIDE), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY), src, '--out', dst], { stdio: 'ignore' })
    const smaller = readFileSync(dst)
    if (smaller.length > original.length * 0.9) {
      skipped++
      continue
    }
    before += original.length
    after += smaller.length
    changed++
    if (APPLY) {
      const backup = join(backupDir, f.path)
      if (!existsSync(backup)) {
        mkdirSync(dirname(backup), { recursive: true })
        writeFileSync(backup, original)
      }
      const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${f.path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': 'max-age=3600' },
        body: smaller,
      })
      if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`)
    }
    if (changed % 25 === 0) console.log(`  ${changed} done · ${((before - after) / 1048576).toFixed(1)} MB saved so far`)
  } catch (e) {
    console.error(`  ${f.path}: ${e.message}`)
  }
}
for (const n of [0, 1, 2, 3]) for (const p of ['src', 'dst']) rmSync(join(workDir, `${p}-${n}.jpg`), { force: true })
console.log(`${changed} files ${APPLY ? 'shrunk' : 'would shrink'}, ${skipped} left as they were: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB (${((before - after) / 1048576).toFixed(1)} MB saved)`)
