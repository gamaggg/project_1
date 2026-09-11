import fs from 'fs';
import * as turf from '@turf/turf';

const data = JSON.parse(fs.readFileSync('/tmp/ckad-probe/ckad_ways.json', 'utf8'));
const ways = data.elements.filter((e) => e.type === 'way');
console.log('ways:', ways.length);

const segs = ways.map((w) => w.geometry.map((p) => [p.lon, p.lat])).filter((c) => c.length > 1);

const key = ([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`;
const same = (a, b) => key(a) === key(b);

// Stitch into as many closed rings / open chains as the data allows —
// federal highway ways in OSM are split into hundreds of short segments,
// not guaranteed to be in ring order.
const used = new Array(segs.length).fill(false);
const rings = [];
const openChains = [];

for (let i = 0; i < segs.length; i++) {
  if (used[i]) continue;
  used[i] = true;
  let chain = [...segs[i]];
  let extended = true;
  while (extended) {
    extended = false;
    for (let j = 0; j < segs.length; j++) {
      if (used[j]) continue;
      const s = segs[j];
      if (same(s[0], chain[chain.length - 1])) { chain.push(...s.slice(1)); used[j] = true; extended = true; }
      else if (same(s[s.length - 1], chain[chain.length - 1])) { chain.push(...s.slice(0, -1).reverse()); used[j] = true; extended = true; }
      else if (same(s[s.length - 1], chain[0])) { chain = [...s.slice(0, -1), ...chain]; used[j] = true; extended = true; }
      else if (same(s[0], chain[0])) { chain = [...s.slice(1).reverse(), ...chain]; used[j] = true; extended = true; }
    }
  }
  if (same(chain[0], chain[chain.length - 1]) && chain.length > 3) rings.push(chain);
  else openChains.push(chain);
}

console.log('closed rings:', rings.length);
console.log('open chains:', openChains.length);
console.log('ring lengths (km):', rings.map((r) => (turf.length(turf.lineString(r), { units: 'kilometers' })).toFixed(1)));
console.log('open chain lengths (km), longest 20:', openChains.map((c) => turf.length(turf.lineString(c), { units: 'kilometers' })).sort((a,b)=>b-a).slice(0,20).map(x=>x.toFixed(2)));
console.log('total open chain count with length > 1km:', openChains.filter((c) => turf.length(turf.lineString(c), { units: 'kilometers' }) > 1).length);

if (rings.length) {
  const biggest = rings.sort((a, b) => turf.length(turf.lineString(b)) - turf.length(turf.lineString(a)))[0];
  const poly = turf.polygon([biggest]);
  console.log('biggest ring area km2:', (turf.area(poly) / 1e6).toFixed(1));
  fs.writeFileSync('/tmp/ckad-probe/ckad_ring.geojson', JSON.stringify(turf.featureCollection([poly])));
}
