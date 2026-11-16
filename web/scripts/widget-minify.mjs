// terser as Next ships it (next/dist/compiled/terser), so no extra package.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const terser = require('next/dist/compiled/terser')

// Each widget's source script, by kind (the modules export it as *_SOURCE_JS).
export const WIDGET_SOURCES = {
  sector: async () => (await import('@/lib/telegram/widgets/sector')).SECTOR_SOURCE_JS,
  race: async () => (await import('@/lib/telegram/widgets/race')).RACE_SOURCE_JS,
  forecast: async () => (await import('@/lib/telegram/widgets/forecast')).FORECAST_SOURCE_JS,
  rating: async () => (await import('@/lib/telegram/widgets/rating')).RATING_SOURCE_JS,
  daily: async () => (await import('@/lib/telegram/widgets/daily')).DAILY_SOURCE_JS,
  hot: async () => (await import('@/lib/telegram/widgets/hot')).HOT_SOURCE_JS,
  catches: async () => (await import('@/lib/telegram/widgets/catches')).CATCHES_SOURCE_JS,
}

// The widget's whole script is its own top level: names can be shortened,
// except the placeholder __S__ (a free name, filled in per language).
export async function minifyWidgetJs(js) {
  const out = await terser.minify(js, { toplevel: true, compress: { passes: 2 }, mangle: true, format: { comments: false } })
  if (!out.code || !out.code.includes('__S__')) throw new Error('minify lost __S__')
  return out.code
}
