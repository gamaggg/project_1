// Шаг 1 для новых городов: тянет из Overpass воду и «закрытые» места в рамке города.
// Рамка режется на плитки (у большой рамки Overpass отвечает таймаутом), ответы
// склеиваются.
//
// Выход: osm_<город>.json            вода: берег моря, реки, ручьи, каналы, полигоны воды
//        osm_<город>_restricted.json места, где рыбачить нельзя: заповедники, военные зоны,
//                                    порты, аэродромы
//
// Запуск: node fetch_osm_city.mjs <spb|sochi|tbilisi>
import fs from 'fs';
import { CONFIG } from './cities.mjs';
import { overpass } from './overpass.mjs';
import * as turf from '@turf/turf';

const city = process.argv[2];
const cfg = CONFIG[city];
if (!cfg) { console.error('city:', Object.keys(CONFIG).join(' | ')); process.exit(1); }

const TILE_DEG = 0.25;
const { s, w, n, e } = cfg.bbox;
const tiles = [];
for (let lat = s; lat < n; lat += TILE_DEG) {
  for (let lon = w; lon < e; lon += TILE_DEG) {
    tiles.push([lat, lon, Math.min(lat + TILE_DEG, n), Math.min(lon + TILE_DEG, e)].map((x) => +x.toFixed(5)));
  }
}

// Плитки вне города не качаем: у большой рамки (город + 30 км, побережье Болгарии) их больше половины.
// Город — полигон границы (boundaryFile) или полоса вдоль примерной линии берега (coastGuide, км) плюс
// extraAreas. Плитка берётся, если задевает город хоть краем.
const area = [];
if (cfg.boundaryFile && fs.existsSync(cfg.boundaryFile)) area.push(...JSON.parse(fs.readFileSync(cfg.boundaryFile, 'utf8')).features);
if (cfg.coastGuide) area.push(turf.buffer(turf.lineString(cfg.coastGuide), cfg.coastGuideKm ?? 12, { units: 'kilometers' }));
for (const b of cfg.extraAreas || []) area.push(turf.bboxPolygon([b.w, b.s, b.e, b.n]));
for (const f of cfg.extraFiles || []) area.push(...JSON.parse(fs.readFileSync(f, 'utf8')).features);
if (area.length) {
  const before = tiles.length;
  const keep = tiles.filter(([la1, lo1, la2, lo2]) => area.some((p) => turf.booleanIntersects(turf.bboxPolygon([lo1, la1, lo2, la2]), p)));
  tiles.length = 0;
  tiles.push(...keep);
  console.error(`плиток: ${tiles.length} из ${before}`);
}

const waterQuery = (b) => `[out:json][timeout:240];
(
  way["natural"="coastline"](${b});
  way["waterway"~"^(river|stream|canal)$"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
);
out body;
>;
out skel qt;`;

// Заповедники и строгие охранные зоны (класс 1, 1a, 1b, 2), военные территории, порты,
// аэродромы. Заказники и парки не берём: там рыбачить часто можно.
const restrictedQuery = (b) => {
  const pick = ['["leisure"="nature_reserve"]', '["boundary"="protected_area"]["protect_class"~"^(1|1a|1b|2)$"]', '["landuse"="military"]', '["military"]', '["industrial"="port"]', '["landuse"="port"]', '["landuse"="harbour"]', '["aeroway"="aerodrome"]'];
  return `[out:json][timeout:240];
(
${pick.map((p) => `  way${p}(${b});\n  relation${p}(${b});`).join('\n')}
);
out body;
>;
out skel qt;`;
};

async function grab(file, makeQuery) {
  const seen = new Set();
  const elements = [];
  for (const [i, t] of tiles.entries()) {
    const data = await overpass(makeQuery(t.join(',')));
    let added = 0;
    for (const el of data.elements) {
      const key = el.type + '/' + el.id;
      if (seen.has(key)) continue;
      seen.add(key);
      elements.push(el);
      added++;
    }
    console.error(`${file}: плитка ${i + 1}/${tiles.length}, +${added}`);
  }
  fs.writeFileSync(file, JSON.stringify({ version: 0.6, elements }));
  console.log(file, elements.length, 'элементов');
}

// --only=water / --only=restricted: одну половину (вторую можно качать параллельно другим процессом).
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
if (only !== 'restricted') await grab(`osm_${city}.json`, waterQuery);
if (only !== 'water') await grab(`osm_${city}_restricted.json`, restrictedQuery);

// Автомагистрали над водой (дамба, мосты): одним запросом по рамке damBox.
if (cfg.damBox) {
  const b = [cfg.damBox.s, cfg.damBox.w, cfg.damBox.n, cfg.damBox.e].join(',');
  const roads = await overpass(`[out:json][timeout:120];(way["highway"~"^(motorway|trunk|motorway_link)$"](${b}););out geom;`);
  fs.writeFileSync(`osm_${city}_roads.json`, JSON.stringify(roads));
  console.log(`osm_${city}_roads.json`, roads.elements.length, 'дорог');
}
