// Шаг 3. Собираем страницу с картой в один HTML файл.
//
// Вход:  hex_moscow.geojson, water_moscow.geojson (из build_hex.mjs)
//        tiles.json (необязательно, см. tiles.py)
// Выход: map_moscow.html
//
// Данные вшиваются прямо в HTML, поэтому файл можно открыть двойным кликом,
// без сервера. Подложка по умолчанию грузится с tile.openstreetmap.org.
// Если рядом лежит tiles.json, тайлы вшиваются в файл и карта работает офлайн.
//
// Запуск: node assemble.mjs

import fs from 'fs';

const hex = fs.readFileSync('hex_moscow.geojson', 'utf8');
const water = fs.readFileSync('water_moscow.geojson', 'utf8');
const tiles = fs.existsSync('tiles.json') ? fs.readFileSync('tiles.json', 'utf8') : 'null';
// Public (pk.) Mapbox token for the preview basemap only — not read from
// web/.env.local automatically (this is a standalone Node script, not
// Next.js); export it before running: MAPBOX_TOKEN=pk.xxx node assemble_moscow.mjs
const mapboxToken = process.env.MAPBOX_TOKEN ?? '';

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Соты по воде</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { height: 100%; margin: 0; font: 14px/1.4 system-ui, sans-serif; }
  #map { position: absolute; inset: 0; }
  #panel { position: absolute; top: 12px; left: 12px; z-index: 1000; width: 280px;
           background: #fff; border-radius: 6px; padding: 12px 14px; box-shadow: 0 6px 20px rgba(0,0,0,.18); }
  #panel h1 { font-size: 16px; margin: 0 0 8px; }
  #panel label { display: flex; align-items: center; gap: 8px; padding: 3px 0; cursor: pointer; }
  #panel .sw { width: 18px; height: 16px; clip-path: polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%); opacity: .6; }
  #panel .n { margin-left: auto; color: #667; font-variant-numeric: tabular-nums; }
  #info { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e3e6e8; font-size: 12.5px; color: #334; min-height: 3em; }
  code { font-family: ui-monospace, Menlo, monospace; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>Соты 600 м по воде</h1>
  <label><input type="checkbox" data-k="sea" checked><span class="sw" style="background:#1B7A9C"></span>Море, у берега<span class="n" id="n-sea"></span></label>
  <label><input type="checkbox" data-k="river" checked><span class="sw" style="background:#4E8A3A"></span>Реки и заводи<span class="n" id="n-river"></span></label>
  <label><input type="checkbox" data-k="stream" checked><span class="sw" style="background:#A2761C"></span>Ручьи и каналы<span class="n" id="n-stream"></span></label>
  <label><input type="checkbox" data-k="lake" checked><span class="sw" style="background:#5A5FB5"></span>Озёра и пруды<span class="n" id="n-lake"></span></label>
  <label><input type="checkbox" data-k="ring"><span class="sw" style="background:#889"></span>Второй ряд у рек<span class="n" id="n-ring"></span></label>
  <label><input type="checkbox" id="t-water" checked><span class="sw" style="background:#0B4F6C;clip-path:none;height:3px"></span>Вода из OSM</label>
  <div id="info">Наведите на соту.</div>
</div>
<script>
const HEX = ${hex};
const WATER = ${water};
const TILES = ${tiles};   // null, если tiles.json не было
const COLOR = { sea: '#1B7A9C', river: '#4E8A3A', stream: '#A2761C', lake: '#5A5FB5' };
const NAME  = { sea: 'море', river: 'река', stream: 'ручей', lake: 'озеро' };

const map = L.map('map', { zoomControl: false });
L.control.zoom({ position: 'bottomright' }).addTo(map);
const attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

if (TILES) {
  // Офлайн режим: тайлы берём из вшитого словаря "z/x/y" -> data:image/png;base64,...
  // Если нужного зума нет, вырезаем и растягиваем кусок родительского тайла.
  const Embedded = L.TileLayer.extend({
    createTile(coords, done) {
      const key = coords.z + '/' + coords.x + '/' + coords.y;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      let z = coords.z, x = coords.x, y = coords.y, k = 0;
      while (z > 10 && !TILES[z + '/' + x + '/' + y]) { z--; x = Math.floor(x / 2); y = Math.floor(y / 2); k++; }
      const src = TILES[z + '/' + x + '/' + y];
      if (!src) { setTimeout(() => done(null, canvas), 0); return canvas; }
      const img = new Image();
      img.onload = () => {
        const s = 256 / 2 ** k, ox = (coords.x - x * 2 ** k) * s, oy = (coords.y - y * 2 ** k) * s;
        canvas.getContext('2d').drawImage(img, ox, oy, s, s, 0, 0, 256, 256);
        done(null, canvas);
      };
      img.src = src;
      return canvas;
    },
  });
  new Embedded('', { maxZoom: 18, attribution }).addTo(map);
} else {
  // Не tile.openstreetmap.org — тот блокирует запросы с локального file://
  // (их политика использования). Не свой ночной стиль RANGE — на зуме 10 он
  // почти полностью тёмный (задуман для показа воды/дорог поверх, не голой
  // земли издалека) — обычный светлый публичный стиль Mapbox для превью.
  L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}', { maxZoom: 19, tileSize: 512, zoomOffset: -1, attribution }).addTo(map);
}

// Вода: полигоны с заливкой, линии рек толще, ручьи тоньше.
const waterStyle = (f) => {
  const k = f.properties.kind;
  if (k.endsWith('poly')) return { color: '#0B4F6C', weight: 1, fillColor: '#0B4F6C', fillOpacity: .3 };
  if (k === 'stream') return { color: '#0B4F6C', weight: 1, opacity: .5 };
  return { color: '#0B4F6C', weight: 2, opacity: .85 };
};
const waterLayer = L.geoJSON(WATER, { style: waterStyle, interactive: false }).addTo(map);

// Соты. Основные ярче, второй ряд бледнее.
const hexStyle = (f) => {
  const p = f.properties, c = COLOR[p.kind];
  return { color: c, fillColor: c, weight: p.core ? 1.2 : .6, opacity: p.core ? .9 : .5, fillOpacity: p.core ? .4 : .14 };
};
const info = document.getElementById('info');
const hexLayer = L.geoJSON(HEX, {
  style: hexStyle,
  onEachFeature(f, layer) {
    const p = f.properties;
    layer.on('mouseover', () => {
      layer.setStyle({ weight: 2, fillOpacity: .6 });
      const c = layer.getBounds().getCenter();
      const touches = Object.keys(NAME).filter((k) => p[k]).map((k) => NAME[k]).join(', ');
      info.innerHTML = '<code>' + p.id + '</code> · ' + NAME[p.kind] + (p.core ? '' : ', второй ряд') +
        (touches ? '<br>касается: ' + touches : '') + '<br>' + c.lat.toFixed(5) + ', ' + c.lng.toFixed(5);
    });
    layer.on('mouseout', () => layer.setStyle(hexStyle(f)));
  },
}).addTo(map);
map.fitBounds(hexLayer.getBounds());

// Счётчики и переключатели слоёв.
const feats = HEX.features;
for (const k of Object.keys(NAME)) document.getElementById('n-' + k).textContent = feats.filter((f) => f.properties.kind === k && f.properties.core).length;
document.getElementById('n-ring').textContent = feats.filter((f) => !f.properties.core).length;
const flags = { sea: true, river: true, stream: true, lake: true, ring: false };
function applyFilters() {
  hexLayer.eachLayer((l) => {
    const p = l.feature.properties;
    const show = flags[p.kind] && (p.core || flags.ring);
    const el = l.getElement(); if (el) el.style.display = show ? '' : 'none';
  });
}
applyFilters();
document.querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('change', (e) => { flags[e.target.dataset.k] = e.target.checked; applyFilters(); }));
document.getElementById('t-water').addEventListener('change', (e) => e.target.checked ? waterLayer.addTo(map) : map.removeLayer(waterLayer));
</script>
</body>
</html>`;

fs.writeFileSync('map_moscow.html', html);
console.log('map_moscow.html:', (html.length / 1024 / 1024).toFixed(2), 'MB', tiles === 'null' ? '(тайлы онлайн)' : '(тайлы вшиты)');
