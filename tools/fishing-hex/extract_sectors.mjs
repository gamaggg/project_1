// Шаг 4 (для FishZone). Готовит hex.geojson к вставке в fishzone-app.html.
//
// Вход:  hex.geojson (из build_hex.mjs, здесь же в папке)
// Выход: sectors.json — только соты первого ряда (core:true, реально касаются
//        воды любого типа), в формате, который жрёт fishzone-app.html:
//        { id, kind, lat, lng, corners:[[lat,lng] x6] }
//
// Зачем отдельный файл, а не прямая вставка hex.geojson в приложение:
// - hex.geojson использует порядок [lon,lat] (GeoJSON), Leaflet в приложении
//   ждёт [lat,lng] — конвертируем один раз здесь, а не на каждой перерисовке.
// - Второй ряд сот (core:false, "ring") — вспомогательная штука из инструмента
//   друга для подсветки соседей реки, для секторов рыбалки не нужна, выкидываем.
// - Нужен центр каждой соты (используется для GPS-чипа камеры, flyTo, метки на
//   карте) — geojson его не хранит, считаем как среднее шести вершин.
//
// Запуск: node extract_sectors.mjs
// После — вставить содержимое sectors.json в fishzone-app.html как
// значение константы HEX_SECTORS (см. DOCS.md, раздел «Сектора»).

import fs from 'fs';

const hex = JSON.parse(fs.readFileSync('hex.geojson', 'utf8'));

const sectors = hex.features
  .filter((f) => f.properties.core)
  .map((f) => {
    const ring = f.geometry.coordinates[0];
    // Первая и последняя точка кольца совпадают (GeoJSON замыкает полигон) — убираем дубль.
    const uniq = ring.slice(0, -1);
    const corners = uniq.map(([lon, lat]) => [lat, lon]);
    const lat = corners.reduce((s, c) => s + c[0], 0) / corners.length;
    const lng = corners.reduce((s, c) => s + c[1], 0) / corners.length;
    return { id: f.properties.id, kind: f.properties.kind, lat: +lat.toFixed(6), lng: +lng.toFixed(6), corners };
  });

fs.writeFileSync('sectors.json', JSON.stringify(sectors));
const byKind = {};
for (const s of sectors) byKind[s.kind] = (byKind[s.kind] || 0) + 1;
console.log('sectors.json:', sectors.length, 'секторов', byKind);
