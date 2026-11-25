import { tnd } from '@/lib/i18n/runtime'

// The northern-lights hero background's settings (AuroraGL.tsx) and its ready presets. The presets are the ones the
// shadcn.io Aurora page lists (Borealis, Arctic, Dusk, Ember, Mono, Veil — props copied from its page, 25.11.2026); the
// «Mono» preset there takes the page theme's colours, here it is silver. A player picks a preset and tunes the colours
// and a few sliders; whatever comes from outside (the database) goes through sanitizeAurora, so a bad value can never reach
// the shader.
export type AuroraSettings = {
  // Two to four colours, from the curtains' lower edge to their tips.
  colors: string[]
  amplitude: number
  height: number
  intensity: number
  layers: number
  placement: 'top' | 'bottom'
  rays: number
  reach: number
  scale: number
  speed: number
}

export const AURORA_DEFAULT: AuroraSettings = {
  colors: ['#22e584', '#19d3c5', '#4f7dff', '#a05cff'],
  amplitude: 1,
  height: 0.42,
  intensity: 1,
  layers: 2,
  placement: 'top',
  rays: 0.7,
  reach: 0.5,
  scale: 1,
  speed: 1,
}

// The sliders' ranges (also the clamp).
export const AURORA_RANGES = {
  intensity: [0.3, 1.5],
  height: [0.05, 0.8],
  rays: [0, 1],
  speed: [0.2, 2],
  amplitude: [0.3, 2],
  reach: [0.2, 1],
  scale: [0.4, 2],
} as const

export const AURORA_MAX_COLORS = 4

export type AuroraPreset = { id: string; label: string; settings: Partial<AuroraSettings> }

export const AURORA_PRESETS: AuroraPreset[] = [
  {
    id: 'borealis',
    get label() {
      return tnd('aurora.borealis')
    },
    settings: {},
  },
  {
    id: 'arctic',
    get label() {
      return tnd('aurora.arctic')
    },
    settings: { amplitude: 0.6, colors: ['#8fe3ff', '#e8f6ff', '#6f9bff'], rays: 0.4, speed: 0.6 },
  },
  {
    id: 'dusk',
    get label() {
      return tnd('aurora.dusk')
    },
    settings: { amplitude: 1.5, colors: ['#ffb35c', '#ff5c8a', '#8a5cff'], layers: 3, rays: 1 },
  },
  {
    id: 'ember',
    get label() {
      return tnd('aurora.ember')
    },
    settings: { colors: ['#ffd166', '#ff7a3d', '#d7263d'], height: 0.12, placement: 'bottom', reach: 0.7 },
  },
  {
    id: 'mono',
    get label() {
      return tnd('aurora.mono')
    },
    settings: { colors: ['#ffffff', '#8a8f98'], intensity: 0.7 },
  },
  {
    id: 'veil',
    get label() {
      return tnd('aurora.veil')
    },
    settings: { colors: ['#7cff67', '#22d3c5', '#8f5cff'], intensity: 0.8, layers: 3, rays: 0.2, reach: 0.8, scale: 0.6 },
  },
]

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(hi, Math.max(lo, n))
}

const HEX = /^#[0-9a-fA-F]{6}$/

// Anything → valid settings: unknown fields dropped, numbers clamped, colours checked (2–4 of them, «#rrggbb»), the rest
// from the default.
export function sanitizeAurora(raw: unknown): AuroraSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const colors = Array.isArray(r.colors) ? r.colors.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, AURORA_MAX_COLORS) : []
  const d = AURORA_DEFAULT
  return {
    colors: colors.length >= 2 ? colors.map((c) => c.toLowerCase()) : d.colors,
    amplitude: clamp(r.amplitude, ...AURORA_RANGES.amplitude, d.amplitude),
    height: clamp(r.height, ...AURORA_RANGES.height, d.height),
    intensity: clamp(r.intensity, ...AURORA_RANGES.intensity, d.intensity),
    layers: Math.round(clamp(r.layers, 1, 3, d.layers)),
    placement: r.placement === 'bottom' ? 'bottom' : 'top',
    rays: clamp(r.rays, ...AURORA_RANGES.rays, d.rays),
    reach: clamp(r.reach, ...AURORA_RANGES.reach, d.reach),
    scale: clamp(r.scale, ...AURORA_RANGES.scale, d.scale),
    speed: clamp(r.speed, ...AURORA_RANGES.speed, d.speed),
  }
}

// A preset → full settings (on top of the default).
export function presetSettings(id: string): AuroraSettings {
  const p = AURORA_PRESETS.find((x) => x.id === id)
  return sanitizeAurora({ ...AURORA_DEFAULT, ...(p?.settings ?? {}) })
}

// Which preset the settings equal exactly, if any (the chip that lights up).
export function matchingPreset(s: AuroraSettings): string | null {
  const key = JSON.stringify(s)
  return AURORA_PRESETS.find((p) => JSON.stringify(presetSettings(p.id)) === key)?.id ?? null
}
