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
      { d: 'M3 24C9 19 21 17 33 20c3 .8 5 1.8 6 2.6L45 18l-1 6 1 6-6-4.6c-1 .8-3 1.8-6 2.6C21 31 9 29 3 24Z', mode: 'fill' },
      { d: 'M23 18.6 27 13.5l2.4 5.6Z', mode: 'fill' },
      { circle: [9.5, 23, 1.6], mode: 'fill-bg' },
    ],
  },
  {
    id: 'carp',
    label: 'Карп',
    level: 1,
    parts: [
      { d: 'M5 24c3-9 14-13 24-10 5 1.5 8 5 9 7l6-5-1 8 1 8-6-5c-1 2-4 5.5-9 7C19 37 8 33 5 24Z', mode: 'fill' },
      { d: 'M17 13.4 23 8l6 5.6Z', mode: 'fill' },
      { circle: [11.5, 22.5, 1.8], mode: 'fill-bg' },
      { d: 'M16 30c3 1.6 7 2 11 1', mode: 'stroke-bg', w: 1.6 },
    ],
  },
  {
    id: 'perch',
    label: 'Окунь',
    level: 1,
    parts: [
      { d: 'M4 25c4-8 15-11 26-8 4 1 7 3.5 8.5 5.5L45 18l-1 7 1 7-6.5-4.5c-1.5 2-4.5 4.5-8.5 5.5C19 36 8 33 4 25Z', mode: 'fill' },
      { d: 'M13 17.6 15 10l3 6 3-7 3 6.5 3-5.5 2.5 6.6Z', mode: 'fill' },
      { d: 'M19 19v12M25 18.3v13.4M31 19v11', mode: 'stroke-bg', w: 2.2 },
      { circle: [9.5, 23.5, 1.6], mode: 'fill-bg' },
    ],
  },
  {
    id: 'hook',
    label: 'Крючок',
    level: 1,
    parts: [
      { circle: [28, 7.5, 3.2], mode: 'stroke', w: 3 },
      { d: 'M28 11v19c0 9-12 10.5-14 3', mode: 'stroke', w: 3.6 },
      { d: 'M13.5 33.5 19 30.5', mode: 'stroke', w: 3.2 },
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
      { d: 'M29 5C19 7 12 15.5 12 25.5 12 36 20.5 43.5 31 43.5c4 0 7.5-1.2 10-3.5-1.5.5-3 .6-4.5.6-9.5 0-16.5-7.3-16.5-16.3C20 16.4 24 9 29 5Z', mode: 'fill' },
      { d: 'M36 9l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3Z', mode: 'fill' },
    ],
  },
  {
    id: 'crossed_rods',
    label: 'Удочки',
    level: 1,
    parts: [
      { d: 'M7 41 39 7M41 41 9 7', mode: 'stroke', w: 3.4 },
      { circle: [14.5, 33.5, 3.8], mode: 'fill' },
      { circle: [33.5, 33.5, 3.8], mode: 'fill' },
      { d: 'M39 7q3.5 6 2 13M9 7Q5.5 13 7 20', mode: 'stroke', w: 1.8 },
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
      { d: 'M11 24c0-7 10-11 22-8 6 1.5 9 5 9 8s-3 6.5-9 8c-12 3-22-1-22-8Z', mode: 'fill' },
      { d: 'M11 24 3 20.5l1 7.5Z', mode: 'fill' },
      { d: 'M22 32.5v5c0 2.5-3 2.5-3.5.5M34 31v5c0 2.5-3 2.5-3.5.5', mode: 'stroke', w: 2.4 },
      { circle: [16, 22.5, 2.2], mode: 'fill-bg' },
      { d: 'M24 19.5c3-1 7-1 10 .5', mode: 'stroke-bg', w: 1.6 },
    ],
  },
  {
    id: 'catfish',
    label: 'Сом',
    level: 4,
    parts: [
      { d: 'M4 26c2-8 12-11 24-9 7 1 11 4 12 6l5-4-1 6 1 6-5-4c-2 3-6 6-14 6.5C14 34 5 32 4 26Z', mode: 'fill' },
      { d: 'M7 27c-4 3-5 7-4 10M9.5 28c-1 4 0 7 2 9M7 22c-4-2-6-5-6-8', mode: 'stroke', w: 1.8 },
      { circle: [11.5, 23.5, 1.6], mode: 'fill-bg' },
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
      { circle: [24, 24, 18], mode: 'stroke', w: 3 },
      { d: 'M24 9l4.5 15h-9Z', mode: 'fill' },
      { d: 'M24 39l-4.5-15h9Z', mode: 'fill-bg' },
      { d: 'M24 39l-4.5-15h9Z', mode: 'stroke', w: 1.6 },
      { circle: [24, 24, 2.2], mode: 'fill' },
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
      { d: 'M3 22c6-6 13-6 21 2 8-8 15-8 21-2', mode: 'stroke', w: 3.8 },
      { d: 'M26 34c3-3 6-3 9 1 3-4 6-4 8-2', mode: 'stroke', w: 2.6 },
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
