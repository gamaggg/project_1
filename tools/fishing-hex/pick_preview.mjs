// Образцы секторов для окна выбора цвета (web/lib/data/colorPreviewSectors.ts): пять секторов,
// ближайших к точке города (colorPreviewCenter в web/lib/data/city.ts): три «demo», два «context».
// Углы — по тем же формулам, что миграция секторов (gen_city_sql.mjs) и сетка приложения.
// Запуск: node pick_preview.mjs anapa 44.895 37.31
import fs from 'fs';
import { CONFIG } from './cities.mjs';

const [CITY, lat0, lng0] = process.argv.slice(2);
const CFG = CONFIG[CITY];
const src = fs.readFileSync('build_hex_city.mjs', 'utf8');
const latticeFrom = new Function(src.slice(src.indexOf('function latticeFrom'), src.indexOf('// ---------- сетка')) + '; return latticeFrom;')();
const g = latticeFrom(CFG.gridFrom, 600 / Math.sqrt(3));
const feats = JSON.parse(fs.readFileSync(`hex_${CITY}.geojson`, 'utf8')).features;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const cells = feats.map((f) => {
  const x = f.properties.gx, y = f.properties.gy, odd = ((x % 2) + 2) % 2 === 1;
  const lng = x * g.xInterval + g.west - g.xAdjust;
  const lat = y * g.yInterval + g.south + g.yAdjust - (odd ? g.hexHeight / 2 : 0);
  const corners = [0, 1, 2, 3, 4, 5].map((i) => [r6(lat + (g.cellHeight / 2) * Math.sin((Math.PI / 3) * i)), r6(lng + (g.cellWidth / 2) * Math.cos((Math.PI / 3) * i))]);
  const d = Math.hypot((lat - +lat0) * 111, (lng - +lng0) * 111 * Math.cos((+lat0 * Math.PI) / 180));
  return { id: f.properties.id, kind: f.properties.kind, lat, lng, corners, d };
}).sort((a, b) => a.d - b.d).slice(0, 5);
const row = (c) => `      { id: '${c.id}', corners: ${JSON.stringify(c.corners)} },`;
console.log(`  ${CITY}: {\n    demo: [\n${cells.slice(0, 3).map(row).join('\n')}\n    ],\n    context: [\n${cells.slice(3).map(row).join('\n')}\n    ],\n  },`);
console.error(cells.map((c) => `${c.id} ${c.kind} ${c.d.toFixed(2)} km  [${r6(c.lat)}, ${r6(c.lng)}]`).join('\n'));
