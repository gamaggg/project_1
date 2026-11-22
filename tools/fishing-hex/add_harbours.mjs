// Морские порты, отмеченные в OSM как landuse=harbour (Одесский морской порт), — тоже «рыбачить нельзя».
// fetch_osm_city.mjs берёт их с 22.11.2026; для уже скачанных городов этот скрипт дописывает их в
// osm_<город>_restricted.json одним запросом по рамке. Запуск: node add_harbours.mjs odesa
import fs from 'fs';
import { CONFIG } from './cities.mjs';
import { overpass } from './overpass.mjs';
const city = process.argv[2];
const { s, w, n, e } = CONFIG[city].bbox;
const file = `osm_${city}_restricted.json`;
const osm = JSON.parse(fs.readFileSync(file, 'utf8'));
const seen = new Set(osm.elements.map((el) => el.type + '/' + el.id));
const d = await overpass(`[out:json][timeout:180];(way["landuse"="harbour"](${s},${w},${n},${e});relation["landuse"="harbour"](${s},${w},${n},${e}););out body;>;out skel qt;`);
let added = 0;
for (const el of d.elements) if (!seen.has(el.type + '/' + el.id)) { osm.elements.push(el); seen.add(el.type + '/' + el.id); added++; }
fs.writeFileSync(file, JSON.stringify(osm));
console.log(file, '+', added);
