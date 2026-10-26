// Шаг 2 для новых городов: режем воду на соты 600 м ТОЛЬКО ПО БЕРЕГУ, там, где можно рыбачить.
//
// Вход:  osm_<город>.json            (fetch_osm_city.mjs)
//        osm_<город>_restricted.json (там же)
//        boundary_<город>.geojson    (make_boundary.mjs, не у Сочи)
// Выход: hex_<город>.geojson       соты (id P0001…, kind: sea / river / lake / pond)
//        water_<город>.geojson     вода для отрисовки на предпросмотре
//        excluded_<город>.geojson  соты, снятые как «рыбачить нельзя» (для проверки глазами)
//
// Правила (владелец, 19.10.2026; действуют для всех городов и для будущих):
//  1. Сектор стоит у берега, а не внутри воды. Озеро или водохранилище даёт соты только по
//     береговой линии, река, которую в OSM нарисовали полигоном, — по обоим берегам. Линия-
//     «ось реки» внутри такого полигона не считается (иначе соты ляжут на середину Невы).
//  2. Только настоящая река. Не берём подземные русла (труба, коллектор, tunnel/culvert,
//     covered, layer < 0, location=underground), пересыхающие (intermittent), технические
//     каналы электростанций и орошения, реки без имени и короче 1,5 км (после склейки кусков).
//  3. Мелкие ручьи не берём совсем.
//  4. Где рыбачить нельзя — сот нет: заповедники и строгие охранные зоны, военные территории,
//     порты, аэродромы, водоёмы с fishing=no / access=no|private, бассейны, фонтаны, очистные.
//  5. На мелких островках (форты, острова меньше 1 км²) и на дамбе с автодорогой через залив
//     секторов нет: туда не добраться и рыбачить нельзя.
//  6. Виды воды как в игре: sea, river, lake, pond. Пруд — полигон меньше 10 га.
//
// Запуск: node build_hex_city.mjs <spb|sochi|tbilisi>
import fs from 'fs';
import * as turf from '@turf/turf';
import { CONFIG } from './cities.mjs';

const CITY = process.argv[2];
const CFG = CONFIG[CITY];
if (!CFG) { console.error('city:', Object.keys(CONFIG).join(' | ')); process.exit(1); }
const BBOX = CFG.bbox;
const IN = CFG.inputName ?? CITY; // файлы osm_<IN>.json
const OUT = CFG.outName ?? CITY; // файлы hex_<OUT>.geojson

const WIDTH_M = 600;
const MIN_LAKE_AREA_M2 = 20000; // меньше — дворовая лужа, если нет имени
const POND_MAX_AREA_M2 = 100000; // 10 га: меньше — пруд, больше — озеро
const MIN_RIVER_LENGTH_M = 1500; // река короче (после склейки по имени) — не река
const MIN_ISLAND_AREA_M2 = 1_000_000; // остров меньше 1 км² (форт, отмель) — сот нет
const DAM_BUFFER_M = 320; // сота ближе к дамбе с автодорогой — снимается
const PRIORITY = CFG.priority.filter((k) => k !== 'stream'); // ручьи не берём

// ---------- разбор OSM ----------

function readOsm(file) {
  const osm = JSON.parse(fs.readFileSync(file, 'utf8'));
  const nodes = new Map();
  const ways = new Map();
  for (const el of osm.elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
    if (el.type === 'way') ways.set(el.id, el);
  }
  return { osm, nodes, ways };
}
const round = (coords) => coords.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]);
const inBox = ([lon, lat]) => lat >= BBOX.s && lat <= BBOX.n && lon >= BBOX.w && lon <= BBOX.e;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// Линию режем на куски внутри рамки.
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

// Линии (way) -> замкнутые кольца: сшиваем по совпадающим концам.
function stitch(segs) {
  const rings = [];
  const used = new Set();
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
  return rings;
}

// Все замкнутые контуры элементов: закрытые линии и внешние кольца отношений.
function* polygonsOf({ osm, nodes, ways }, wanted) {
  const coordsOf = (way) => way.nodes.map((id) => nodes.get(id)).filter(Boolean);
  const partOfRelation = new Set();
  for (const el of osm.elements) {
    if (el.type === 'relation' && el.tags && wanted(el.tags)) for (const m of el.members) partOfRelation.add(m.ref);
  }
  for (const el of osm.elements) {
    if (!el.tags || !wanted(el.tags)) continue;
    if (el.type === 'way' && !partOfRelation.has(el.id)) {
      const c = coordsOf(el);
      if (c.length > 3 && same(c[0], c[c.length - 1])) yield { ring: c, tags: el.tags };
    }
    if (el.type === 'relation') {
      const outer = el.members.filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === '')).map((m) => ways.get(m.ref)).filter(Boolean).map(coordsOf).filter((c) => c.length > 1);
      for (const ring of stitch(outer)) yield { ring, tags: el.tags };
    }
  }
}

// ---------- что считать настоящей водой ----------

// Подземные и закрытые участки: труба, коллектор, тоннель, «под землёй/под водой».
function isHidden(t) {
  if (t.tunnel && t.tunnel !== 'no') return true;
  if (t.covered === 'yes' || t.culvert) return true;
  if (t.location === 'underground' || t.location === 'underwater') return true;
  if (t.layer !== undefined && parseInt(t.layer, 10) < 0) return true;
  return false;
}
// Пересыхающие, заброшенные и технические водотоки.
function isNotFishable(t) {
  if (t.intermittent === 'yes' || t.seasonal === 'yes') return true;
  if (t.fishing === 'no') return true;
  if (t.access === 'no' || t.access === 'private') return true;
  if (['headrace', 'tailrace', 'spillway', 'penstock'].includes(t.usage)) return true;
  if (['irrigation', 'drainage', 'drain'].includes(t.canal)) return true;
  return false;
}
// Реки, а у Петербурга и Тбилиси ещё и каналы: главные водотоки города.
const isRiverWay = (t) => t.waterway === 'river' || (CFG.canalAsRiver && t.waterway === 'canal');
// Полигоны воды, где рыбачить нельзя по природе места.
const BAD_WATER_TYPES = ['basin', 'reflecting_pool', 'wastewater', 'fountain', 'lock', 'stream_pool', 'moat'];

const { osm, nodes, ways } = readOsm(`osm_${IN}.json`);
const coordsOf = (way) => way.nodes.map((id) => nodes.get(id)).filter(Boolean);
const lenOf = (coords) => { try { return turf.length(turf.lineString(coords), { units: 'meters' }); } catch { return 0; } };

// Длина реки по имени (только видимые куски): короткая или безымянная «река» — не река.
const riverNameLength = new Map();
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || !isRiverWay(el.tags) || !el.tags.name || isHidden(el.tags) || isNotFishable(el.tags)) continue;
  const c = coordsOf(el);
  if (c.length < 2) continue;
  riverNameLength.set(el.tags.name, (riverNameLength.get(el.tags.name) || 0) + lenOf(c));
}

// ---------- вода ----------

// Геометрия по видам: { geom, bb }. Для полигонов — береговая линия (контур), не площадь.
const water = { sea: [], river: [], lake: [], pond: [] };
const waterForMap = [];
const polys = []; // полигоны воды целиком, чтобы выбросить оси рек внутри них

// Море: береговая линия.
let droppedIslets = 0;
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || el.tags.natural !== 'coastline') continue;
  // Замкнутая береговая линия — остров. Мелкие (форты, островки) не берём.
  const all = coordsOf(el);
  if (all.length > 3 && same(all[0], all[all.length - 1])) {
    let area = 0;
    try { area = turf.area(turf.polygon([all])); } catch {}
    if (area < MIN_ISLAND_AREA_M2) { droppedIslets++; continue; }
  }
  for (const seg of clipToBox(coordsOf(el))) {
    water.sea.push({ geom: turf.lineString(seg) });
    waterForMap.push({ type: 'Feature', properties: { kind: 'sea' }, geometry: { type: 'LineString', coordinates: round(seg) } });
  }
}

// Полигоны воды.
const waterPolys = [...polysFilter()];
function* polysFilter() {
  for (const { ring, tags } of polygonsOf({ osm, nodes, ways }, (t) => t.natural === 'water')) {
    if (isHidden(tags) || isNotFishable(tags) || tags.amenity === 'fountain' || tags.leisure === 'swimming_pool') continue;
    if (BAD_WATER_TYPES.includes(tags.water)) continue;
    let poly;
    let area;
    try { poly = turf.polygon([ring]); area = turf.area(poly); } catch { continue; }
    if (area < 50) continue;
    const w = tags.water || '';
    const isRiverPoly = w === 'river' || w === 'oxbow' || w === 'canal';
    let kind;
    if (isRiverPoly) {
      // Русло рекой считаем, если у него есть имя или оно большое; безымянная канавка — нет.
      if (!tags.name && area < 50000) continue;
      kind = 'river';
    } else {
      if (area < MIN_LAKE_AREA_M2 && !tags.name) continue; // дворовая лужа
      kind = w === 'pond' || area < POND_MAX_AREA_M2 ? 'pond' : 'lake';
    }
    yield { ring, tags, poly, area, kind };
  }
}
for (const p of waterPolys) {
  if (!inBox(p.ring[0]) && !p.ring.some(inBox)) continue;
  // Береговая линия: весь внешний контур, а не площадь.
  for (const seg of clipToBox(p.ring)) water[p.kind].push({ geom: turf.lineString(seg) });
  polys.push({ poly: p.poly, bb: turf.bbox(p.poly) });
  waterForMap.push({ type: 'Feature', properties: { kind: p.kind + 'poly', name: p.tags.name || '' }, geometry: { type: 'Polygon', coordinates: [round(p.ring)] } });
}
const insidePoly = (pt) => polys.some((p) => pt[0] >= p.bb[0] && pt[0] <= p.bb[2] && pt[1] >= p.bb[1] && pt[1] <= p.bb[3] && turf.booleanPointInPolygon(pt, p.poly));

// Реки (и каналы): осевые линии, но только настоящие и только вне полигонов воды.
let droppedHidden = 0;
let droppedShort = 0;
let droppedInside = 0;
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || !el.tags.waterway) continue;
  if (!isRiverWay(el.tags)) continue; // ручьи и прочее — не берём
  if (isHidden(el.tags) || isNotFishable(el.tags)) { droppedHidden++; continue; }
  if (!el.tags.name || (riverNameLength.get(el.tags.name) || 0) < MIN_RIVER_LENGTH_M) { droppedShort++; continue; }
  for (const seg of clipToBox(coordsOf(el))) {
    const mid = seg[Math.floor(seg.length / 2)];
    if (insidePoly(mid)) { droppedInside++; continue; } // ось реки внутри русла-полигона: берег даёт сам полигон
    water.river.push({ geom: turf.lineString(seg) });
    waterForMap.push({ type: 'Feature', properties: { kind: 'river', name: el.tags.name || '' }, geometry: { type: 'LineString', coordinates: round(seg) } });
  }
}
console.error('вода:', Object.fromEntries(Object.entries(water).map(([k, v]) => [k, v.length])), { droppedHidden, droppedShort, droppedInside, droppedIslets });

// ---------- где город ----------

let boundary = null;
const boundaryFile = CFG.boundaryFile ?? `boundary_${CITY}.geojson`;
if ((CFG.boundary || CFG.boundaryFile) && fs.existsSync(boundaryFile)) boundary = JSON.parse(fs.readFileSync(boundaryFile, 'utf8')).features;

// Полоса вдоль моря (Сочи): расстояние до ближайшей точки береговой линии. Вершины кладём
// в корзины по 0.02°, чтобы не перебирать всё.
const BUCKET = 0.02;
const coastBuckets = new Map();
if (CFG.coastBufferKm) {
  for (const x of water.sea) {
    for (const [lon, lat] of x.geom.geometry.coordinates) {
      const key = `${Math.floor(lon / BUCKET)}:${Math.floor(lat / BUCKET)}`;
      if (!coastBuckets.has(key)) coastBuckets.set(key, []);
      coastBuckets.get(key).push([lon, lat]);
    }
  }
}
function nearCoast([lon, lat]) {
  const kmLat = 111.2;
  const kmLon = 111.2 * Math.cos((lat * Math.PI) / 180);
  const reach = Math.ceil(CFG.coastBufferKm / (kmLon * BUCKET)) + 1;
  const bx = Math.floor(lon / BUCKET);
  const by = Math.floor(lat / BUCKET);
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (const [x, y] of coastBuckets.get(`${bx + dx}:${by + dy}`) || []) {
        if (Math.hypot((x - lon) * kmLon, (y - lat) * kmLat) <= CFG.coastBufferKm) return true;
      }
    }
  }
  return false;
}
const insideCity = (pt) => {
  if (boundary) return boundary.some((p) => turf.booleanPointInPolygon(pt, p));
  if (CFG.coastBufferKm) return nearCoast(pt);
  return true;
};

// ---------- где рыбачить нельзя ----------

const restricted = [];
const restrictedFile = `osm_${IN}_restricted.json`;
if (fs.existsSync(restrictedFile)) {
  const r = readOsm(restrictedFile);
  const wanted = (t) => t.leisure === 'nature_reserve' || t.boundary === 'protected_area' || t.landuse === 'military' || t.military || t.industrial === 'port' || t.landuse === 'port' || t.aeroway === 'aerodrome';
  const reasonOf = (t) => (t.landuse === 'military' || t.military ? 'военная территория' : t.aeroway ? 'аэродром' : t.industrial === 'port' || t.landuse === 'port' ? 'порт' : 'заповедник');
  for (const { ring, tags } of polygonsOf(r, wanted)) {
    // Заповедником считаем только строгие охранные зоны, остальные охранные границы пропускаем.
    if (tags.boundary === 'protected_area' && !['1', '1a', '1b', '2'].includes(tags.protect_class)) continue;
    try {
      const poly = turf.polygon([ring]);
      restricted.push({ poly, bb: turf.bbox(poly), reason: reasonOf(tags), name: tags.name || '' });
    } catch {}
  }
  console.error('закрытых зон:', restricted.length);
}
const restrictedAt = (pt) => restricted.find((p) => pt[0] >= p.bb[0] && pt[0] <= p.bb[2] && pt[1] >= p.bb[1] && pt[1] <= p.bb[3] && turf.booleanPointInPolygon(pt, p.poly));

// Автомагистраль на дамбе или мосту над заливом (КЗС): линии дорог в рамке damBox.
const damLines = [];
const roadsFile = `osm_${IN}_roads.json`;
if (CFG.damBox && fs.existsSync(roadsFile)) {
  const d = CFG.damBox;
  for (const el of JSON.parse(fs.readFileSync(roadsFile, 'utf8')).elements) {
    if (!el.geometry) continue;
    const pts = el.geometry.map((g) => [g.lon, g.lat]).filter(([x, y]) => x >= d.w && x <= d.e && y >= d.s && y <= d.n);
    if (pts.length > 1) damLines.push({ geom: turf.lineString(pts), bb: turf.bbox(turf.lineString(pts)) });
  }
  console.error('дорог на дамбе:', damLines.length);
}
const nearDam = (pt) => damLines.some((l) => pt[0] >= l.bb[0] - 0.01 && pt[0] <= l.bb[2] + 0.01 && pt[1] >= l.bb[1] - 0.006 && pt[1] <= l.bb[3] + 0.006 && turf.pointToLineDistance(pt, l.geom, { units: 'meters' }) <= DAM_BUFFER_M);


// Константы «бесконечной» сетки от рамки: порт buildGrid из web/lib/data/hexGrid.ts.
function latticeFrom(b, sideM) {
  const R = 6371008.8;
  const hav = (lng1, lat1, lng2, lat2) => {
    const t = (d) => (d * Math.PI) / 180;
    const a = Math.sin(t(lat2 - lat1) / 2) ** 2 + Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(t(lng2 - lng1) / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
  };
  const [west, south, east, north] = [b.w - 0.01, b.s - 0.01, b.e + 0.01, b.n + 0.01];
  const cy = (south + north) / 2;
  const cx = (west + east) / 2;
  const cellWidth = ((sideM * 2) / hav(west, cy, east, cy)) * (east - west);
  const cellHeight = ((sideM * 2) / hav(cx, south, cx, north)) * (north - south);
  const radius = cellWidth / 2;
  const hexWidth = radius * 2;
  const hexHeight = (Math.sqrt(3) / 2) * cellHeight;
  const xInterval = (3 / 4) * hexWidth;
  const yInterval = hexHeight;
  const boxW = east - west;
  const boxH = north - south;
  const xCount = Math.floor((boxW - hexWidth) / (hexWidth - radius / 2));
  const xAdjust = (xCount * xInterval - radius / 2 - boxW) / 2 - radius / 2 + xInterval / 2;
  const yCount = Math.floor((boxH - hexHeight) / hexHeight);
  let yAdjust = (boxH - yCount * hexHeight) / 2;
  if (yCount * hexHeight - boxH > hexHeight / 2) yAdjust -= hexHeight / 4;
  return { west, south, cellWidth, cellHeight, hexHeight, xInterval, yInterval, xAdjust, yAdjust };
}

// ---------- сетка ----------

const side = WIDTH_M / Math.sqrt(3);
let grid;
if (CFG.gridFrom) {
  // Сетка «бесконечная» от рамки gridFrom: те же формулы, что web/lib/data/hexGrid.ts (buildGrid,
  // cellCenter, hexCorners). Так новые соты ложатся на уже существующие сектора города без сдвига.
  const g = latticeFrom(CFG.gridFrom, side);
  const feats = [];
  const xMin = Math.floor((BBOX.w - g.west + g.xAdjust) / g.xInterval) - 1;
  const xMax = Math.ceil((BBOX.e - g.west + g.xAdjust) / g.xInterval) + 1;
  for (let x = xMin; x <= xMax; x++) {
    const odd = ((x % 2) + 2) % 2 === 1;
    const yShift = odd ? g.hexHeight / 2 : 0;
    const yMin = Math.floor((BBOX.s - g.south - g.yAdjust + yShift) / g.yInterval) - 1;
    const yMax = Math.ceil((BBOX.n - g.south - g.yAdjust + yShift) / g.yInterval) + 1;
    for (let y = yMin; y <= yMax; y++) {
      const lng = x * g.xInterval + g.west - g.xAdjust;
      let lat = y * g.yInterval + g.south + g.yAdjust;
      if (odd) lat -= g.hexHeight / 2;
      const ring = [];
      for (let i = 0; i <= 6; i++) {
        const a = ((2 * Math.PI) / 6) * (i % 6);
        ring.push([lng + (g.cellWidth / 2) * Math.cos(a), lat + (g.cellHeight / 2) * Math.sin(a)]);
      }
      feats.push({ type: 'Feature', properties: { gx: x, gy: y }, geometry: { type: 'Polygon', coordinates: [ring] } });
    }
  }
  grid = { features: feats };
} else {
  grid = turf.hexGrid([BBOX.w - 0.01, BBOX.s - 0.01, BBOX.e + 0.01, BBOX.n + 0.01], side, { units: 'meters' });
}
console.error('сот в сетке:', grid.features.length);

// Сектора, которые уже есть в игре (Москва в МКАД): новые соты внутри этого кольца не строим.
const excludeRing = CFG.excludeFile ? JSON.parse(fs.readFileSync(CFG.excludeFile, 'utf8')).features : null;
// Сектора, что уже есть в базе (existing_<город>.json: id, lat, lng, is_deleted — их кладёт dedupe_ckad.mjs):
// соту не строим, если её центр совпал с живым сектором или ближе 400 м к нему (наложение).
const existing = CFG.existingFile && fs.existsSync(CFG.existingFile) ? JSON.parse(fs.readFileSync(CFG.existingFile, 'utf8')).filter((r) => !r.is_deleted) : [];
let droppedExisting = 0;
const overlapsExisting = ([x, y]) => existing.some((r) => Math.abs(r.lat - y) < 0.004 && Math.abs(r.lng - x) < 0.0065 && turf.distance([x, y], [r.lng, r.lat], { units: 'meters' }) < 400);
const insideExcluded = (pt) => excludeRing && excludeRing.some((p) => turf.booleanPointInPolygon(pt, p));

const indexed = Object.fromEntries(Object.entries(water).map(([k, v]) => [k, v.map((x) => ({ ...x, bb: turf.bbox(x.geom) }))]));
const bboxHit = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

const kept = [];
const excluded = [];
grid.features.forEach((f, i) => {
  const center = turf.centroid(f).geometry.coordinates;
  if (!inBox(center) || !insideCity(center) || insideExcluded(center)) return;
  if (overlapsExisting(center)) { droppedExisting++; return; }
  const bb = turf.bbox(f);
  const touches = {};
  for (const k of PRIORITY) touches[k] = indexed[k].some((x) => bboxHit(bb, x.bb) && turf.booleanIntersects(f, x.geom));
  const kind = PRIORITY.find((k) => touches[k]) || null;
  if (!kind) return;
  const zone = restrictedAt(center);
  if (zone) { excluded.push({ f, kind, zone }); return; }
  // Дамба с автодорогой: только соты у моря/озера (вдоль берегов реки дорога — обычный мост).
  if ((kind === 'sea' || kind === 'lake') && nearDam(center)) { excluded.push({ f, kind, zone: { reason: 'дамба с автодорогой', name: 'КЗС' } }); return; }
  kept.push({ f, i, kind, touches });
});

// ---------- запись ----------

// Номера по порядку (P0001…), а не по месту в сетке: у большой рамки индекс сетки не
// влезает в 4 цифры. Номера фиксируются при импорте и дальше не меняются.
const features = kept.map((x, n) => ({
  type: 'Feature',
  properties: { id: CFG.prefix + String(n + (CFG.idStart ?? 1)).padStart(4, '0'), kind: x.kind, core: true, ...(x.f.properties.gx !== undefined ? { gx: x.f.properties.gx, gy: x.f.properties.gy } : {}), ...x.touches },
  geometry: { type: 'Polygon', coordinates: [round(x.f.geometry.coordinates[0])] },
}));
fs.writeFileSync(`hex_${OUT}.geojson`, JSON.stringify({ type: 'FeatureCollection', features }));
fs.writeFileSync(`water_${OUT}.geojson`, JSON.stringify({ type: 'FeatureCollection', features: waterForMap }));
fs.writeFileSync(
  `excluded_${OUT}.geojson`,
  JSON.stringify({ type: 'FeatureCollection', features: excluded.map((x) => ({ type: 'Feature', properties: { kind: x.kind, reason: x.zone.reason, name: x.zone.name }, geometry: { type: 'Polygon', coordinates: [round(x.f.geometry.coordinates[0])] } })) }),
);

const count = (k) => features.filter((f) => f.properties.kind === k).length;
const byReason = {};
for (const x of excluded) byReason[x.zone.reason] = (byReason[x.zone.reason] || 0) + 1;
console.error('снято: совпало или наложилось на существующие сектора:', droppedExisting);
console.log(JSON.stringify({ city: CITY, cells: features.length, sea: count('sea'), river: count('river'), lake: count('lake'), pond: count('pond'), excluded: excluded.length, excludedBy: byReason }));
