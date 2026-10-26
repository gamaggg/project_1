// Тянет из Overpass дороги ЦКАД (А-113) для границы Москвы+ЦКАД: сшивает их в кольцо ckad_ring.geojson.
// Запуск: node fetch_ckad.mjs
import fs from 'fs';
import { overpass } from './overpass.mjs';

const q = `[out:json][timeout:240];
way["highway"~"^(motorway|trunk)$"]["ref"~"^(A|А)-113$"](54.8,36.3,56.6,39.0);
out geom;`;
const data = await overpass(q);
fs.writeFileSync('osm_ckad_ways.json', JSON.stringify(data));
console.log('ways:', data.elements.length);
