// Сверка новых сот moscow_ckad с секторами Москвы, что уже в базе (читает territories публичным ключом, только чтение).
// Выход: existing_moscow.json (id, lat, lng, is_deleted) и отчёт о совпадениях.
import fs from 'fs';
import * as turf from '@turf/turf';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const rows = [];
for (let from = 0; ; from += 1000) {
  const r = await fetch(`${url}/rest/v1/territories?select=id,lat,lng,is_deleted&id=like.M*&order=id&offset=${from}&limit=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const part = await r.json();
  if (!Array.isArray(part)) { console.error(part); process.exit(1); }
  rows.push(...part);
  if (part.length < 1000) break;
}
fs.writeFileSync('existing_moscow.json', JSON.stringify(rows));
console.log('из базы:', rows.length, 'удалённых:', rows.filter((r) => r.is_deleted).length);
const hex = JSON.parse(fs.readFileSync('hex_moscow_ckad.geojson', 'utf8')).features;
const centerOf = (f) => { const r = f.geometry.coordinates[0].slice(0, 6); return [r.reduce((a, p) => a + p[0], 0) / 6, r.reduce((a, p) => a + p[1], 0) / 6]; };
const key2 = (lng, lat) => `${Math.round(lng * 20000)}:${Math.round(lat * 20000)}`; // ~5 м
const have = new Map(rows.map((r) => [key2(r.lng, r.lat), r]));
let same = 0, sameDeleted = 0, near = 0;
const dup = [];
for (const f of hex) {
  const [x, y] = centerOf(f);
  const hit = have.get(key2(x, y));
  if (hit) { hit.is_deleted ? sameDeleted++ : same++; dup.push(f.properties.id); continue; }
  // сота соседнего положения (центры ближе 400 м) = наложение с другой фазой сетки
  if (rows.some((r) => !r.is_deleted && Math.abs(r.lat - y) < 0.004 && Math.abs(r.lng - x) < 0.006 && turf.distance([x, y], [r.lng, r.lat], { units: 'meters' }) < 400)) near++;
}
console.log({ новых_сот: hex.length, совпали_с_живыми: same, совпали_с_удалёнными: sameDeleted, наложение_другой_фазой: near });
fs.writeFileSync('dup_moscow_ckad.json', JSON.stringify(dup));
