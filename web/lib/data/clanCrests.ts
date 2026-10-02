// Clan crest parts. The ids and unlock levels must match the SQL
// public._clan_item_level() — the server validates every crest against it.
// Artwork is a first pass drawn to be swapped out later: replace the path
// data, keep the ids, and every existing clan picks up the new look.

export type ClanCrest = { shape: string; symbol: string; primary: string; secondary: string }

// A symbol is drawn in a 48×48 box from these parts. 'fill'/'stroke' use the
// symbol colour (white); '-bg' variants use the crest's primary colour, for
// details cut back into the white silhouette (eyes, stripes, spots).
type Part =
  | { d: string; mode: 'fill' | 'fill-bg' }
  | { d: string; mode: 'stroke' | 'stroke-bg'; w?: number }
  | { circle: [number, number, number]; mode: 'fill' | 'fill-bg' | 'stroke'; w?: number }

export type CrestShape = { id: string; label: string; level: number; d: string }
export type CrestSymbol = { id: string; label: string; level: number; parts: Part[] }

function rosettePath(): string {
  const n = 12
  const r = 38
  const bump = 18
  let d = ''
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
    const am = (a0 + a1) / 2
    const p0 = `${(50 + r * Math.cos(a0)).toFixed(1)} ${(50 + r * Math.sin(a0)).toFixed(1)}`
    const p1 = `${(50 + r * Math.cos(a1)).toFixed(1)} ${(50 + r * Math.sin(a1)).toFixed(1)}`
    const c = `${(50 + (r + bump) * Math.cos(am)).toFixed(1)} ${(50 + (r + bump) * Math.sin(am)).toFixed(1)}`
    d += `${i === 0 ? `M${p0}` : ''} Q${c} ${p1}`
  }
  return `${d}Z`
}

function helmParts(): Part[] {
  const parts: Part[] = [
    { circle: [24, 24, 12], mode: 'stroke', w: 3.4 },
    { circle: [24, 24, 4], mode: 'fill' },
  ]
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const x1 = 24 + 4 * Math.cos(a)
    const y1 = 24 + 4 * Math.sin(a)
    const x2 = 24 + 19 * Math.cos(a)
    const y2 = 24 + 19 * Math.sin(a)
    parts.push({ d: `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`, mode: 'stroke', w: 3 })
    parts.push({ circle: [+(24 + 20.5 * Math.cos(a)).toFixed(1), +(24 + 20.5 * Math.sin(a)).toFixed(1), 2.6], mode: 'fill' })
  }
  return parts
}

export const CREST_SHAPES: CrestShape[] = [
  { id: 'shield', label: 'Щит', level: 1, d: 'M50 4 90 16v32c0 24-18 40-40 48C28 88 10 72 10 48V16Z' },
  { id: 'round', label: 'Круг', level: 1, d: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92Z' },
  { id: 'hex', label: 'Сектор', level: 1, d: 'M50 4 90 27v46L50 96 10 73V27Z' },
  { id: 'diamond', label: 'Ромб', level: 1, d: 'M50 3 97 50 50 97 3 50Z' },
  { id: 'pennant', label: 'Вымпел', level: 2, d: 'M14 5h72v69L50 96 14 74Z' },
  { id: 'wave', label: 'Волна', level: 2, d: 'M11 24Q30 8 50 22T89 24v44Q89 90 50 96 11 90 11 68Z' },
  { id: 'rosette', label: 'Розетка', level: 4, d: rosettePath() },
  { id: 'anchor_frame', label: 'Иллюминатор', level: 4, d: 'M31 4h38l27 27v38L69 96H31L4 69V31Z' },
  { id: 'crown', label: 'Корона', level: 6, d: 'M10 30 28 12l22 16 22-16 18 18v26c0 20-18 34-40 40C28 90 10 76 10 56Z' },
  { id: 'bastion', label: 'Бастион', level: 8, d: 'M10 8h15v9h13V8h24v9h13V8h15v52c0 18-18 32-40 36C28 92 10 78 10 60Z' },
]

export const CREST_SYMBOLS: CrestSymbol[] = [
  {
    id: 'pike',
    label: 'Щука',
    level: 1,
    parts: [
      // Long and slender, pointed snout, the dorsal fin far back by the tail.
      { d: 'M3 24C8 20.4 18 19 30 20.4c3.5.4 5.5 1.4 7 2.4l7-4.3-1.5 5.5 1.5 5.5-7-4.3c-1.5 1-3.5 2-7 2.4C18 29 8 27.6 3 24Z', mode: 'fill' },
      { d: 'M28.5 20.6 32 15.8l2.6 5.4Z', mode: 'fill' },
      { d: 'M28.5 27.4 31.6 32l2.6-4.9Z', mode: 'fill' },
      { circle: [8.6, 22.9, 1.5], mode: 'fill-bg' },
      { d: 'M13.2 21.2q-1.6 2.8 0 5.6', mode: 'stroke-bg', w: 1.4 },
    ],
  },
  {
    id: 'carp',
    label: 'Карп',
    level: 1,
    parts: [
      // Deep, round-backed body with a long dorsal fin.
      { d: 'M6 25c0-8 8-12.5 17-12.5 7 0 12 3.5 14.5 8.5l7-5.5-1.5 9 1.5 8.5-7-4.5C35 33 30 36 23 36 14 36 6 32 6 25Z', mode: 'fill' },
      { d: 'M16.5 13.8C20.5 9.4 27 8.8 31.5 14Z', mode: 'fill' },
      { d: 'M21 35.6l2.5 4 3.5-4.1Z', mode: 'fill' },
      { circle: [12.2, 22.2, 1.8], mode: 'fill-bg' },
      { d: 'M17.2 17q-2.6 7.6 0 15', mode: 'stroke-bg', w: 1.6 },
    ],
  },
  {
    id: 'perch',
    label: 'Окунь',
    level: 1,
    parts: [
      // Humped back, spiny dorsal fin, dark vertical bands.
      { d: 'M4 25.5C5 19 12 15 21 15c8 0 13 3.5 16 7l7.5-5-1.5 8 1.5 8-7.5-5c-3 4-9 7-17 7-9 0-15-4-16-9.5Z', mode: 'fill' },
      { d: 'M12.5 16.4 14 9.5l2.6 5.2 2-6.2 2.4 5.6 2.2-5.2 2 5.4 2-4 1.8 6.2Z', mode: 'fill' },
      { d: 'M18.5 17.4v15.4M24.5 16v18M30.5 18v14', mode: 'stroke-bg', w: 2.4 },
      { circle: [9.5, 23.4, 1.7], mode: 'fill-bg' },
    ],
  },
  {
    id: 'hook',
    label: 'Крючок',
    level: 1,
    parts: [
      // The classic hook icon in one line: eye, shank, round bend, and the
      // point turning into the barb.
      { circle: [32, 13.5, 3.8], mode: 'stroke', w: 3.2 },
      { d: 'M32 17.4V30a10 10 0 0 1-20 0v-8l6 6', mode: 'stroke', w: 3.6 },
    ],
  },
  {
    id: 'anchor',
    label: 'Якорь',
    level: 1,
    parts: [
      { circle: [24, 8.5, 3.6], mode: 'stroke', w: 3 },
      { d: 'M24 12.5V41M16 17.5h16', mode: 'stroke', w: 3.4 },
      { d: 'M9 27c1 9 8 14 15 14s14-5 15-14', mode: 'stroke', w: 3.4 },
      { d: 'M5.5 29.5 9 25.5l3.5 4M35.5 29.5l3.5-4 3.5 4', mode: 'stroke', w: 3 },
    ],
  },
  {
    id: 'wave',
    label: 'Волна',
    level: 1,
    parts: [
      { d: 'M4 19c4-6 10-6 14 0s10 6 14 0 9-6 12-2', mode: 'stroke', w: 3.6 },
      { d: 'M4 30c4-6 10-6 14 0s10 6 14 0 9-6 12-2', mode: 'stroke', w: 3.6 },
    ],
  },
  {
    id: 'lighthouse',
    label: 'Маяк',
    level: 1,
    parts: [
      { d: 'M19 16h10l3 26H16Z', mode: 'fill' },
      { d: 'M18 9.5h12V15H18Z', mode: 'fill' },
      { d: 'M17 9.5 24 4l7 5.5Z', mode: 'fill' },
      { d: 'M18.2 24.5h11.6M17.3 33h13.4', mode: 'stroke-bg', w: 2.6 },
      { d: 'M34 10.5 42 7.5M34 14h9M14 10.5 6 7.5M14 14H5', mode: 'stroke', w: 2.2 },
    ],
  },
  {
    id: 'boat',
    label: 'Парусник',
    level: 1,
    parts: [
      { d: 'M23 5v27H9Z', mode: 'fill' },
      { d: 'M26 9v23h13Z', mode: 'fill' },
      { d: 'M5 35h38l-5.5 7h-27Z', mode: 'fill' },
    ],
  },
  {
    id: 'star',
    label: 'Звезда',
    level: 1,
    parts: [{ d: 'M24 4.5l5 12.8 13.4.8-10.3 8.6 3.3 13-11.4-7.2-11.4 7.2 3.3-13-10.3-8.6 13.4-.8Z', mode: 'fill' }],
  },
  {
    id: 'flame',
    label: 'Пламя',
    level: 1,
    parts: [
      { d: 'M24 3c3 9 12 13 12 25 0 8-5.4 15-12 15S12 36 12 28c0-6 3-10 6-13 0 5 2 8 5 9-1-7-1-14 1-21Z', mode: 'fill' },
      { d: 'M24 42c-3.5 0-6-3.5-6-7 0-4 3-6 4-9 2 4 8 5 8 9.5 0 3.5-2.5 6.5-6 6.5Z', mode: 'fill-bg' },
    ],
  },
  {
    id: 'moon',
    label: 'Луна',
    level: 1,
    parts: [
      // Crescent cut from a circle centred in the box, so it sits in the
      // middle of the crest; a small star in the hollow.
      { d: 'M22.41 7.07A17 17 0 1 0 40.43 28.37A14 14 0 1 1 22.41 7.07Z', mode: 'fill' },
      { d: 'M34.5 12.5l1.4 3.3 3.3 1.4-3.3 1.4-1.4 3.3-1.4-3.3-3.3-1.4 3.3-1.4Z', mode: 'fill' },
    ],
  },
  {
    id: 'crossed_rods',
    label: 'Удочки',
    level: 1,
    parts: [
      // Two rods crossed: thick cork handles, reels, thin tips with line.
      { d: 'M15.5 32.5 40 8M32.5 32.5 8 8', mode: 'stroke', w: 2.4 },
      { d: 'M7 41l8.5-8.5M41 41l-8.5-8.5', mode: 'stroke', w: 4.6 },
      { circle: [19, 35, 3.6], mode: 'fill' },
      { circle: [29, 35, 3.6], mode: 'fill' },
      { circle: [19, 35, 1.3], mode: 'fill-bg' },
      { circle: [29, 35, 1.3], mode: 'fill-bg' },
      { d: 'M40 8q4.5 5 3.5 13.5M8 8Q3.5 13 4.5 21.5', mode: 'stroke', w: 1.3 },
      { d: 'M43.5 21.5c0 2.6-2.6 2.6-2.8.6M4.5 21.5c0 2.6 2.6 2.6 2.8.6', mode: 'stroke', w: 1.5 },
    ],
  },
  {
    id: 'trout',
    label: 'Форель',
    level: 2,
    parts: [
      { d: 'M4 24c6-6 18-8 28-4.5 3.5 1 5.5 2.3 6.5 3.3L45 18.5 44.2 24l.8 5.5-6.5-4.3c-1 1-3 2.3-6.5 3.3C22 32 10 30 4 24Z', mode: 'fill' },
      { d: 'M19 17.8 23 13.5l3 4.7Z', mode: 'fill' },
      { circle: [17.5, 22.5, 1.3], mode: 'fill-bg' },
      { circle: [23.5, 21, 1.3], mode: 'fill-bg' },
      { circle: [28, 24.8, 1.3], mode: 'fill-bg' },
      { circle: [21.5, 26.5, 1.1], mode: 'fill-bg' },
      { circle: [9.5, 23, 1.6], mode: 'fill-bg' },
    ],
  },
  {
    id: 'lure',
    label: 'Воблер',
    level: 2,
    parts: [
      // A wobbler: fish-shaped hard body, solid diving lip under the nose,
      // double hooks under the belly and the tail.
      { d: 'M9 21.5c0-5 6.5-8 15-8 8 0 14 3.5 18 8-4 4.5-10 8-18 8-8.5 0-15-3-15-8Z', mode: 'fill' },
      { d: 'M9.8 23.6 3.2 30.4l2.6 2.4 6.8-6.6Z', mode: 'fill' },
      { circle: [14.4, 20.2, 2.2], mode: 'fill-bg' },
      { d: 'M19 15.2q-2.2 6.3 0 12.6', mode: 'stroke-bg', w: 1.5 },
      { d: 'M24 29.6v4M24 33.6c0 3.2-4.6 3.2-4.6 0M24 33.6c0 3.2 4.6 3.2 4.6 0', mode: 'stroke', w: 2.2 },
      { d: 'M39 25.6v4M39 29.6c0 3.2-4.6 3.2-4.6 0M39 29.6c0 3.2 4.6 3.2 4.6 0', mode: 'stroke', w: 2.2 },
    ],
  },
  {
    id: 'catfish',
    label: 'Сом',
    level: 4,
    parts: [
      // Wide flat head with a broad mouth, long tapering body, rounded tail.
      { d: 'M3.5 24c0-5 4.5-7.5 11.5-7 9 .5 16 3 22 5.5l7.5-3.5c2 3.6 2 7.4 0 11L37 26.5c-7 3-15 5-23 4.5C7.5 30.6 3.5 28.5 3.5 24Z', mode: 'fill' },
      { d: 'M17 17.3l3-3.8 2.5 4.3Z', mode: 'fill' },
      { circle: [9.2, 21.6, 1.4], mode: 'fill-bg' },
      { d: 'M3.8 25.4H9.5', mode: 'stroke-bg', w: 1.4 },
    ],
  },
  {
    id: 'spoon',
    label: 'Блесна',
    level: 4,
    parts: [
      { circle: [24, 3.8, 2], mode: 'stroke', w: 2 },
      { d: 'M24 6c7 0 11 7 11 15 0 10-6 16-11 16s-11-6-11-16c0-8 4-15 11-15Z', mode: 'fill' },
      { d: 'M24 12c4 0 6 4 6 9', mode: 'stroke-bg', w: 2 },
      { d: 'M24 37v4c0 3-4 3.5-4.5 1M24 41c0 3 4 3.5 4.5 1', mode: 'stroke', w: 2.4 },
    ],
  },
  {
    id: 'compass',
    label: 'Компас',
    level: 4,
    parts: [
      // A compass rose, no ring (a ring inside a round crest reads as a
      // target): long north–south points, shorter east–west, small diagonal
      // points behind them, and a pivot in the middle.
      { d: 'M24 20.6 32.2 15.8 27.4 24 32.2 32.2 24 27.4 15.8 32.2 20.6 24 15.8 15.8Z', mode: 'fill' },
      { d: 'M24 5.5 27.2 20.8 39 24 27.2 27.2 24 42.5 20.8 27.2 9 24 20.8 20.8Z', mode: 'fill' },
      { d: 'M24 5.5 27.2 20.8 39 24 27.2 27.2 24 42.5 20.8 27.2 9 24 20.8 20.8Z', mode: 'stroke-bg', w: 1.3 },
      { circle: [24, 24, 2.4], mode: 'fill-bg' },
    ],
  },
  { id: 'helm', label: 'Штурвал', level: 4, parts: helmParts() },
  {
    id: 'trident',
    label: 'Трезубец',
    level: 6,
    parts: [
      { d: 'M24 9v34', mode: 'stroke', w: 3.4 },
      { d: 'M13 10v8c0 5 4 7 11 7s11-2 11-7v-8', mode: 'stroke', w: 3.4 },
      { d: 'M10.5 11 13 4l2.5 7ZM21.5 10 24 3l2.5 7ZM32.5 11 35 4l2.5 7Z', mode: 'fill' },
    ],
  },
  {
    id: 'crab',
    label: 'Краб',
    level: 6,
    parts: [
      { d: 'M11 27c0-7 6-10 13-10s13 3 13 10c0 5-6 8-13 8s-13-3-13-8Z', mode: 'fill' },
      { d: 'M6 12c-2 5 1 9 5 9l1-2c-3-.5-3.5-3-2-5ZM42 12c2 5-1 9-5 9l-1-2c3-.5 3.5-3 2-5Z', mode: 'fill' },
      { d: 'M12 30 5 34M12 26H5M36 30l7 4M36 26h7M20 17v-4M28 17v-4', mode: 'stroke', w: 2.4 },
      { circle: [20, 12, 1.8], mode: 'fill' },
      { circle: [28, 12, 1.8], mode: 'fill' },
    ],
  },
  {
    id: 'gull',
    label: 'Чайка',
    level: 6,
    parts: [
      // Two gulls in flight: crescent wings, the far one smaller.
      { d: 'M4 21c6-6 13-6 20 1.5C31 15 38 15 44 21c-6-2.4-13-1.4-20 6.5C17 19.6 10 18.6 4 21Z', mode: 'fill' },
      { d: 'M24 34c3.2-3.2 6.6-3.2 9.6.6 3-3.8 6.4-3.8 9.6-.6-3-1-6.2-.4-9.6 3.6-3.4-4-6.6-4.6-9.6-3.6Z', mode: 'fill' },
    ],
  },
  {
    id: 'whale',
    label: 'Кит',
    level: 8,
    parts: [
      { d: 'M5 28c0-8 9-12 19-11 9 1 14 6 16 11l5-6c1 4-.5 8-4 10-3 4-10 6-18 6-11 0-18-4-18-10Z', mode: 'fill' },
      { d: 'M18 14c0-4-2-6-4-7M18 14c0-4 2-6 4-7', mode: 'stroke', w: 2.4 },
      { circle: [13, 26.5, 1.7], mode: 'fill-bg' },
      { d: 'M8 32c7 3 18 3 26 1', mode: 'stroke-bg', w: 1.8 },
    ],
  },
  {
    id: 'octopus',
    label: 'Осьминог',
    level: 8,
    parts: [
      { d: 'M24 4c8 0 13 6 13 14 0 5-3 8-6 9H17c-3-1-6-4-6-9 0-8 5-14 13-14Z', mode: 'fill' },
      { d: 'M17 27c-1 6-5 8-8 7M21 27c0 7-2 12-5 14M27 27c0 7 2 12 5 14M31 27c1 6 5 8 8 7', mode: 'stroke', w: 3 },
      { circle: [19.5, 16.5, 2.1], mode: 'fill-bg' },
      { circle: [28.5, 16.5, 2.1], mode: 'fill-bg' },
    ],
  },
  { id: 'bolt', label: 'Молния', level: 8, parts: [{ d: 'M27 3 10 27h12l-3 18 19-26H26Z', mode: 'fill' }] },
]

export const CREST_COLORS: { id: string; label: string }[] = [
  { id: '#FC5200', label: 'Оранжевый' },
  { id: '#E5322D', label: 'Красный' },
  { id: '#C2185B', label: 'Малиновый' },
  { id: '#7B3FC7', label: 'Фиолетовый' },
  { id: '#3949AB', label: 'Индиго' },
  { id: '#1D6FC9', label: 'Синий' },
  { id: '#0E8A9A', label: 'Бирюзовый' },
  { id: '#1F8A5B', label: 'Зелёный' },
  { id: '#6B8E23', label: 'Оливковый' },
  { id: '#D99A1E', label: 'Золотой' },
  { id: '#6D4C41', label: 'Коричневый' },
  { id: '#2B2D33', label: 'Графит' },
]

// The ring can also be white or cream — both read on every primary above.
export const CREST_SECONDARY_COLORS: { id: string; label: string }[] = [
  { id: '#FFFFFF', label: 'Белый' },
  { id: '#FFE7C2', label: 'Кремовый' },
  ...CREST_COLORS,
]

export const DEFAULT_CREST: ClanCrest = { shape: 'shield', symbol: 'pike', primary: '#FC5200', secondary: '#FFE7C2' }

const SHAPES_BY_ID = new Map(CREST_SHAPES.map((s) => [s.id, s]))
const SYMBOLS_BY_ID = new Map(CREST_SYMBOLS.map((s) => [s.id, s]))

export function crestShape(id: string): CrestShape {
  return SHAPES_BY_ID.get(id) ?? CREST_SHAPES[0]
}
export function crestSymbol(id: string): CrestSymbol {
  return SYMBOLS_BY_ID.get(id) ?? CREST_SYMBOLS[0]
}

// Anything that came out of the DB as jsonb — falls back part by part so a
// crest with one retired id still renders instead of breaking.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function resolveCrest(raw: unknown): ClanCrest {
  const c = (raw ?? {}) as Partial<ClanCrest>
  return {
    shape: SHAPES_BY_ID.has(c.shape ?? '') ? c.shape! : DEFAULT_CREST.shape,
    symbol: SYMBOLS_BY_ID.has(c.symbol ?? '') ? c.symbol! : DEFAULT_CREST.symbol,
    // Checked as a hex colour, not just a string: crestSvgMarkup below puts
    // it straight into markup for the map's Leaflet labels.
    primary: typeof c.primary === 'string' && HEX_RE.test(c.primary) ? c.primary : DEFAULT_CREST.primary,
    secondary: typeof c.secondary === 'string' && HEX_RE.test(c.secondary) ? c.secondary : DEFAULT_CREST.secondary,
  }
}

// The small, flat crest as a markup string — for places that need HTML
// rather than a React element (the map's Leaflet divIcon labels). Every
// value interpolated here comes out of resolveCrest, so it's a known id's
// path data or a validated #RRGGBB colour.
export function crestSvgMarkup(raw: unknown, size: number): string {
  const c = resolveCrest(raw)
  const shape = crestShape(c.shape)
  const symbol = crestSymbol(c.symbol)
  const edge = shadeHex(c.primary, -0.38)
  const parts = symbol.parts
    .map((p) => {
      if ('circle' in p) {
        const [cx, cy, r] = p.circle
        return p.mode === 'stroke'
          ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${p.w ?? 3}"/>`
          : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.mode === 'fill-bg' ? c.primary : '#fff'}"/>`
      }
      if (p.mode === 'fill' || p.mode === 'fill-bg') return `<path d="${p.d}" fill="${p.mode === 'fill' ? '#fff' : c.primary}"/>`
      return `<path d="${p.d}" fill="none" stroke="${p.mode === 'stroke' ? '#fff' : c.primary}" stroke-width="${'w' in p ? (p.w ?? 3) : 3}" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join('')
  const ring = size > 18 ? `<g transform="translate(50 50) scale(.8) translate(-50 -50)"><path d="${shape.d}" fill="none" stroke="${c.secondary}" stroke-width="6.5" stroke-linejoin="round"/></g>` : ''
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><path d="${shape.d}" fill="${c.primary}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>${ring}<g transform="translate(22.4 22.4) scale(1.15)">${parts}</g></svg>`
}

// Mixes a #RRGGBB colour toward black (amount < 0) or white (amount > 0).
export function shadeHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const target = amount < 0 ? 0 : 255
  const t = Math.abs(amount)
  const ch = (v: number) => Math.round(v + (target - v) * t)
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}
