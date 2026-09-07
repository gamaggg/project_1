// Шаг 2. Режем воду на соты.
//
// Вход:  osm.json  (ответ Overpass, см. fetch_osm.sh)
// Выход: hex.geojson   соты, которые касаются воды
//        water.geojson геометрия воды для отрисовки поверх карты
//
// Идея: строим правильную гексагональную сетку на весь bbox, потом для каждой
// соты проверяем, пересекает ли она какую-нибудь воду. Если да, сота попадает
// в результат с типом воды. Всё остальное выбрасываем.
//
// Запуск: node build_hex.mjs

import fs from 'fs';
import * as turf from '@turf/turf';

// ---------- настройки ----------

// Тот же bbox, что в fetch_osm.sh, но в порядке [юг, запад, север, восток].
const BBOX = { s: 41.48, w: 41.50, n: 41.72, e: 41.80 };

// Ширина соты «от грани до грани», в метрах.
const WIDTH_M = 600;

// Нужен ли второй ряд сот вокруг речных сот (соседи в один шаг).
// Соты второго ряда помечаются core:false, на карте их можно выключить.
const RING_AROUND = ['river'];

// Если сота касается воды нескольких типов, берём первый по этому списку.
const PRIORITY = ['river', 'sea', 'lake', 'stream'];

// ---------- разбор OSM ----------

const osm = JSON.parse(fs.readFileSync('osm.json', 'utf8'));

// Узлы и линии OSM по id. Полигоны и линии в OSM ссылаются на узлы по id.
const nodes = new Map();
const ways = new Map();
for (const el of osm.elements) {
  if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
  if (el.type === 'way') ways.set(el.id, el);
}

const coordsOf = (way) => way.nodes.map((id) => nodes.get(id)).filter(Boolean);
const inBox = ([lon, lat]) => lat >= BBOX.s && lat <= BBOX.n && lon >= BBOX.w && lon <= BBOX.e;
const round = (coords) => coords.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]);

// Overpass возвращает линию целиком, даже если она выходит за bbox.
// Режем её на куски, которые внутри bbox, чтобы не считать лишнее.
function clipToBox(coords) {
  const parts = [];
  let cur = [];
  for (const c of coords) {
    if (inBox(c)) cur.push(c);
    else { if (cur.length > 1) parts.push(cur); cur = []; }
  }
  if (cur.length > 1) parts.push(cur);
  return parts;
}

// Мультиполигоны воды в OSM (relation) состоят из нескольких линий (way),
// которые надо сшить в замкнутые кольца по совпадающим концам.
function ringsFromWays(wayIds) {
  const segs = wayIds.map((id) => ways.get(id)).filter(Boolean).map(coordsOf).filter((c) => c.length > 1);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const rings = [];
  const used = new Set();
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const ring = [...segs[i]];
    let guard = 0;
    while (guard++ < 1000 && !same(ring[0], ring[ring.length - 1])) {
      const end = ring[ring.length - 1];
      let found = false;
      for (let j = 0; j < segs.length; j++) {
        if (used.has(j)) continue;
        const s = segs[j];
        if (same(s[0], end)) { ring.push(...s.slice(1)); used.add(j); found = true; break; }
        if (same(s[s.length - 1], end)) { ring.push(...s.slice(0, -1).reverse()); used.add(j); found = true; break; }
      }
      if (!found) break; // кольцо не замкнулось, бросаем
    }
    if (ring.length > 3 && same(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

// Геометрия воды по типам. Каждый элемент это turf Feature (LineString или Polygon).
const water = { sea: [], river: [], stream: [], lake: [] };
// То же самое, но в виде GeoJSON для отрисовки на карте.
const waterForMap = [];

// Береговая линия моря.
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || el.tags.natural !== 'coastline') continue;
  for (const seg of clipToBox(coordsOf(el))) {
    water.sea.push(turf.lineString(seg));
    waterForMap.push({ type: 'Feature', properties: { kind: 'sea' }, geometry: { type: 'LineString', coordinates: round(seg) } });
  }
}

// Реки, ручьи, каналы: осевые линии.
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || !el.tags.waterway) continue;
  const kind = el.tags.waterway === 'river' ? 'river' : 'stream';
  for (const seg of clipToBox(coordsOf(el))) {
    water[kind].push(turf.lineString(seg));
    waterForMap.push({ type: 'Feature', properties: { kind, name: el.tags.name || '' }, geometry: { type: 'LineString', coordinates: round(seg) } });
  }
}

// Полигоны воды. water=river / oxbow / canal считаем рекой (это русла и старицы),
// всё остальное (lake, pond, reservoir, без тега) считаем озером.
function addPolygon(ring, tags) {
  let poly;
  try { poly = turf.polygon([ring]); if (turf.area(poly) < 50) return; } catch { return; }
  const w = tags.water || '';
  const kind = (w === 'river' || w === 'oxbow' || w === 'canal') ? 'river' : 'lake';
  water[kind].push(poly);
  waterForMap.push({ type: 'Feature', properties: { kind: kind + 'poly', water: w, name: tags.name || '' }, geometry: { type: 'Polygon', coordinates: [round(ring)] } });
}
const partOfRelation = new Set();
for (const el of osm.elements) {
  if (el.type === 'relation' && el.tags && el.tags.natural === 'water') for (const m of el.members) partOfRelation.add(m.ref);
}
for (const el of osm.elements) {
  if (!el.tags || el.tags.natural !== 'water') continue;
  if (el.type === 'way' && !partOfRelation.has(el.id)) {
    const c = coordsOf(el);
    const closed = c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
    if (closed) addPolygon(c, el.tags);
  }
  if (el.type === 'relation') {
    const outer = el.members.filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === '')).map((m) => m.ref);
    for (const ring of ringsFromWays(outer)) addPolygon(ring, el.tags);
  }
}
console.error('вода:', Object.fromEntries(Object.entries(water).map(([k, v]) => [k, v.length])));

// ---------- сетка ----------

// turf.hexGrid принимает cellSide, это радиус описанной окружности (он же ребро).
// Ширина соты от грани до грани = ребро * sqrt(3), отсюда пересчёт.
const side = WIDTH_M / Math.sqrt(3);
const grid = turf.hexGrid([BBOX.w - 0.01, BBOX.s - 0.01, BBOX.e + 0.01, BBOX.n + 0.01], side, { units: 'meters' });
console.error('сот в сетке:', grid.features.length);

// Проверка пересечения сота/вода дорогая, поэтому сначала сравниваем bbox'ы.
const indexed = Object.fromEntries(Object.entries(water).map(([k, v]) => [k, v.map((g) => ({ g, bb: turf.bbox(g) }))]));
const bboxHit = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

const cells = grid.features.map((f, i) => {
  const bb = turf.bbox(f);
  const touches = {};
  for (const k of PRIORITY) touches[k] = indexed[k].some((x) => bboxHit(bb, x.bb) && turf.booleanIntersects(f, x.g));
  const kind = PRIORITY.find((k) => touches[k]) || null;
  return { f, i, center: turf.centroid(f).geometry.coordinates, touches, kind, core: !!kind };
});

// Второй ряд: соты без воды, у которых ближайшая «якорная» сота лежит в одном
// шаге сетки (расстояние между центрами примерно равно ширине соты).
const anchors = cells.filter((x) => x.core && RING_AROUND.includes(x.kind));
for (const x of cells) {
  if (x.core) continue;
  let best = null, bestD = Infinity;
  for (const a of anchors) {
    // грубое расстояние в метрах, для широты ~41.6 градус долготы это 83 км
    const d = Math.hypot((x.center[0] - a.center[0]) * 83300, (x.center[1] - a.center[1]) * 111200);
    if (d < bestD) { bestD = d; best = a; }
  }
  if (bestD < WIDTH_M * 1.15) { x.ring = true; x.kind = best.kind; }
}

// ---------- запись ----------

const features = cells.filter((x) => x.core || x.ring).map((x) => ({
  type: 'Feature',
  properties: {
    id: 'B' + String(x.i).padStart(4, '0'), // порядковый номер в сетке, стабилен при тех же настройках
    kind: x.kind,        // основной тип: sea / river / stream / lake
    core: !!x.core,      // true: касается воды, false: второй ряд
    sea: !!x.touches.sea, river: !!x.touches.river, stream: !!x.touches.stream, lake: !!x.touches.lake,
  },
  geometry: { type: 'Polygon', coordinates: [round(x.f.geometry.coordinates[0])] },
}));

fs.writeFileSync('hex.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
fs.writeFileSync('water.geojson', JSON.stringify({ type: 'FeatureCollection', features: waterForMap }));

const count = (k) => features.filter((f) => f.properties.kind === k && f.properties.core).length;
console.log(JSON.stringify({
  cells: features.length,
  core: { sea: count('sea'), river: count('river'), stream: count('stream'), lake: count('lake') },
  ring: features.filter((f) => !f.properties.core).length,
  cellAreaKm2: +(turf.area(grid.features[0]) / 1e6).toFixed(3),
}));
