// Настройки новых городов (Санкт-Петербург, Сочи, Тбилиси) для fetch_osm_city.mjs,
// make_boundary.mjs, build_hex_city.mjs и assemble_city.mjs. Батуми и Москва остались
// на своих скриптах (build_hex.mjs, build_hex_moscow.mjs): их сектора уже в игре.
//
// prefix        буква id сектора (B — Батуми, M — Москва)
// bbox          рамка, по которой качаем OSM и строим сетку. ТА ЖЕ рамка должна стоять в
//               web/lib/data/hexGrid.ts (BBOXES), иначе сектор, добавленный админом,
//               не встанет в сетку города
// boundary      relation OSM с границей города: соты режутся по этому полигону
//               (make_boundary.mjs). Нет — режем по рамке и coastBufferKm
// coastBufferKm если задано, город — полоса такой ширины вдоль береговой линии (Сочи:
//               административный округ уходит на десятки км в горы)
// priority      если сота касается воды нескольких видов, берётся первый по списку
// canalAsRiver  waterway=canal считаем рекой (главные водотоки города)
// streamAsRiver ручьи (waterway=stream, от 800 м) считаем реками
// damBox        рамка, где автомагистраль идёт по дамбе или мосту над водой (fetch_osm_city.mjs
//               качает её в osm_<город>_roads.json): соты вдоль неё снимаются
export const CONFIG = {
  // Санкт-Петербург в границах города: Нева, реки, каналы, Финский залив, озёра, Кронштадт.
  spb: {
    prefix: 'P',
    bbox: { s: 59.62, w: 29.4, n: 60.25, e: 30.77 },
    boundary: 337422,
    // Дамба КЗС с автодорогой КАД через Финский залив: на ней и вдоль неё рыбачить нельзя.
    // Рамка только над заливом (материковый КАД у берега в неё не входит).
    damBox: { s: 59.84, w: 29.5, n: 60.08, e: 29.94 },
    priority: ['river', 'sea', 'lake', 'pond'],
    canalAsRiver: true,
  },
  // Сочи (с Адлером): всё побережье округа от границы по Псоу до северо-западного края,
  // полоса 5 км от моря; горные реки в этой полосе — реками.
  sochi: {
    prefix: 'S',
    bbox: { s: 43.385, w: 39.14, n: 44.04, e: 40.015 },
    boundary: null,
    coastBufferKm: 5,
    priority: ['sea', 'river', 'stream', 'lake', 'pond'],
    canalAsRiver: false,
    streamAsRiver: true,
  },
  // Тбилиси в границах города: Кура, Тбилисское море, Лиси, Черепашье.
  tbilisi: {
    prefix: 'T',
    bbox: { s: 41.62, w: 44.65, n: 41.84, e: 45.02 },
    boundary: 1996871,
    priority: ['river', 'lake', 'pond'],
    canalAsRiver: true,
  },
  // Москва между МКАД и ЦКАД: те же сектора M…, та же сетка, что у Москвы в МКАД (gridFrom —
  // рамка, по которой считалась её сетка: фаза сот берётся от неё, а не от рамки ЦКАД).
  moscow_ckad: {
    prefix: 'M',
    bbox: { s: 55.3, w: 36.85, n: 56.22, e: 38.59 },
    gridFrom: { s: 55.5718, w: 37.3688, n: 55.9111, e: 37.8435 },
    boundaryFile: 'ckad_ring.geojson',
    excludeFile: 'mkad_ring.geojson',
    existingFile: 'existing_moscow.json', // что уже в базе, чтобы не наложиться
    idStart: 4598, // в базе последний сектор Москвы M4597

    priority: ['river', 'lake', 'pond'],
    canalAsRiver: false,
  },
  // Только для проверки уже существующих секторов Москвы по новым правилам: выходные файлы
  // идут в hex_moscow_check.geojson, настоящие hex_moscow.geojson не трогаются.
  moscow_check: {
    prefix: 'M',
    inputName: 'moscow',
    outName: 'moscow_check',
    bbox: { s: 55.5718, w: 37.3688, n: 55.9111, e: 37.8435 },
    boundaryFile: 'mkad_ring.geojson',
    priority: ['river', 'sea', 'lake', 'pond'],
    canalAsRiver: false,
  },
};
