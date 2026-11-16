// Shared bits of the Telegram chat widgets (Bot API 10.4 sendWidget). A widget
// is one HTML string that Telegram draws inside the message bubble. Its rules
// ("widget profile 1", core.telegram.org/bots/widgets) shape everything here:
// - at most 32 KB of HTML and 4 KB after zlib level 9;
// - no network at all: no fonts, no images by URL, no fetch — what the widget
//   shows comes in the message (chat_data, up to 1024 bytes) or as the bot's
//   answer to TelegramWidget.request();
// - no clip-path, mask, color-mix(), text-shadow, grayscale(), @font-face,
//   SVG clipPath/mask/filter, vh units — colours are mixed here, in TS;
// - generic font families only (system-ui).
// The scenes copy the app's own (LeafletMap runSectorMoment + .smx, AwayReplay,
// RaceBoat + RaceRiver, BiteForecast): same moves, timings and colours, drawn
// without the map underneath. Change one with the other.

import type { Lang } from '@/lib/i18n/core'

export type WidgetKind = 'sector' | 'race' | 'forecast' | 'rating' | 'daily' | 'hot' | 'catches'

export type BuiltWidget = {
  kind: WidgetKind
  html: string
  // JSON the widget reads as TelegramWidget.chatData (≤ 1024 bytes).
  chatData: string
  // The widget asks the bot for the live state when it appears.
  allowQueries: boolean
}

// Collapse CSS whitespace (the templates are written readably).
export function minCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()
}

// JS is written compactly by hand; this only drops line indentation and
// whole-line comments, so string contents are never touched.
export function minJs(js: string): string {
  return js
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .join('\n')
}

// Data for a <script>: JSON that can't close the tag.
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'))
}

export function pack(css: string, body: string, js: string): string {
  return `<style>${minCss(css)}</style>${body}<script>${minJs(js)}</script>`
}

// A #RRGGBB colour with alpha, as rgba() — the stand-in for color-mix(… transparent).
export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// color-mix(in srgb, a p%, b) for two #RRGGBB colours.
export function mixHex(a: string, b: string, p: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const ch = (s: number) => Math.round(((x >> s) & 255) * p + ((y >> s) & 255) * (1 - p))
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`
}

const HEX = /^#[0-9a-fA-F]{6}$/
export const safeColor = (c: unknown, fallback: string): string => (typeof c === 'string' && HEX.test(c) ? c : fallback)

// The first two letters of a name, as the app's avatar fallback (avatarInnerHtml).
export const initials = (name: string | null | undefined, fallback: string): string => (name || fallback).slice(0, 2).toUpperCase()

// Fits a string into `max` UTF-8 bytes (chat_data and query answers are limited in bytes).
export function clipBytes(s: string, max: number): string {
  const enc = new TextEncoder()
  if (enc.encode(s).length <= max) return s
  let out = ''
  for (const ch of s) {
    if (enc.encode(out + ch).length > max - 1) break
    out += ch
  }
  return `${out}…`
}

export type WidgetLang = Lang
