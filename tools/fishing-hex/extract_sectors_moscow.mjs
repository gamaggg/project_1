// Тот же формат, что extract_sectors.mjs — только для Москвы, и пишет прямо
// в web/public/data/sectors.json как ДОБАВКУ к батумским секторам (не замену).
// Только core:true, как и для Батуми — второй ряд у рек в само приложение
// никогда не попадает, это вспомогательная штука только для превью-карты.
import fs from 'fs';

const hex = JSON.parse(fs.readFileSync('hex_moscow.geojson', 'utf8'));
const existingPath = '../../web/public/data/sectors.json';
const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
const existingIds = new Set(existing.map((s) => s.id));

const moscow = hex.features
  .filter((f) => f.properties.core)
  .map((f) => {
    const ring = f.geometry.coordinates[0];
    const uniq = ring.slice(0, -1);
    const corners = uniq.map(([lon, lat]) => [lat, lon]);
    const lat = corners.reduce((s, c) => s + c[0], 0) / corners.length;
    const lng = corners.reduce((s, c) => s + c[1], 0) / corners.length;
    return { id: f.properties.id, kind: f.properties.kind, lat: +lat.toFixed(6), lng: +lng.toFixed(6), corners };
  });

const dupes = moscow.filter((s) => existingIds.has(s.id));
if (dupes.length) {
  console.error('id conflicts with existing sectors.json, aborting:', dupes.map((d) => d.id));
  process.exit(1);
}

const merged = [...existing, ...moscow];
fs.writeFileSync(existingPath, JSON.stringify(merged));

const byKind = {};
for (const s of moscow) byKind[s.kind] = (byKind[s.kind] || 0) + 1;
console.log('added', moscow.length, 'moscow sectors', byKind, '- total sectors.json now:', merged.length);
