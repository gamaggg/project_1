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
  // Казань и окрестности (22.11.2026): граница городского округа (relation 367666), расширенная
  // на 30 км (make_buffer.mjs kazan_city kazan 30). Волга (Куйбышевское водохранилище), Казанка,
  // Свияга, Меша, озёра. Раифа (Волжско-Камский заповедник) снимается как закрытая зона.
  kazan: {
    prefix: 'K',
    bbox: { s: 55.33, w: 48.34, n: 56.21, e: 49.87 },
    gridFrom: { s: 55.33, w: 48.34, n: 56.21, e: 49.87 },
    boundaryFile: 'boundary_kazan.geojson',
    coreFile: 'boundary_kazan_city.geojson', // пруды только в самом городе
    // Волга у Казани в OSM — Куйбышевское водохранилище: её берег — река (решение владельца).
    riverWaterNames: /Куйбышевское водохранилище|^Волга$/,
    // Городские парки, помеченные охраняемыми, где рыбачить можно (решение владельца): не снимаем.
    allowZoneNames: /Русско-Немецкая Швейцария|Дендрарий|Зоостанция КГУ/,
    priority: ['river', 'lake', 'pond'],
    canalAsRiver: false,
  },
  // Нижний Новгород и окрестности (22.11.2026): городской округ (relation 335495) + 30 км
  // (make_buffer.mjs nnov_city nnov 30). Волга, Ока, Бор, Кстово, озёра.
  nnov: {
    prefix: 'N',
    bbox: { s: 55.57, w: 43.06, n: 56.7, e: 45.3 },
    gridFrom: { s: 55.57, w: 43.06, n: 56.7, e: 45.3 },
    boundaryFile: 'boundary_nnov.geojson',
    coreFile: 'boundary_nnov_city.geojson', // пруды только в самом городе
    riverWaterNames: /водохранилище$|^Волга$|^Ока$/,
    priority: ['river', 'lake', 'pond'],
    canalAsRiver: false,
  },
  // «Варна/Бургас» (22.11.2026): всё болгарское побережье от границы с Румынией до границы с
  // Турцией полосой 5 км от моря, плюс целиком Варненское и Белославское озёра и озёра Бургаса
  // (Вая, Атанасовское, Мандра), которые уходят от моря дальше 5 км (extraAreas).
  varna: {
    prefix: 'V',
    bbox: { s: 41.985, w: 27.25, n: 43.735, e: 28.65 },
    gridFrom: { s: 41.985, w: 27.25, n: 43.735, e: 28.65 },
    boundary: null,
    coastBufferKm: 5,
    // Примерная линия берега с севера на юг: только чтобы не качать плитки вдали от моря.
    coastGuideKm: 20,
    coastGuide: [[28.58, 43.735], [28.6, 43.55], [28.47, 43.36], [28.1, 43.4], [27.95, 43.2], [27.9, 43.0], [27.89, 42.82], [27.73, 42.66], [27.62, 42.57], [27.47, 42.5], [27.7, 42.42], [27.75, 42.25], [27.95, 42.1], [28.03, 41.985]],
    extraAreas: [
      { s: 43.15, w: 27.55, n: 43.23, e: 27.95 }, // Варненское и Белославское озёра
      { s: 42.38, w: 27.25, n: 42.62, e: 27.5 }, // Вая, Атанасовское, Мандра
    ],
    priority: ['sea', 'river', 'lake', 'pond'],
    canalAsRiver: false,
  },
  // Анапа (22.11.2026): муниципальный округ (relation 364543), полоса 5 км от моря, как Сочи:
  // от Благовещенской через Витязево, Джемете и Анапу до Сукко и Утриша, с лиманами.
  anapa: {
    prefix: 'A',
    bbox: { s: 44.7, w: 36.88, n: 45.2, e: 37.66 },
    gridFrom: { s: 44.7, w: 36.88, n: 45.2, e: 37.66 },
    boundaryFile: 'boundary_anapa.geojson',
    coastBufferKm: 5,
    // Кизилташский, Витязевский и Бугазский лиманы целиком (в границах округа), а не только 5 км от
    // моря (решение владельца): полоса 700 м вокруг лиманов, make_limans_anapa в README.
    extraFiles: ['boundary_anapa_limans.geojson'],
    priority: ['sea', 'river', 'lake', 'pond'],
    canalAsRiver: false,
  },
  // Киев и окрестности (22.11.2026): город (relation 421866) + 30 км (make_buffer.mjs kyiv_city kyiv 30).
  // Днепр, Десна, Киевское водохранилище, озёра.
  kyiv: {
    prefix: 'Y',
    bbox: { s: 49.94, w: 29.81, n: 50.87, e: 31.25 },
    gridFrom: { s: 49.94, w: 29.81, n: 50.87, e: 31.25 },
    boundaryFile: 'boundary_kyiv.geojson',
    // Днепр выше и ниже Киева в OSM — Киевское и Каневское водохранилища: их берег — река (решение владельца).
    riverWaterNames: /Київське водосховище|Канівське водосховище|Киевское водохранилище|Каневское водохранилище/,
    coreFile: 'boundary_kyiv_city.geojson', // пруды только в самом городе
    priority: ['river', 'lake', 'pond'],
    canalAsRiver: false,
  },
  // Одесса и окрестности (22.11.2026): Одесская городская громада (relation 12888405) + 30 км
  // (make_buffer.mjs odesa_city odesa 30). Море, Хаджибейский и Куяльницкий лиманы, Сухой лиман.
  odesa: {
    prefix: 'O',
    bbox: { s: 46.07, w: 30.21, n: 46.9, e: 31.23 },
    gridFrom: { s: 46.07, w: 30.21, n: 46.9, e: 31.23 },
    boundaryFile: 'boundary_odesa.geojson',
    // Нижнеднестровский нацпарк (дельта Днестра): рыбачить там можно, сектора остаются (решение владельца).
    allowZoneNames: /Нижньодністровський|Нижнеднестровский|Lower Dniester/,
    coreFile: 'boundary_odesa_city.geojson', // пруды только в самом городе
    priority: ['sea', 'river', 'lake', 'pond'],
    canalAsRiver: false,
  },
  // «Ереван/Севан» (22.11.2026): Ереван (relation 364087) + 30 км, обрезано по границе Армении
  // (make_buffer.mjs yerevan_city yerevan 30 armenia), и берег озера Севан (boundary_sevan.geojson:
  // рамка озера, обрезанная по границе Армении). Севан целиком в национальном парке, но рыбачить там
  // можно: зоны с этим именем не считаются закрытыми (allowZoneNames, решение владельца).
  yerevan: {
    prefix: 'E',
    bbox: { s: 39.8, w: 44.0, n: 40.66, e: 45.55 },
    gridFrom: { s: 39.8, w: 44.0, n: 40.66, e: 45.55 },
    boundaryFile: 'boundary_yerevan.geojson',
    coreFile: 'boundary_yerevan_city.geojson', // пруды только в самом городе
    extraFiles: ['boundary_sevan.geojson'],
    allowZoneNames: /Սևան|Sevan|Севан/,
    // Аракс — граница с Турцией (пограничная зона): там рыбачить нельзя.
    dropWaterNames: /Արաքս|Aras|Аракс/,
    priority: ['river', 'lake', 'pond'],
    canalAsRiver: false,
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
