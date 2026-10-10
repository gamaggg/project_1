// «Где это?»: the water line of a city from OpenStreetMap — the sea's
// coastline, rivers, and the edges of water areas (river beds, lakes,
// ponds) — as plain polylines, for geo-import.mjs to keep only panoramas
// taken within a few dozen metres of the water.
//
//   node scripts/geo-water.mjs batumi   → scripts/.cache/water-batumi.json
//
// Streams are left out: a panorama by a ditch isn't a shore.

import { mkdir, readFile, writeFile } from 'node:fs/promises'

const city = process.argv[2] === 'moscow' ? 'moscow' : 'batumi'
// south, west, north, east — Batumi's whole coast up to Kobuleti (the far
// north, Ureki and Grigoleti, isn't played); Moscow inside the MKAD.
const BBOX = city === 'moscow' ? [55.5718, 37.3688, 55.9111, 37.8435] : [41.48, 41.5, 41.9, 41.85]

// Moscow is too much for one Overpass request (504s) — asked tile by tile,
// on another mirror when one is busy.
const TILES = city === 'moscow' ? 4 : 1
const MIRRORS = ['https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

async function fetchTile(bbox) {
  const box = bbox.map((x) => x.toFixed(5)).join(',')
  // out geom(bbox): only the part of a long river or a big lake inside the
  // tile — the whole Moskva would come back with every tile otherwise.
  const query = `[out:json][timeout:180];
(
  way["natural"="coastline"](${box});
  way["waterway"~"^(river|canal)$"](${box});
  way["natural"="water"](${box});
  relation["natural"="water"](${box});
);
out geom(${box});`
  for (let attempt = 0; attempt < 15; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length]
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'range-geo/0.1 (catchrange.com)' },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(200_000),
    }).catch((e) => ({ ok: false, status: e.name }))
    if (res.ok) return (await res.json()).elements
    console.log(`  ${url.split('/')[2]}: ${res.status}, retrying`)
    await new Promise((r) => setTimeout(r, 4000 * Math.min(attempt + 1, 6)))
  }
  throw new Error(`overpass keeps failing on ${box}`)
}

const [south, west, north, east] = BBOX
const elements = new Map()
for (let i = 0; i < TILES; i++) {
  for (let j = 0; j < TILES; j++) {
    const tile = [
      south + ((north - south) * i) / TILES,
      west + ((east - west) * j) / TILES,
      south + ((north - south) * (i + 1)) / TILES,
      west + ((east - west) * (j + 1)) / TILES,
    ]
    // Each tile is kept on disk as it comes: a run Overpass cuts short
    // picks up where it stopped.
    const tileFile = new URL(`./.cache/water-${city}-tile-${TILES}-${i}-${j}.json`, import.meta.url)
    let got
    try {
      got = JSON.parse(await readFile(tileFile, 'utf8'))
    } catch {
      got = await fetchTile(tile)
      await mkdir(new URL('./.cache/', import.meta.url), { recursive: true })
      await writeFile(tileFile, JSON.stringify(got))
    }
    // A way crossing tiles comes back from each, cut to the tile — every
    // piece is kept.
    for (const el of got) elements.set(`${el.type}/${el.id}/${i}:${j}`, el)
    if (TILES > 1) console.log(`  tile ${i * TILES + j + 1}/${TILES * TILES}: ${elements.size} so far`)
  }
}

// A clipped geometry has nulls where it leaves the tile — split there.
function pieces(geometry) {
  const out = [[]]
  for (const p of geometry) {
    if (!p) {
      if (out.at(-1).length) out.push([])
      continue
    }
    out.at(-1).push([Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6))])
  }
  return out.filter((l) => l.length > 1)
}

const lines = []
for (const el of elements.values()) {
  if (el.type === 'way' && el.geometry) lines.push(...pieces(el.geometry))
  if (el.type === 'relation') {
    for (const m of el.members ?? []) {
      if (m.geometry) lines.push(...pieces(m.geometry))
    }
  }
}
await mkdir(new URL('./.cache/', import.meta.url), { recursive: true })
const out = new URL(`./.cache/water-${city}.json`, import.meta.url)
await writeFile(out, JSON.stringify(lines))
console.log(`${city}: ${lines.length} water lines, ${lines.reduce((n, l) => n + l.length, 0)} points → ${out.pathname}`)
