// Шаг 4: из hex_moscow_ckad.geojson пишет миграцию (сектора Москвы между МКАД и ЦКАД) и её откат.
// Сектора записываются узлами сетки (gx, gy) + видом воды, координаты считает сам SQL по тем же формулам, что
// web/lib/data/hexGrid.ts (buildGrid / cellCenter / hexCorners); в конце миграция сверяет контрольную сумму.
import fs from 'fs';
const src = fs.readFileSync('build_hex_city.mjs', 'utf8');
const latticeFrom = new Function(src.slice(src.indexOf('function latticeFrom'), src.indexOf('// ---------- сетка')) + '; return latticeFrom;')();
const g = latticeFrom({ s: 55.5718, w: 37.3688, n: 55.9111, e: 37.8435 }, 600 / Math.sqrt(3));
const feats = JSON.parse(fs.readFileSync('hex_moscow_ckad.geojson', 'utf8')).features;
const FIRST = 4598;
const letter = { river: 'r', lake: 'l', pond: 'p' };
const ids = feats.map((f, i) => f.properties.id === 'M' + String(FIRST + i).padStart(4, '0'));
if (ids.includes(false)) throw new Error('ids are not sequential');
const packed = feats.map((f) => `${letter[f.properties.kind]}${f.properties.gx},${f.properties.gy}`);
// контрольная сумма по тем же формулам в JS
let sLat = 0, sLng = 0;
for (const f of feats) {
  const x = f.properties.gx, y = f.properties.gy, odd = ((x % 2) + 2) % 2 === 1;
  sLng += x * g.xInterval + g.west - g.xAdjust;
  sLat += y * g.yInterval + g.south + g.yAdjust - (odd ? g.hexHeight / 2 : 0);
}
const cnt = (k) => feats.filter((f) => f.properties.kind === k).length;
const n = (v) => v.toPrecision(17);
const lines = [];
for (let i = 0; i < packed.length; i += 12) lines.push('  ' + packed.slice(i, i + 12).join(';') + (i + 12 < packed.length ? ';' : ''));
const sql = `-- Сектора Москвы между МКАД и ЦКАД (${feats.length} штук, id M${FIRST}…M${FIRST + feats.length - 1}), 26.10.2026.
-- Построены tools/fishing-hex (build_hex_city.mjs moscow_ckad, предпросмотр map_moscow_ckad.html) по правилам
-- новых городов: только берег, настоящие реки, без мелких ручьёв, без заповедников, военных зон, аэродромов и портов.
-- Не создаются там, где уже стоит живой сектор (в т.ч. руками владельца) или ближе 400 м к нему.
-- Каждая запись: вид воды (r — река, l — озеро, p — пруд) и узел сетки gx,gy. Центр и углы считаются здесь по тем
-- же формулам, что сетка приложения (web/lib/data/hexGrid.ts, Москва): ${n(g.cellWidth / 2)}° по долготе,
-- ${n(g.cellHeight / 2)}° по широте, шаг ${n(g.xInterval)} / ${n(g.yInterval)}, начало ${n(g.west)}, ${n(g.south)}.
-- Откат: 01_territories_moscow_ckad_ROLLBACK.sql (пока на секторах нет уловов и владельцев).
insert into public.territories (id, kind, lat, lng, corners, is_deleted)
select c.id, c.kind::public.territory_kind, c.lat, c.lng,
  (select jsonb_agg(jsonb_build_array(
            round((c.lat + ${n(g.cellHeight / 2)} * sin(radians(60 * i)))::numeric, 6),
            round((c.lng + ${n(g.cellWidth / 2)} * cos(radians(60 * i)))::numeric, 6)) order by i)
   from generate_series(0, 5) as i),
  false
from (
  select 'M' || lpad((${FIRST - 1} + p.n)::text, 4, '0') as id,
    case p.k when 'r' then 'river' when 'l' then 'lake' else 'pond' end as kind,
    p.gy * ${n(g.yInterval)}::float8 + ${n(g.south)}::float8 + ${n(g.yAdjust)}::float8
      - case when ((p.gx % 2) + 2) % 2 = 1 then ${n(g.hexHeight / 2)}::float8 else 0 end as lat,
    p.gx * ${n(g.xInterval)}::float8 + ${n(g.west)}::float8 + ${n(-g.xAdjust)}::float8 as lng
  from (
    select p.n, left(p.s, 1) as k, split_part(substr(p.s, 2), ',', 1)::int as gx, split_part(substr(p.s, 2), ',', 2)::int as gy
    from unnest(string_to_array(replace(replace('
${lines.join('\n')}
', E'\\n', ''), ' ', ''), ';')) with ordinality as p(s, n)
  ) p
) c
on conflict (id) do nothing;
-- Контрольные числа (после вставки): сектора M${FIRST}…M${FIRST + feats.length - 1}: ${feats.length} шт.
--   река ${cnt('river')}, озеро ${cnt('lake')}, пруд ${cnt('pond')}; сумма lat ${sLat.toFixed(6)}, сумма lng ${sLng.toFixed(6)}.
`;
fs.writeFileSync('../../web/supabase-drafts/moscow-ckad-26-10/01_territories_moscow_ckad.sql', sql);
fs.writeFileSync('../../web/supabase-drafts/moscow-ckad-26-10/01_territories_moscow_ckad_ROLLBACK.sql', `-- Откат 01_territories_moscow_ckad.sql: убрать сектора M${FIRST}…M${FIRST + feats.length - 1}, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= 'M${FIRST}' and t.id <= 'M${FIRST + feats.length - 1}' and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
`);
console.log(JSON.stringify({ n: feats.length, river: cnt('river'), lake: cnt('lake'), pond: cnt('pond'), sLat: +sLat.toFixed(6), sLng: +sLng.toFixed(6) }));
