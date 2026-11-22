// Город и окрестности: граница города (boundary_<src>.geojson из make_boundary.mjs), расширенная
// на N км во все стороны. Пишет boundary_<dst>.geojson и печатает рамку для cities.mjs и hexGrid.ts.
// Необязательный четвёртый аргумент — граница страны (boundary_<clip>.geojson): буфер режется по ней,
// чтобы город не уходил за границу (Ереван: до Турции около 30 км).
// Запуск: node make_buffer.mjs kazan_city kazan 30
//         node make_buffer.mjs yerevan_city yerevan 30 armenia
import fs from 'fs';
import * as turf from '@turf/turf';

const [src, dst, km, clip] = process.argv.slice(2);
if (!src || !dst || !km) { console.error('usage: node make_buffer.mjs <src> <dst> <km>'); process.exit(1); }
const fc = JSON.parse(fs.readFileSync(`boundary_${src}.geojson`, 'utf8'));
let u = fc.features[0];
for (const f of fc.features.slice(1)) u = turf.union(turf.featureCollection([u, f])) ?? u;
let buf = turf.simplify(turf.buffer(u, +km, { units: 'kilometers', steps: 16 }), { tolerance: 0.001, highQuality: false });
if (clip) {
  const country = JSON.parse(fs.readFileSync(`boundary_${clip}.geojson`, 'utf8')).features;
  let c = country[0];
  for (const f of country.slice(1)) c = turf.union(turf.featureCollection([c, f])) ?? c;
  buf = turf.intersect(turf.featureCollection([buf, turf.simplify(c, { tolerance: 0.0005 })]));
}
const polys = buf.geometry.type === 'MultiPolygon' ? buf.geometry.coordinates : [buf.geometry.coordinates];
const features = polys.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c[0]] } })).filter((f) => turf.area(f) > 1e6);
fs.writeFileSync(`boundary_${dst}.geojson`, JSON.stringify({ type: 'FeatureCollection', features }));
const [w, s, e, n] = turf.bbox(buf);
const r = (x, f) => +(f(x * 100) / 100).toFixed(2);
console.log(dst, 'polygons:', features.length, 'bbox:', JSON.stringify({ s: r(s, Math.floor), w: r(w, Math.floor), n: r(n, Math.ceil), e: r(e, Math.ceil) }));
