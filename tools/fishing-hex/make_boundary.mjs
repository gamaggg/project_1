// Тянет из Overpass границу города (OSM relation) и пишет boundary_<город>.geojson —
// build_hex_city.mjs режет соты по этому полигону (у Москвы так работает кольцо МКАД).
// Запуск: node make_boundary.mjs spb 337422
//         node make_boundary.mjs tbilisi 1996871
import fs from 'fs';

const [city, relId] = process.argv.slice(2);
if (!city || !relId) { console.error('usage: node make_boundary.mjs <city> <relation id>'); process.exit(1); }

const query = `[out:json][timeout:120];relation(${relId});out geom;`;
let osm = null;
for (let t = 0; t < 5 && !osm; t++) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': 'fishing-hex/0.1', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  const text = await res.text();
  if (text.trim().startsWith('{')) osm = JSON.parse(text);
  else { console.error('Overpass busy, retry', t + 1); await new Promise((r) => setTimeout(r, 30000)); }
}
if (!osm) { console.error('no answer'); process.exit(1); }

// Внешние линии границы -> замкнутые кольца (сшиваем по концам).
const segs = osm.elements[0].members
  .filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry)
  .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const used = new Set();
const rings = [];
for (let i = 0; i < segs.length; i++) {
  if (used.has(i)) continue;
  used.add(i);
  const ring = [...segs[i]];
  let guard = 0;
  while (guard++ < 5000 && !same(ring[0], ring[ring.length - 1])) {
    const end = ring[ring.length - 1];
    let found = false;
    for (let j = 0; j < segs.length; j++) {
      if (used.has(j)) continue;
      const s = segs[j];
      if (same(s[0], end)) { ring.push(...s.slice(1)); used.add(j); found = true; break; }
      if (same(s[s.length - 1], end)) { ring.push(...[...s].reverse().slice(1)); used.add(j); found = true; break; }
    }
    if (!found) break;
  }
  if (ring.length > 3 && same(ring[0], ring[ring.length - 1])) rings.push(ring);
}
console.log(city, 'rings:', rings.length, 'points:', rings.map((r) => r.length));
// Один полигон на кольцо (у Петербурга есть острова: Кронштадт и др.).
const features = rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [r] } }));
fs.writeFileSync(`boundary_${city}.geojson`, JSON.stringify({ type: 'FeatureCollection', features }));
