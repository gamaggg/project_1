// Шаг 4 для нового города: из hex_<город>.geojson пишет миграцию с секторами города и её откат.
// Как gen_ckad_sql.mjs: сектор записан видом воды и узлом сетки (gx, gy), центр и углы SQL считает сам
// по формулам web/lib/data/hexGrid.ts (рамка города = gridFrom в cities.mjs = BBOXES в hexGrid.ts).
// В конце миграция сверяет число секторов и сумму координат с тем, что посчитано здесь.
// Запуск: node gen_city_sql.mjs <город> <папка черновиков> <номер файла>
//   node gen_city_sql.mjs kazan ../../web/supabase-drafts/cities-22-11 02
import fs from 'fs';
import { CONFIG } from './cities.mjs';

const [CITY, DIR, NUM] = process.argv.slice(2);
const CFG = CONFIG[CITY];
if (!CFG || !DIR || !NUM || !CFG.gridFrom) { console.error('usage: node gen_city_sql.mjs <city with gridFrom> <dir> <num>'); process.exit(1); }
const src = fs.readFileSync('build_hex_city.mjs', 'utf8');
const latticeFrom = new Function(src.slice(src.indexOf('function latticeFrom'), src.indexOf('// ---------- сетка')) + '; return latticeFrom;')();
const g = latticeFrom(CFG.gridFrom, 600 / Math.sqrt(3));
const feats = JSON.parse(fs.readFileSync(`hex_${CITY}.geojson`, 'utf8')).features;
const P = CFG.prefix;
const FIRST = CFG.idStart ?? 1;
const LAST = FIRST + feats.length - 1;
if (LAST > 9999) throw new Error('more than 9999 sectors: ids do not fit 4 digits');
if (feats.some((f, i) => f.properties.id !== P + String(FIRST + i).padStart(4, '0'))) throw new Error('ids are not sequential');
const letter = { sea: 's', river: 'r', lake: 'l', pond: 'p' };
const packed = feats.map((f) => `${letter[f.properties.kind]}${f.properties.gx},${f.properties.gy}`);
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
const id = (k) => P + String(k).padStart(4, '0');
const name = `${NUM}_territories_${CITY}`;
const sql = `-- Сектора города «${CITY}» (${feats.length} штук, id ${id(FIRST)}…${id(LAST)}), ${new Date().toLocaleDateString('ru-RU')}.
-- Построены tools/fishing-hex (build_hex_city.mjs ${CITY}, предпросмотр map_${CITY}.html) по правилам городов:
-- только берег, настоящие реки, без мелких ручьёв, без заповедников, военных зон, аэродромов и портов.
-- Каждая запись: вид воды (s — море, r — река, l — озеро, p — пруд) и узел сетки gx,gy. Центр и углы считаются
-- здесь по формулам сетки приложения (web/lib/data/hexGrid.ts, рамка ${JSON.stringify(CFG.gridFrom)}):
-- ${n(g.cellWidth / 2)}° по долготе, ${n(g.cellHeight / 2)}° по широте, шаг ${n(g.xInterval)} / ${n(g.yInterval)}.
-- В конце — сверка: число секторов и сумма координат должны совпасть с посчитанными в tools/fishing-hex.
-- Откат: ${name}_ROLLBACK.sql (пока на секторах нет уловов и владельцев).
insert into public.territories (id, kind, lat, lng, corners, is_deleted)
select c.id, c.kind::public.territory_kind, c.lat, c.lng,
  (select jsonb_agg(jsonb_build_array(
            round((c.lat + ${n(g.cellHeight / 2)} * sin(radians(60 * i)))::numeric, 6),
            round((c.lng + ${n(g.cellWidth / 2)} * cos(radians(60 * i)))::numeric, 6)) order by i)
   from generate_series(0, 5) as i),
  false
from (
  select '${P}' || lpad((${FIRST - 1} + p.n)::text, 4, '0') as id,
    case p.k when 's' then 'sea' when 'r' then 'river' when 'l' then 'lake' else 'pond' end as kind,
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

do $chk$
declare v_n int; v_lat float8; v_lng float8;
begin
  select count(*), sum(lat), sum(lng) into v_n, v_lat, v_lng from public.territories
  where id >= '${id(FIRST)}' and id <= '${id(LAST)}' and length(id) = 5;
  if v_n <> ${feats.length} or abs(v_lat - ${sLat.toFixed(6)}) > 0.001 or abs(v_lng - ${sLng.toFixed(6)}) > 0.001 then
    raise exception '${CITY}: сверка не сошлась: % шт., сумма lat %, lng %', v_n, v_lat, v_lng;
  end if;
end $chk$;
-- Контрольные числа: ${feats.length} шт.: море ${cnt('sea')}, река ${cnt('river')}, озеро ${cnt('lake')}, пруд ${cnt('pond')};
-- сумма lat ${sLat.toFixed(6)}, сумма lng ${sLng.toFixed(6)}.
`;
fs.writeFileSync(`${DIR}/${name}.sql`, sql);
fs.writeFileSync(`${DIR}/${name}_ROLLBACK.sql`, `-- Откат ${name}.sql: убрать сектора ${id(FIRST)}…${id(LAST)}, пока на них нет уловов и владельцев.
delete from public.territories t where t.id >= '${id(FIRST)}' and t.id <= '${id(LAST)}' and length(t.id) = 5 and t.owner_id is null
  and not exists (select 1 from public.catches c where c.territory_id = t.id);
`);
console.log(JSON.stringify({ city: CITY, n: feats.length, sea: cnt('sea'), river: cnt('river'), lake: cnt('lake'), pond: cnt('pond'), sLat: +sLat.toFixed(6), sLng: +sLng.toFixed(6), bytes: sql.length }));
