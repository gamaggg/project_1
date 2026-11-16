import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { sectorWidgetHtml, sectorChatData } from '@/lib/telegram/widgets/sector.ts'
import { raceWidgetHtml, raceChatData } from '@/lib/telegram/widgets/race.ts'
import { forecastWidgetHtml, forecastChatData } from '@/lib/telegram/widgets/forecast.ts'
import { ratingWidgetHtml, ratingChatData } from '@/lib/telegram/widgets/rating.ts'
import { dailyWidgetHtml } from '@/lib/telegram/widgets/daily.ts'
import { hotWidgetHtml, hotChatData } from '@/lib/telegram/widgets/hot.ts'
import { catchesWidgetHtml, catchesChatData } from '@/lib/telegram/widgets/catches.ts'
import { MIN_JS } from '@/lib/telegram/widgets/min.generated.ts'
import { minifyWidgetJs, WIDGET_SOURCES } from '../scripts/widget-minify.mjs'

// Telegram refuses a widget over 32 KB of HTML or 4 KB after zlib level 9
// (INPUT_MEDIA_WIDGET_TOO_LARGE), and chat_data over 1024 bytes; it silently
// drops what «widget profile 1» does not support (core.telegram.org/bots/widgets).

const LANGS = ['ru', 'en', 'ka']
const BUILDERS = { sector: sectorWidgetHtml, race: raceWidgetHtml, forecast: forecastWidgetHtml, rating: ratingWidgetHtml, daily: dailyWidgetHtml, hot: hotWidgetHtml, catches: catchesWidgetHtml }
const bytes = (s) => Buffer.byteLength(s)

for (const [kind, build] of Object.entries(BUILDERS)) {
  for (const lang of LANGS) {
    test(`${kind} (${lang}) fits Telegram's limits`, () => {
      const html = build(lang)
      assert.ok(bytes(html) <= 32768, `${bytes(html)} bytes`)
      const packed = deflateSync(Buffer.from(html), { level: 9 }).length
      assert.ok(packed <= 4096, `${packed} bytes after zlib-9`)
      assert.ok(!html.includes('\u0000'))
    })
  }

  test(`${kind} uses nothing outside widget profile 1`, () => {
    const html = build('ru')
    for (const banned of ['clip-path', 'color-mix', 'text-shadow', 'grayscale(', '@font-face', '<clipPath', '<mask', 'backdrop-filter', 'fetch(', 'XMLHttpRequest', '<input', '<img']) {
      assert.ok(!html.includes(banned), `${kind} uses ${banned}`)
    }
    assert.ok(!/\d(vh|dvh|svh)\b/.test(html), `${kind} uses a vh unit`)
    assert.ok(!html.includes('__S__'), 'strings not filled in')
  })
}

test('min.generated.ts is up to date (run scripts/build-widgets.mjs)', async () => {
  for (const [kind, load] of Object.entries(WIDGET_SOURCES)) assert.equal(MIN_JS[kind], await minifyWidgetJs(await load()), kind)
  assert.deepEqual(Object.keys(WIDGET_SOURCES).sort(), Object.keys(BUILDERS).sort())
})

const long = 'Очень-очень длинное имя рыбака, которое не влезет никуда'.repeat(3)

test('sector chat_data stays under 1024 bytes', () => {
  const d = sectorChatData({ kind: 'lost', sectorId: 'B1509', by: { name: long, color: '#A855F7' }, me: { name: long, color: 'not a colour' }, defense: 0, when: '07:42' })
  assert.ok(bytes(d) <= 1024)
  const o = JSON.parse(d)
  assert.equal(o.m.c, '#3E7BFA', 'a bad colour falls back')
  assert.equal(o.k, 'l')
})

test('race chat_data keeps the player clan in five lanes, under 1024 bytes', () => {
  const clans = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `${long}${i}`, primary: '#1F8A5B', secondary: '#FFFFFF', meters: 100 * (9 - i), finish: 2600, rank: i + 1, finished: false }))
  const d = raceChatData({ weekEnd: '2026-11-22T20:00:00+00:00', myClanId: 9, clans })
  assert.ok(bytes(d) <= 1024, `${bytes(d)} bytes`)
  const o = JSON.parse(d)
  assert.equal(o.c.length, 5)
  assert.ok(o.c.some((c) => c.i === 9), 'own clan kept')
  assert.equal(o.n, 9)
})

test('forecast chat_data carries 24 hours under 1024 bytes', () => {
  const hourly = Array.from({ length: 24 }, () => ({ score: 3, level: 2.5, temp: 12.4, wind: 3.2, windDir: 200, gusts: 6, pressureHpa: 1012, precip: 0.3, wave: 0.4, code: 2 }))
  const day = {
    date: '2026-11-17', score: 4, avgScore: 3, bestScore: 5, hours: hourly.map(() => 1), hourly, best: { from: 6, to: 9 },
    pressureHpa: 1012, pressureTrend: -1, wind: 3, windDir: 200, gusts: 6, wave: 0.4, waterTemp: 16.6, precip: 0, storm: false,
    tempMin: 8, tempMax: 17, code: 2, moon: { phase: 'full', illumination: 1 }, sunrise: '2026-11-17T07:41', sunset: '2026-11-17T17:20',
  }
  const d = forecastChatData(day, 'ru', 'Батуми', 'Завтра · 17 нояб.')
  assert.ok(bytes(d) <= 1024, `${bytes(d)} bytes`)
  const o = JSON.parse(d)
  assert.equal(o.h.split(';').length, 24)
  assert.equal(o.f, 6)
  assert.equal(o.x, 1, 'sea: the hour shows the wave')
})

test('rating, hot and catches chat_data stay under 1024 bytes', () => {
  const row = (rank) => ({ rank, name: long, sectors: 12, catches: 345, me: rank === 11 })
  const r = ratingChatData({ lastWeek: false, weekLabel: 'Ноябрь, 3 неделя', top: [1, 2, 3].map(row), rows: [10, 11, 12].map(row) })
  assert.ok(bytes(r) <= 1024, `rating ${bytes(r)}`)
  const h = hotChatData([{ id: 'B1432', holder: 'other', name: long, color: '#C2410C' }, { id: 'B1433', holder: 'free', name: null, color: null }], 'вс, 23:59')
  assert.ok(bytes(h) <= 1024, `hot ${bytes(h)}`)
  const items = Array.from({ length: 30 }, () => ({ species: 'Морская собачка', meta: '24 см · 180 г', time: '08:30', category: 'marine' }))
  const c = catchesChatData({ who: long, sectorId: 'B1432', kind: 'Море', claimed: true, when: 'Сегодня · 06:40–18:12', items, catchId: 123456 })
  assert.ok(bytes(c) <= 1024, `catches ${bytes(c)}`)
  assert.ok(JSON.parse(c).i.length >= 1)
})
