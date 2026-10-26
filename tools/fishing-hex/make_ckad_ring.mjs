// Шаг 1б: из дорог ЦКАД (osm_ckad_ways.json) делает полигон «внутри ЦКАД» -> ckad_ring.geojson.
// Дороги разбиты на сотни кусков и по две проезжие части, поэтому не сшиваем, а склеиваем их буферы
// (150 м закрывают мелкие разрывы) и берём внешнюю границу объединения с заполненной серединой.
import fs from 'fs';
import * as turf from '@turf/turf';

const ways = JSON.parse(fs.readFileSync('osm_ckad_ways.json', 'utf8')).elements.filter((e) => e.geometry && e.geometry.length > 1);
let acc = null;
const bufs = ways.map((w) => turf.buffer(turf.lineString(w.geometry.map((g) => [g.lon, g.lat])), 0.15, { units: 'kilometers' }));
// объединяем пачками, чтобы не держать огромный union одним вызовом
for (let i = 0; i < bufs.length; i += 50) {
  const part = bufs.slice(i, i + 50).reduce((a, b) => (a ? turf.union(turf.featureCollection([a, b])) : b), null);
  acc = acc ? turf.union(turf.featureCollection([acc, part])) : part;
}
const polys = acc.geometry.type === 'Polygon' ? [acc.geometry.coordinates] : acc.geometry.coordinates;
console.log('polygons:', polys.length, 'holes of the biggest:', polys.map((p) => p.length - 1));
// самый большой полигон -> его внешнее кольцо (дыры внутри = внутренность кольца)
const biggest = polys.map((p) => turf.polygon([p[0]])).sort((a, b) => turf.area(b) - turf.area(a))[0];
console.log('outer area km2:', (turf.area(biggest) / 1e6).toFixed(0));
// Внутренняя граница объединения: самая большая дыра = то, что внутри кольца
const holes = polys.flatMap((p) => p.slice(1)).map((h) => turf.polygon([h])).sort((a, b) => turf.area(b) - turf.area(a));
console.log('biggest hole km2:', holes[0] ? (turf.area(holes[0]) / 1e6).toFixed(0) : null, 'holes:', holes.length);
fs.writeFileSync('ckad_ring.geojson', JSON.stringify(turf.featureCollection([biggest])));
fs.writeFileSync('ckad_hole.geojson', JSON.stringify(turf.featureCollection(holes.slice(0, 1))));
console.log('bbox', turf.bbox(biggest));
