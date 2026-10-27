// Checks that the map drawn by the new load of sectors (a static file per city + only the rows that
// matter) is exactly the map the old load drew (every row of the city + one static file), on live
// data, for every city, for a guest and for real players. Read-only: uses the public anon key from
// .env.local and prints nothing secret.
//
//   node --no-warnings --import ./scripts/test-register.mjs scripts/verify-sector-load.mjs
//
//   --no-kind-changed   before territories.kind_changed_at exists (the filter without that clause)
//   --break=<a,b,…>     drops those clauses from the filter: the check must then FAIL, which shows it can
//
// Exit code 0 = identical everywhere.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { CITIES } from '@/lib/data/city.ts'
import { TERRITORY_COLUMNS, geometryCitiesNeeded, mergeTerritories, touchedRowsFilter } from '@/lib/data/territoryMerge.ts'
import { fetchTerritoryRows } from '@/lib/data/territoryRows.ts'
import { SECTOR_GEOMETRY_VERSION } from '@/lib/data/sectorGeometryVersion.ts'
import { oldMerge } from '../tests/support/oldTerritoryMerge.mjs'

const root = new URL('../', import.meta.url)
const env = Object.fromEntries(
  readFileSync(new URL('.env.local', root), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const noKindChanged = process.argv.includes('--no-kind-changed')
const breakClauses = (arg('break') ?? '').split(',').filter(Boolean)

const readJson = (name) => JSON.parse(readFileSync(new URL(`public/data/${name}`, root), 'utf8'))
const legacy = readJson('sectors.json')
const files = Object.fromEntries(Object.values(CITIES).map((c) => [c.id, readJson(`sectors-${c.idPrefix}.${SECTOR_GEOMETRY_VERSION}.json`)]))

// Old load: every row, then what the old query would have returned for each scenario.
const allRows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('territories_with_stats').select(TERRITORY_COLUMNS).order('id').range(from, from + 999)
  if (error) throw error
  allRows.push(...data)
  if (data.length < 1000) break
}
console.log(`database: ${allRows.length} rows, ${allRows.filter((r) => r.is_deleted).length} deleted`)

// Players to check as: the biggest holders of each city, anyone holding in two cities, a co-holder, a player with nothing.
const ownedBy = new Map()
for (const r of allRows) if (r.owner_id && !r.is_deleted) ownedBy.set(r.owner_id, (ownedBy.get(r.owner_id) ?? new Set()).add(r.id.charAt(0)))
const counts = new Map()
for (const r of allRows) if (r.owner_id && !r.is_deleted) counts.set(r.owner_id, (counts.get(r.owner_id) ?? 0) + 1)
const players = new Set([...counts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id))
for (const [id, cities] of ownedBy) if (cities.size > 1) players.add(id)
for (const r of allRows) for (const h of Array.isArray(r.co_holders) ? r.co_holders : []) if (players.size < 14) players.add(h.id)
players.add('00000000-0000-0000-0000-000000000000')
const scenarios = [undefined, ...players]

let touchedFilter = (builtAt) => {
  let f = touchedRowsFilter(builtAt)
  if (noKindChanged) f = f.split(',').filter((p) => p !== 'kind_changed_at.not.is.null').join(',')
  if (breakClauses.length) f = f.split(',').filter((p) => !breakClauses.includes(p)).join(',')
  return f
}

let bad = 0
let checked = 0
let newRowsTotal = 0
let oldRowsTotal = 0
for (const city of Object.values(CITIES)) {
  for (const userId of scenarios) {
    const prefix = city.idPrefix
    const oldRows = allRows.filter((r) => r.id.startsWith(prefix) || (userId && r.owner_id === userId))
    const prev = oldMerge({ city: city.id, userId, geometry: legacy, rows: oldRows })

    const rows = await fetchTerritoryRows(supabase, { prefix, userId, touched: touchedFilter(files[city.id].builtAt) })
    const geometry = geometryCitiesNeeded(city.id, rows).flatMap((c) => files[c].sectors)
    const next = mergeTerritories({ city: city.id, userId, geometry, rows })

    checked++
    newRowsTotal += rows.length
    oldRowsTotal += oldRows.length
    const a = JSON.stringify(prev)
    const b = JSON.stringify(next)
    if (a !== b) {
      bad++
      const byId = new Map(prev.map((t) => [t.id, t]))
      const diff = []
      for (const t of next) if (JSON.stringify(byId.get(t.id)) !== JSON.stringify(t)) diff.push(t.id)
      const nextIds = new Set(next.map((t) => t.id))
      const missing = prev.filter((t) => !nextIds.has(t.id)).map((t) => t.id)
      console.log(`DIFFERENT ${city.id} as ${userId ?? 'guest'}: old ${prev.length} sectors, new ${next.length}; changed ${diff.length} (${diff.slice(0, 5)}), missing in new ${missing.length} (${missing.slice(0, 5)})`)
      const id = diff[0]
      if (id) console.log('  old', JSON.stringify(byId.get(id)), '\n  new', JSON.stringify(next.find((t) => t.id === id)))
    }
  }
  const guest = oldMerge({ city: city.id, userId: undefined, geometry: legacy, rows: allRows.filter((r) => r.id.startsWith(city.idPrefix)) })
  console.log(`${city.id}: ${guest.length} sectors on the map, checked as guest and ${scenarios.length - 1} players`)
}
console.log(`rows asked for from the database, summed over all ${checked} checks: new ${newRowsTotal} vs old ${oldRowsTotal} (${((1 - newRowsTotal / oldRowsTotal) * 100).toFixed(1)}% fewer)`)
console.log(bad ? `FAILED: ${bad} of ${checked} checks differ` : `OK: all ${checked} checks identical`)
process.exit(bad ? 1 : 0)
