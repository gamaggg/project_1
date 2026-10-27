// Builds the static sector geometry the map loads instead of asking the database for every
// sector of a city on each start: public/data/sectors-<prefix>.<version>.json, one file per city
// (B Batumi, M Moscow, P Saint Petersburg, S Sochi, T Tbilisi). The version (the build time) is in
// the file name, so a rebuilt file is a new address for the service worker's cache and the phones'
// stored copies, and lib/data/sectorGeometryVersion.ts says which one the app asks for.
//
//   node scripts/build-sector-geometry.mjs            # write the files
//   node scripts/build-sector-geometry.mjs --check    # only report what would change
//
// A file is { builtAt, sectors: [{ id, kind, lat, lng, corners }] }, sectors in id order. What goes in:
//  - every sector that is not deleted in the database and has a shape: from the files already
//    there (or, the first time, from the old public/data/sectors.json) when it is in them,
//    else from its database row (shape and centre never change; the water type does, so the
//    type is always the database's when the sector has a row);
//  - nothing for a deleted sector.
// builtAt is when the database was read (minus ten minutes of margin): the app asks the database
// for rows created after it, so a sector added later still shows up until the next rebuild.
//
// Rebuild after sectors are added or deleted in bulk (a new city, a grid extension), and apply
// the migration that adds territories.kind_changed_at first, so a water type changed after the
// build is noticed (see docs/40 Функции/Загрузка секторов карты.md). Reads the public anon key
// from .env.local and prints nothing secret.

import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const dataDir = new URL('public/data/', root)
const checkOnly = process.argv.includes('--check')

const env = Object.fromEntries(
  readFileSync(new URL('.env.local', root), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
)
const base = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!base || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing in .env.local')

const readStarted = new Date()

async function fetchAllRows() {
  const rows = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const res = await fetch(`${base}/rest/v1/territories_with_stats?select=id,kind,lat,lng,corners,is_deleted&order=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` },
    })
    if (!res.ok) throw new Error(`territories_with_stats: HTTP ${res.status}`)
    const part = await res.json()
    rows.push(...part)
    if (part.length < page) break
  }
  return rows
}

const readJson = (name) => {
  const url = new URL(name, dataDir)
  return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : null
}

// What is already there: the newest per-city files, or the old single file the first time.
const existing = new Map()
const legacy = readJson('sectors.json')
if (legacy) for (const s of legacy) existing.set(s.id, s)
const fileNames = readdirSync(dataDir).filter((n) => /^sectors-[A-Z]\.[0-9TZ]+\.json$/.test(n)).sort()
for (const name of fileNames) for (const s of readJson(name).sectors) existing.set(s.id, s) // older versions first, newest last

const rows = await fetchAllRows()
const rowById = new Map(rows.map((r) => [r.id, r]))

const sectors = new Map()
const stats = { fromExisting: 0, fromDb: 0, deletedDropped: 0, kindFromDb: 0, noShape: 0 }
for (const old of existing.values()) {
  const row = rowById.get(old.id)
  if (row?.is_deleted) {
    stats.deletedDropped++
    continue
  }
  const kind = row?.kind ?? old.kind
  if (kind !== old.kind) stats.kindFromDb++
  sectors.set(old.id, { id: old.id, kind, lat: old.lat, lng: old.lng, corners: old.corners })
  stats.fromExisting++
}
for (const row of rows) {
  if (sectors.has(row.id) || row.is_deleted) continue
  if (!row.corners || row.lat == null || row.lng == null || !row.kind) {
    stats.noShape++
    continue
  }
  sectors.set(row.id, { id: row.id, kind: row.kind, lat: row.lat, lng: row.lng, corners: row.corners })
  stats.fromDb++
}

const builtAt = new Date(readStarted.getTime() - 10 * 60_000).toISOString()
const version = builtAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
const byPrefix = new Map()
for (const s of [...sectors.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
  const prefix = s.id.charAt(0)
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
  byPrefix.get(prefix).push(s)
}

console.log('builtAt', builtAt, 'version', version)
console.log(stats)
for (const [prefix, list] of [...byPrefix].sort()) {
  const text = JSON.stringify({ builtAt, sectors: list })
  console.log(`sectors-${prefix}.${version}.json: ${list.length} sectors, ${(text.length / 1024).toFixed(0)} KB`)
  if (!checkOnly) writeFileSync(new URL(`sectors-${prefix}.${version}.json`, dataDir), text)
}
if (!checkOnly) {
  for (const name of fileNames) unlinkSync(new URL(name, dataDir)) // the files of earlier builds
  writeFileSync(
    new URL('lib/data/sectorGeometryVersion.ts', root),
    `// Written by scripts/build-sector-geometry.mjs: which build of public/data/sectors-<prefix>.<version>.json the app asks for.\nexport const SECTOR_GEOMETRY_VERSION = '${version}'\n`
  )
  console.log('lib/data/sectorGeometryVersion.ts written, earlier files removed:', fileNames.length)
}
