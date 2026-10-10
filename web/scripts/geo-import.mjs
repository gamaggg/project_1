// «Где это?»: brings Mapillary 360° panoramas taken inside our water sectors
// into geo_panoramas as 'pending' — a super admin then keeps the ones where
// the water is in view (Профиль → «Панорамы»).
//
//   node --env-file=.env.local scripts/geo-import.mjs batumi --dry
//   node --env-file=.env.local scripts/geo-import.mjs batumi --dry --stats=/tmp/batumi.json
//   node --env-file=.env.local scripts/geo-import.mjs batumi --sample=10 --sample-out=/tmp/s.json
//
// Only good panoramas are taken: Mapillary's quality_score ≥ --min-quality
// (0.8), shot since --since (2021-01-01), at least --min-width (5000 px)
// wide, and light enough (the picture itself is looked at — cameras' clocks
// are off by hours, so the time of day can't be trusted); --max-lat cuts the
// coast off to the north (Batumi: 41.9 — no Ureki / Grigoleti). It has to
// be a shore: within --max-water (80 m) of the water line (from
// OpenStreetMap — run scripts/geo-water.mjs first), and not shot from a car
// (a sequence moving faster than --max-speed, 20 km/h, or now and then over
// 35, is a car — its roof fills the bottom of the picture; walkers and
// cyclists show only themselves there). And it has to be
// inside its sector's hexagon, at least --edge (15 m) from the border, so GPS
// error can't put the answer in the sector next door.
//
// Two steps. The first picks up to --per-sector (8) per sector, at least
// 50 m apart, the best first, and re-encodes each (no metadata) to a
// 4096×2048 view and a 1024×512 preview under a random name — into
// scripts/.cache/geo-<city>/ with a manifest.json, so neither the file nor
// its name gives the place away:
//   node --env-file=.env.local scripts/geo-import.mjs batumi --per-sector=8 --limit=200
// The second puts what's in the manifest and not in the base yet into the
// public geo-panoramas bucket and geo_panoramas, as 'pending':
//   node --env-file=.env.local scripts/geo-import.mjs batumi --upload
//
// --dry only counts what's there, by water type. Needs MAPILLARY_TOKEN,
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const args = process.argv.slice(2)
const city = args[0] === 'moscow' ? 'moscow' : 'batumi'
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const DRY = args.includes('--dry')
const UPLOAD = args.includes('--upload')
// Per-sector counts (id, kind, centre, panoramas, the newest) to a JSON file.
const STATS = flag('stats')
const MIN_QUALITY = Number(flag('min-quality') ?? 0.8)
const SINCE = Date.parse(flag('since') ?? '2021-01-01')
const MIN_WIDTH = Number(flag('min-width') ?? 5000)
const MAX_LAT = Number(flag('max-lat') ?? (city === 'batumi' ? 41.9 : 90))
const SAMPLE = Number(flag('sample') ?? 0)
const SAMPLE_OUT = flag('sample-out')
const MIN_LIGHT = Number(flag('min-light') ?? 80)
const MAX_WATER_M = Number(flag('max-water') ?? 80)
const MAX_SPEED_KMH = Number(flag('max-speed') ?? 20)
const EDGE_M = Number(flag('edge') ?? 15)
// Just these sectors (comma-separated ids) — to go again over the ones
// Mapillary failed on; and how many times a box may be split in four
// (dense central Moscow needs a third time).
const ONLY = flag('only')?.split(',')
const MAX_DEPTH = Number(flag('depth') ?? 2)

function metresToSegment(lat, lng, a, b) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180)
  const ky = 110540
  const ax = (a[1] - lng) * kx
  const ay = (a[0] - lat) * ky
  const bx = (b[1] - lng) * kx
  const by = (b[0] - lat) * ky
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}

// The sector's own hexagon: from the static geometry when the sector is
// there (public/data/sectors.json), else built round its centre the same
// way — corners east and west 346 m out, flat sides 300 m north and south.
const staticCorners = new Map()
{
  const geometry = JSON.parse(await readFile(new URL('../public/data/sectors.json', import.meta.url), 'utf8'))
  for (const g of geometry) if (g.corners) staticCorners.set(g.id, g.corners)
}
function hexOf(sector) {
  const known = staticCorners.get(sector.id)
  if (known) return known
  const R = 346.41 / (111320 * Math.cos((sector.lat * Math.PI) / 180))
  const r = 300 / 110574
  const { lat, lng } = sector
  return [
    [lat, lng + R],
    [lat + r, lng + R / 2],
    [lat + r, lng - R / 2],
    [lat, lng - R],
    [lat - r, lng - R / 2],
    [lat - r, lng + R / 2],
  ]
}
// Inside the polygon and at least `margin` metres from every side of it.
function insideWithMargin(lat, lng, corners, margin) {
  let inside = false
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [yi, xi] = corners[i]
    const [yj, xj] = corners[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  if (!inside) return false
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    if (metresToSegment(lat, lng, corners[j], corners[i]) < margin) return false
  }
  return true
}

// The water line, cut into segments and hashed into ~170 m cells, so a
// panorama only measures against the segments around it.
const CELL = 0.0015
const waterCells = new Map()
{
  let lines
  try {
    lines = JSON.parse(await readFile(new URL(`./.cache/water-${city}.json`, import.meta.url), 'utf8'))
  } catch {
    throw new Error(`no water lines for ${city} — run: node scripts/geo-water.mjs ${city}`)
  }
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]
      const b = line[i]
      const seen = new Set()
      // A long segment goes into every cell along it.
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / CELL))
      for (let k = 0; k <= steps; k++) {
        const key = `${Math.floor((a[0] + ((b[0] - a[0]) * k) / steps) / CELL)}:${Math.floor((a[1] + ((b[1] - a[1]) * k) / steps) / CELL)}`
        if (seen.has(key)) continue
        seen.add(key)
        waterCells.set(key, [...(waterCells.get(key) ?? []), [a, b]])
      }
    }
  }
}
function metresToWater(lat, lng) {
  const cy = Math.floor(lat / CELL)
  const cx = Math.floor(lng / CELL)
  let best = Infinity
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (const [a, b] of waterCells.get(`${y}:${x}`) ?? []) best = Math.min(best, metresToSegment(lat, lng, a, b))
    }
  }
  return best
}

// Sequences shot from a car: the speed between their
// panoramas (by the camera's own clock — off by hours maybe, but not between
// two shots of one walk).
const vehicleSequences = new Set()
function findVehicles(all) {
  const bySeq = new Map()
  for (const x of all) if (x.img.sequence) bySeq.set(x.img.sequence, [...(bySeq.get(x.img.sequence) ?? []), x])
  for (const [seq, list] of bySeq) {
    list.sort((p, q) => p.img.captured_at - q.img.captured_at)
    const speeds = []
    for (let i = 1; i < list.length; i++) {
      const dt = (list[i].img.captured_at - list[i - 1].img.captured_at) / 1000
      if (dt <= 0 || dt > 60) continue
      speeds.push((distanceM(list[i - 1].lat, list[i - 1].lng, list[i].lat, list[i].lng) / dt) * 3.6)
    }
    if (speeds.length < 3) continue
    speeds.sort((p, q) => p - q)
    const median = speeds[Math.floor(speeds.length / 2)]
    const fast = speeds[Math.floor(speeds.length * 0.9)]
    if (args.includes('--speeds')) console.log(`  seq ${seq} · ${list[0].img.creator?.username ?? '?'} · ${list.length} panoramas · ${median.toFixed(1)} km/h, 90% ${fast.toFixed(1)}`)
    // A car: usually over 20, and even in traffic it's over 35 now and then.
    // Walking, a bike, a scooter — under 18 (measured on Batumi's ones).
    if (median > MAX_SPEED_KMH || fast > 35) vehicleSequences.add(seq)
  }
}
// Good enough to show a player: sharp, recent, wide (by what Mapillary
// says), at the water, on foot. (Inside its sector is checked on the way in.)
function good(x) {
  const img = x.img
  if ((img.quality_score ?? 0) < MIN_QUALITY) return false
  if (!img.captured_at || img.captured_at < SINCE) return false
  if ((img.width ?? 0) < MIN_WIDTH) return false
  if (vehicleSequences.has(img.sequence)) return false
  return metresToWater(x.lat, x.lng) <= MAX_WATER_M
}
// …and by the picture: the mean brightness (0–255) of a small copy — dusk
// and night shots out.
async function lightEnough(id) {
  const res = await fetch(`https://graph.mapillary.com/${id}?fields=thumb_256_url`, { headers: { Authorization: `OAuth ${TOKEN}` }, signal: AbortSignal.timeout(20_000) })
  const url = (await res.json()).thumb_256_url
  if (!url) return false
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const { channels } = await sharp(buf).stats()
  const light = 0.299 * channels[0].mean + 0.587 * channels[1].mean + 0.114 * channels[2].mean
  return light >= MIN_LIGHT
}
// Batumi's coast in stretches, for a sample that isn't all one beach.
function stretch(lat) {
  if (city !== 'batumi') return 'all'
  return lat < 41.6 ? 'gonio' : lat < 41.69 ? 'batumi' : lat < 41.78 ? 'chakvi' : 'kobuleti'
}
const PER_SECTOR = Number(flag('per-sector') ?? 8)
const LIMIT = Number(flag('limit') ?? Infinity)
const KINDS = (flag('kinds') ?? 'sea,river,lake,pond').split(',')
// Two panoramas from one sector at least this far apart, so they show
// different views.
const MIN_GAP_M = Number(flag('gap') ?? 50)
// A sector is a 600 m hex: inradius 300 m, circumradius ~346 m.
const SECTOR_R_M = 346

const TOKEN = process.env.MAPILLARY_TOKEN
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
if (!TOKEN) throw new Error('MAPILLARY_TOKEN is missing')

// The first step's output: the pictures, and a row for geo_panoramas each.
const OUT_DIR = new URL(`./.cache/geo-${city}/`, import.meta.url)
const MANIFEST = new URL('manifest.json', OUT_DIR)
async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'))
  } catch {
    return []
  }
}

function distanceM(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)))
}

async function waterSectors() {
  const prefix = city === 'moscow' ? 'M' : 'B'
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('territories')
      .select('id, kind, lat, lng')
      .like('id', `${prefix}%`)
      .eq('is_deleted', false)
      .in('kind', KINDS)
      .lte('lat', MAX_LAT)
      .range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) break
  }
  return ONLY ? rows.filter((r) => ONLY.includes(r.id)) : rows
}

// Listing asks only for what picking needs — with picture URLs in it,
// Mapillary answered dense central Moscow with 500s. The pictures of the
// panoramas actually taken are asked for one by one (pictureOf).
const FIELDS = 'id,computed_geometry,geometry,captured_at,compass_angle,computed_compass_angle,creator,quality_score,width,camera_type,sequence'
const PAGE = 1000

async function listBox(bbox) {
  for (let attempt = 0; ; attempt++) {
    // A request Mapillary never answers would hang the run — 20 s, then retry.
    const res = await fetch(`https://graph.mapillary.com/images?fields=${FIELDS}&is_pano=true&bbox=${bbox.map((x) => x.toFixed(6)).join(',')}&limit=${PAGE}`, {
      headers: { Authorization: `OAuth ${TOKEN}` },
      signal: AbortSignal.timeout(20_000),
    }).catch((e) => ({ ok: false, status: e.name === 'TimeoutError' ? 'timeout' : 'network' }))
    if (res.ok) return (await res.json()).data ?? []
    // «Please reduce the amount of data» — the box has too many pictures
    // (of any kind) for Mapillary: asking again won't help, splitting will.
    if (res.status === 500) {
      const body = await res.text().catch(() => '')
      if (body.includes('reduce the amount')) return null
    }
    if (attempt >= 2) return null
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
  }
}

// A box Mapillary can't answer, or answers with a full page (there may be
// more), is split in four — down to a sector's sixteenth (--depth=2); dense
// central Moscow needs boxes of ~40 m (--depth=4).
let lostBoxes = 0
async function listAll(bbox, depth = 0) {
  // A small box with no water within reach can't hold a panorama we'd take —
  // not asked at all. (Only small ones: metresToWater looks ~170 m around.)
  if (depth >= 3) {
    const [w, s, e, n] = bbox
    const halfDiag = distanceM(s, w, n, e) / 2
    if (metresToWater((s + n) / 2, (w + e) / 2) > MAX_WATER_M + halfDiag) return []
  }
  const found = await listBox(bbox)
  if (found && (found.length < PAGE || depth >= MAX_DEPTH)) return found
  // Still too much at the smallest box: that spot is left out, the rest of
  // the sector is kept.
  if (!found && depth >= MAX_DEPTH) {
    lostBoxes++
    return []
  }
  const [w, s, e, n] = bbox
  const mx = (w + e) / 2
  const my = (s + n) / 2
  const parts = []
  // One by one inside a sector: sixty-four boxes at once is a burst Mapillary
  // answers with more errors.
  for (const b of [
    [w, s, mx, my],
    [mx, s, e, my],
    [w, my, mx, n],
    [mx, my, e, n],
  ]) parts.push(await listAll(b, depth + 1))
  return parts.flat()
}

async function panoramasNear(sector) {
  const dLat = SECTOR_R_M / 111195
  const dLng = SECTOR_R_M / (111195 * Math.cos((sector.lat * Math.PI) / 180))
  return listAll([sector.lng - dLng, sector.lat - dLat, sector.lng + dLng, sector.lat + dLat])
}

async function pictureOf(id) {
  const res = await fetch(`https://graph.mapillary.com/${id}?fields=thumb_original_url,thumb_2048_url`, { headers: { Authorization: `OAuth ${TOKEN}` }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`picture ${res.status}`)
  const d = await res.json()
  return d.thumb_original_url ?? d.thumb_2048_url
}

function point(img) {
  const [lng, lat] = (img.computed_geometry ?? img.geometry).coordinates
  return { lat, lng }
}

async function pool(items, size, fn) {
  let next = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++
        await fn(items[i], i)
      }
    })
  )
}

async function main() {
  const sectors = await waterSectors()
  console.log(`${city}: ${sectors.length} water sectors (${KINDS.join(', ')})`)

  // Every panorama goes to the nearest water sector's centre, within a
  // sector's reach — the hex grid is exactly that (nearest centre).
  const byId = new Map()
  let done = 0
  // A sector Mapillary keeps failing on is skipped, not the whole run.
  const failed = []
  await pool(sectors, 6, async (sector) => {
    let found = []
    try {
      found = await panoramasNear(sector)
    } catch (e) {
      failed.push(sector.id)
      console.log(`  skip ${sector.id}: ${e.message ?? e}`)
    }
    // A panorama belongs to the sector whose hexagon it's inside — well
    // inside: the right answer must be this sector and no other.
    const hex = hexOf(sector)
    for (const img of found) {
      const p = point(img)
      if (insideWithMargin(p.lat, p.lng, hex, EDGE_M)) byId.set(img.id, { img, sector, ...p })
    }
    if (++done % 100 === 0) console.log(`  …${done}/${sectors.length}`)
  })

  const all = [...byId.values()]
  const kinds = {}
  for (const x of all) {
    const k = (kinds[x.sector.kind] ??= { panoramas: 0, sectors: new Set(), recent: 0 })
    k.panoramas++
    k.sectors.add(x.sector.id)
    if (x.img.captured_at && x.img.captured_at >= Date.parse('2021-01-01')) k.recent++
  }
  console.log('\nPanoramas inside water sectors:')
  for (const [kind, k] of Object.entries(kinds)) {
    console.log(`  ${kind.padEnd(6)} ${String(k.panoramas).padStart(6)} panoramas · ${k.sectors.size} sectors · ${k.recent} since 2021`)
  }
  console.log(`  total  ${all.length} panoramas · ${new Set(all.map((x) => x.sector.id)).size} sectors`)
  if (failed.length) console.log(`  not checked (Mapillary errors): ${failed.length} sectors — ${failed.join(', ')}`)
  if (lostBoxes) console.log(`  spots Mapillary couldn't answer even at the smallest box: ${lostBoxes}`)
  findVehicles(all)
  const goodOnes = all.filter((x) => good(x))
  const inCar = all.filter((x) => vehicleSequences.has(x.img.sequence)).length
  const farFromWater = all.filter((x) => metresToWater(x.lat, x.lng) > MAX_WATER_M).length
  console.log(`  shot from a car/bike: ${inCar} · further than ${MAX_WATER_M} m from the water: ${farFromWater}`)
  console.log(`  good (quality ≥ ${MIN_QUALITY}, since ${new Date(SINCE).getFullYear()}, ≥ ${MIN_WIDTH}px, ≤ ${MAX_WATER_M} m from water, on foot, ≥ ${EDGE_M} m inside the sector): ${goodOnes.length} panoramas · ${new Set(goodOnes.map((x) => x.sector.id)).size} sectors`)
  if (SAMPLE) {
    // One per sector, at most --per-stretch (4) per stretch of coast, light enough.
    const picks = []
    const usedSector = new Set()
    const perStretch = {}
    for (const x of goodOnes.sort(() => Math.random() - 0.5)) {
      if (picks.length >= SAMPLE) break
      const st = stretch(x.lat)
      if (usedSector.has(x.sector.id) || (perStretch[st] ?? 0) >= Number(flag('per-stretch') ?? 4)) continue
      if (!(await lightEnough(x.img.id))) continue
      usedSector.add(x.sector.id)
      perStretch[st] = (perStretch[st] ?? 0) + 1
      picks.push(x)
    }
    const out = []
    for (const x of picks) {
      const res = await fetch(`https://graph.mapillary.com/${x.img.id}?fields=thumb_1024_url,make,model`, { headers: { Authorization: `OAuth ${TOKEN}` } })
      const d = await res.json()
      out.push({ id: x.img.id, sector: x.sector.id, kind: x.sector.kind, lat: x.lat, lng: x.lng, quality: x.img.quality_score, width: x.img.width, captured: new Date(x.img.captured_at).toISOString().slice(0, 10), stretch: stretch(x.lat), water: Math.round(metresToWater(x.lat, x.lng)), author: x.img.creator?.username, camera: `${d.make ?? ''} ${d.model ?? ''}`.trim(), thumb: d.thumb_1024_url })
    }
    await writeFile(SAMPLE_OUT, JSON.stringify(out, null, 1))
    console.log(`Sample of ${out.length} → ${SAMPLE_OUT}`)
    return
  }
  if (STATS) {
    const per = new Map()
    for (const x of all) {
      const e = per.get(x.sector.id) ?? { id: x.sector.id, kind: x.sector.kind, lat: x.sector.lat, lng: x.sector.lng, panoramas: 0, newest: 0 }
      e.panoramas++
      e.newest = Math.max(e.newest, x.img.captured_at ?? 0)
      per.set(x.sector.id, e)
    }
    await writeFile(STATS, JSON.stringify([...per.values()].sort((a, b) => b.panoramas - a.panoramas), null, 1))
    console.log(`Per-sector stats → ${STATS}`)
  }
  if (DRY) return

  // Up to PER_SECTOR per sector: the best first (Mapillary's quality, then
  // the newest), spread apart.
  const manifest = await readManifest()
  const have = new Set(manifest.map((r) => r.source_id))
  const perSector = new Map()
  for (const r of manifest) perSector.set(r.territory_id, (perSector.get(r.territory_id) ?? 0) + 1)

  const bySector = new Map()
  for (const x of goodOnes) {
    if (have.has(x.img.id)) continue
    bySector.set(x.sector.id, [...(bySector.get(x.sector.id) ?? []), x])
  }
  const picks = []
  for (const [sectorId, list] of bySector) {
    list.sort((a, b) => (b.img.quality_score ?? 0) - (a.img.quality_score ?? 0) || (b.img.captured_at ?? 0) - (a.img.captured_at ?? 0))
    const chosen = manifest.filter((r) => r.territory_id === sectorId)
    for (const x of list) {
      if (chosen.length >= PER_SECTOR) break
      if (chosen.some((c) => distanceM(c.lat, c.lng, x.lat, x.lng) < MIN_GAP_M)) continue
      chosen.push(x)
      picks.push(x)
    }
  }
  const batch = picks.slice(0, LIMIT)
  console.log(`\nPreparing ${batch.length} panoramas in ${new Set(batch.map((x) => x.sector.id)).size} sectors…`)

  await mkdir(OUT_DIR, { recursive: true })
  let added = 0
  await pool(batch, 3, async (x) => {
    try {
      if (!(await lightEnough(x.img.id))) throw new Error('too dark')
      const src = await fetch(await pictureOf(x.img.id), { signal: AbortSignal.timeout(90_000) })
      if (!src.ok) throw new Error(`download ${src.status}`)
      const buf = Buffer.from(await src.arrayBuffer())
      const name = randomUUID()
      await sharp(buf).resize(4096, 2048, { fit: 'fill' }).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(fileURLToPath(new URL(`${name}.jpg`, OUT_DIR)))
      await sharp(buf).resize(1024, 512, { fit: 'fill' }).jpeg({ quality: 72, progressive: true, mozjpeg: true }).toFile(fileURLToPath(new URL(`${name}_s.jpg`, OUT_DIR)))
      const compass = x.img.computed_compass_angle || x.img.compass_angle || 0
      manifest.push({
        city,
        lat: x.lat,
        lng: x.lng,
        territory_id: x.sector.id,
        image_path: `${name}.jpg`,
        north: ((-compass % 360) + 540) % 360 - 180,
        source: 'mapillary',
        source_id: x.img.id,
        author: x.img.creator?.username ?? null,
        captured_at: x.img.captured_at ? new Date(x.img.captured_at).toISOString() : null,
        quality: x.img.quality_score ?? null,
        water_m: Math.round(metresToWater(x.lat, x.lng)),
      })
      // Written as it goes: a run cut short keeps what it did.
      await writeFile(MANIFEST, JSON.stringify(manifest, null, 1))
      added++
      if (added % 10 === 0) console.log(`  …${added}/${batch.length}`)
    } catch (e) {
      console.log(`  skip ${x.img.id} (${x.sector.id}): ${e.message ?? e}`)
    }
  })
  console.log(`Prepared ${added} panoramas (${manifest.length} in ${fileURLToPath(MANIFEST)}). Next: --upload`)
}

// Second step: what the manifest has and the base hasn't → the bucket and
// geo_panoramas, as 'pending'.
async function upload() {
  const manifest = await readManifest()
  if (!manifest.length) throw new Error(`nothing prepared for ${city} — run without --upload first`)
  const { data: existing, error } = await supabase.from('geo_panoramas').select('source_id').eq('source', 'mapillary')
  if (error) throw error
  const have = new Set(existing.map((r) => r.source_id))
  const todo = manifest.filter((r) => !have.has(r.source_id))
  console.log(`${city}: ${todo.length} of ${manifest.length} prepared panoramas to upload`)
  let added = 0
  await pool(todo, 4, async (row) => {
    try {
      const small = row.image_path.replace(/\.jpg$/, '_s.jpg')
      for (const path of [row.image_path, small]) {
        const body = await readFile(new URL(path, OUT_DIR))
        const { error: upErr } = await supabase.storage.from('geo-panoramas').upload(path, body, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: true })
        if (upErr) throw upErr
      }
      const { error: insErr } = await supabase.from('geo_panoramas').insert(row)
      if (insErr) throw insErr
      added++
      if (added % 20 === 0) console.log(`  …${added}/${todo.length}`)
    } catch (e) {
      console.log(`  skip ${row.source_id} (${row.territory_id}): ${e.message ?? e}`)
    }
  })
  console.log(`Added ${added} panoramas to check.`)
}

(UPLOAD ? upload() : main()).catch((e) => {
  console.error(e)
  process.exit(1)
})
