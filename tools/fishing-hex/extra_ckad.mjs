// Контекст для карты moscow_ckad: кольца МКАД и ЦКАД (чёрные линии) и ВСЕ живые сектора Москвы, что уже
// в базе (серые, existing_moscow.json из dedupe_ckad.mjs).
import fs from 'fs';
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).features;
const feats = [];
for (const f of rd('mkad_ring.geojson')) feats.push({ type: 'Feature', properties: { role: 'ring' }, geometry: f.geometry });
for (const f of rd('ckad_hole.geojson')) feats.push({ type: 'Feature', properties: { role: 'ring' }, geometry: f.geometry });
// радиусы соты Москвы в градусах (как rx, ry у hexCorners в web/lib/data/hexGrid.ts)
const rx = 0.005534175, ry = 0.003115337;
for (const r of JSON.parse(fs.readFileSync('existing_moscow.json', 'utf8'))) {
  if (r.is_deleted) continue;
  const ring = [];
  for (let i = 0; i <= 6; i++) { const a = (Math.PI / 3) * (i % 6); ring.push([+(r.lng + rx * Math.cos(a)).toFixed(6), +(r.lat + ry * Math.sin(a)).toFixed(6)]); }
  feats.push({ type: 'Feature', properties: { role: 'old', id: r.id }, geometry: { type: 'Polygon', coordinates: [ring] } });
}
fs.writeFileSync('extra_moscow_ckad.geojson', JSON.stringify({ type: 'FeatureCollection', features: feats }));
