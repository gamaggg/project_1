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

// Москва в границах МКАД. bbox воды берётся от него, но реальное отсечение
// идёт по полигону кольца (mkad_ring.geojson), не по прямоугольнику — см. ниже.
const BBOX = { s: 55.5718, w: 37.3688, n: 55.9111, e: 37.8435 };
const RING_POLYGON = JSON.parse(fs.readFileSync('mkad_ring.geojson', 'utf8')).features[0];

// Ширина соты «от грани до грани», в метрах.
const WIDTH_M = 600;

// Отсекает пруды-лужи во дворах — тот же принцип, что STREAM_MIN_LENGTH_M
// ниже, только по площади полигона, а не по длине линии.
const MIN_LAKE_AREA_M2 = 20000;

// Нужен ли второй ряд сот вокруг речных сот (соседи в один шаг).
// Соты второго ряда помечаются core:false, на карте их можно выключить.
const RING_AROUND = ['river'];

// Если сота касается воды нескольких типов, берём первый по этому списку.
// 'stream' dropped by request — ручьи и каналы не нужны для Москвы.
const PRIORITY = ['river', 'sea', 'lake'];

// Минимальная суммарная длина связного водотока (ручей/канал, не река), чтобы
// его касание вообще считалось водой. У OSM почти нет метаданных о размере
// ручья (см. DECISIONS.md) — длина после склейки фрагментов в целый водоток
// единственный доступный сигнал, чтобы отличить настоящий ручей от канавы/
// незначительного притока.
const STREAM_MIN_LENGTH_M = 800;

// ---------- разбор OSM ----------

const osm = JSON.parse(fs.readFileSync('osm_moscow.json', 'utf8'));

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

// Ручьи/каналы (не реки) в OSM часто разрезаны мапперами на много мелких way
// на одном и том же водотоке — судить о размере по отдельному фрагменту нельзя
// (можно случайно вырезать кусок настоящего длинного ручья). Склеиваем такие
// way в целые водотоки union-find'ом по общим id узлов OSM (river туда не
// включаем: иначе крошечный приток унаследует длину всей реки, в которую он
// впадает, и порог перестанет что-либо отличать) и считаем суммарную длину
// каждого водотока — это единственный доступный сигнал размера, раз у ручьёв
// почти нет метаданных (имя есть у 8 из ~590 линий в этом bbox).
const streamParent = new Map();
function streamFind(x) {
  if (!streamParent.has(x)) streamParent.set(x, x);
  while (streamParent.get(x) !== x) { streamParent.set(x, streamParent.get(streamParent.get(x))); x = streamParent.get(x); }
  return x;
}
function streamUnion(a, b) {
  const ra = streamFind(a), rb = streamFind(b);
  if (ra !== rb) streamParent.set(ra, rb);
}
const nonRiverWaterwayWays = [...ways.values()].filter((w) => w.tags && w.tags.waterway && w.tags.waterway !== 'river');
for (const w of nonRiverWaterwayWays) {
  if (w.nodes.length >= 2) streamUnion(w.nodes[0], w.nodes[w.nodes.length - 1]);
}
const streamComponentLength = new Map(); // root node id -> суммарная длина, метры
for (const w of nonRiverWaterwayWays) {
  const coords = coordsOf(w);
  if (coords.length < 2) continue;
  let len = 0;
  try { len = turf.length(turf.lineString(coords), { units: 'meters' }); } catch { continue; }
  const root = streamFind(w.nodes[0]);
  streamComponentLength.set(root, (streamComponentLength.get(root) || 0) + len);
}

// Река в трубе (Неглинка под Красной площадью и т.п.) — не место для рыбалки,
// сколько бы она ни весила исторически. OSM размечает такие куски tunnel/
// location=underground/covered=yes.
function isUnderground(tags) {
  return !!tags.tunnel || tags.covered === 'yes' || tags.location === 'underground';
}

// Реки то же самое, но по имени, а не по общим узлам с streamUnion выше:
// приток и река, в которую он впадает, — разные названные реки, объединять их
// узлом было бы неправильно (мелкий приток унаследовал бы длину всей крупной
// реки). Безымянные фрагменты (обрывки/ошибки мапперов, тут их 36 суммарно на
// ~6.5 км) отбрасываются целиком — судить об их размере вообще не по чему.
// Подземные куски в сумму не идут — то, что Москва-река где-то ныряет под
// мост, не должно засчитываться как её «длина под землёй», а Неглинка,
// которая в трубе почти целиком, из-за этого сама отсеется порогом ниже.
const MIN_RIVER_LENGTH_M = 1500;
const riverNameLength = new Map();
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || el.tags.waterway !== 'river' || !el.tags.name || isUnderground(el.tags)) continue;
  const coords = coordsOf(el);
  if (coords.length < 2) continue;
  let len = 0;
  try { len = turf.length(turf.lineString(coords), { units: 'meters' }); } catch { continue; }
  riverNameLength.set(el.tags.name, (riverNameLength.get(el.tags.name) || 0) + len);
}

// Геометрия воды по типам: { geom, root? }. `root` — только у ручьёв/каналов,
// ссылка на streamComponentLength (нужна ниже при проверке пересечения соты).
const water = { sea: [], river: [], stream: [], lake: [] };
// То же самое, но в виде GeoJSON для отрисовки на карте.
const waterForMap = [];

// Береговая линия моря.
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || el.tags.natural !== 'coastline') continue;
  for (const seg of clipToBox(coordsOf(el))) {
    water.sea.push({ geom: turf.lineString(seg) });
    waterForMap.push({ type: 'Feature', properties: { kind: 'sea' }, geometry: { type: 'LineString', coordinates: round(seg) } });
  }
}

// Реки, ручьи, каналы: осевые линии.
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.tags || !el.tags.waterway) continue;
  const kind = el.tags.waterway === 'river' ? 'river' : 'stream';
  if (kind === 'river' && (isUnderground(el.tags) || (riverNameLength.get(el.tags.name) || 0) < MIN_RIVER_LENGTH_M)) continue;
  const root = kind === 'stream' && el.nodes.length >= 2 ? streamFind(el.nodes[0]) : null;
  for (const seg of clipToBox(coordsOf(el))) {
    water[kind].push({ geom: turf.lineString(seg), root });
    waterForMap.push({ type: 'Feature', properties: { kind, name: el.tags.name || '' }, geometry: { type: 'LineString', coordinates: round(seg) } });
  }
}

// Полигоны воды. water=river / oxbow / canal считаем рекой (это русла и старицы),
// всё остальное (lake, pond, reservoir, без тега) считаем озером.
function addPolygon(ring, tags) {
  if (isUnderground(tags)) return;
  let poly;
  let area;
  try { poly = turf.polygon([ring]); area = turf.area(poly); if (area < 50) return; } catch { return; }
  const w = tags.water || '';
  const kind = (w === 'river' || w === 'oxbow' || w === 'canal') ? 'river' : 'lake';
  // Дворовый прудик не в счёт — тот же смысл, что порог для ручьёв, только
  // по площади самого полигона, а не по длине склеенного водотока. Именной
  // пруд пропускаем даже мелкий — Патриаршие пруды (0.9 га) меньше общего
  // порога в 2 га, но это явно не дворовая лужа, а место с названием.
  if (kind === 'lake' && area < MIN_LAKE_AREA_M2 && !tags.name) return;
  water[kind].push({ geom: poly });
  waterForMap.push({ type: 'Feature', properties: { kind: kind + 'poly', water: w, name: tags.name || '' }, geometry: { type: 'Polygon', coordinates: [round(ring)] } });
}
const partOfRelation = new Set();
for (const el of osm.elements) {
  if (el.type === 'relation' && el.tags && el.tags.natural === 'water') for (const m of el.members) partOfRelation.add(m.ref);
}
for (const el of osm.elements) {
  if (!el.tags || el.tags.natural !== 'water') continue;
  // Скульптурные фонтаны в парках ("Девушка с кувшином", "Купола" и т.п.)
  // тоже помечены natural=water — но это не пруд, отсекаем по amenity=fountain.
  if (el.tags.amenity === 'fountain') continue;
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
const indexed = Object.fromEntries(Object.entries(water).map(([k, v]) => [k, v.map((x) => ({ ...x, bb: turf.bbox(x.geom) }))]));
const bboxHit = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

const cells = grid.features.map((f, i) => {
  const bb = turf.bbox(f);
  const touches = {};
  for (const k of PRIORITY) {
    touches[k] = indexed[k].some((x) => {
      if (!bboxHit(bb, x.bb) || !turf.booleanIntersects(f, x.geom)) return false;
      // Ручей/канал короче порога (после склейки фрагментов в целый водоток,
      // см. выше) не считается водой для этой соты — незначительный приток/
      // канава, не место для рыбалки.
      if (k === 'stream' && x.root != null && (streamComponentLength.get(x.root) || 0) < STREAM_MIN_LENGTH_M) return false;
      return true;
    });
  }
  const center = turf.centroid(f).geometry.coordinates;
  // bbox для fetch_osm — прямоугольник, а МКАД — кольцо; без этой проверки
  // соты в дальних углах прямоугольника (за пределами реального кольца)
  // попали бы в результат просто потому что задели воду за МКАДом.
  const insideRing = turf.booleanPointInPolygon(center, RING_POLYGON);
  const kind = insideRing ? PRIORITY.find((k) => touches[k]) || null : null;
  return { f, i, center, touches, kind, core: !!kind };
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
    id: 'M' + String(x.i).padStart(4, '0'), // порядковый номер в сетке, стабилен при тех же настройках
    kind: x.kind,        // основной тип: sea / river / stream / lake
    core: !!x.core,      // true: касается воды, false: второй ряд
    sea: !!x.touches.sea, river: !!x.touches.river, stream: !!x.touches.stream, lake: !!x.touches.lake,
  },
  geometry: { type: 'Polygon', coordinates: [round(x.f.geometry.coordinates[0])] },
}));

fs.writeFileSync('hex_moscow.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
fs.writeFileSync('water_moscow.geojson', JSON.stringify({ type: 'FeatureCollection', features: waterForMap }));

const count = (k) => features.filter((f) => f.properties.kind === k && f.properties.core).length;
console.log(JSON.stringify({
  cells: features.length,
  core: { sea: count('sea'), river: count('river'), stream: count('stream'), lake: count('lake') },
  ring: features.filter((f) => !f.properties.core).length,
  cellAreaKm2: +(turf.area(grid.features[0]) / 1e6).toFixed(3),
}));
