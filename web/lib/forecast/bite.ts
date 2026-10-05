// Прогноз клёва: weather from Open-Meteo (free, no key, CC BY 4.0 — the
// sheet credits it), scored on the phone. Every hour gets a 0–~1.1 factor
// product (pressure level and trend, wind, waves on the sea, rain, dawn and
// dusk); a day's 1–5 blends its best 3-hour stretch with the whole daytime,
// nudged by the moon and by how far the pressure swings over the day — so
// the score is the weather's alone, and sectors side by side share it.
// Where a sector has its own catch history, that (not the generic dawn/dusk
// guess) picks the «лучшее время» window: a spot people fish at night gets a
// night window, matching its «Что клюёт здесь». Deliberately simple and readable: it has to explain
// itself in the sheet's factor rows, not be a black box.

export type ForecastPoint = { lat: number; lng: number }

export type RawForecast = {
  times: string[] // local 'YYYY-MM-DDTHH:mm', yesterday + 4 days
  pressure: number[] // hPa, mean sea level
  wind: number[] // m/s
  gusts: number[]
  precip: number[] // mm
  temp: number[]
  code: number[] // WMO weather code
  wave: (number | null)[] | null // m; null off the sea
  days: { date: string; sunrise: string; sunset: string }[]
}

export type MoonPhase = 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous' | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent'

export type ForecastDay = {
  date: string
  score: 1 | 2 | 3 | 4 | 5
  // 24 hourly factors, local hours 0–23.
  hours: number[]
  best: { from: number; to: number } | null
  pressureHpa: number
  // hPa over the day — what the angler reads as «падает / растёт».
  pressureTrend: number
  wind: number
  gusts: number
  wave: number | null
  tempMin: number
  tempMax: number
  code: number
  moon: { phase: MoonPhase; illumination: number }
  sunrise: string
  sunset: string
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`open-meteo ${res.status}`)
  return res.json()
}

export async function fetchRawForecast(point: ForecastPoint, timezone: string, sea: ForecastPoint | null): Promise<RawForecast> {
  const common = `timezone=${encodeURIComponent(timezone)}&past_days=1&forecast_days=4`
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(3)}&longitude=${point.lng.toFixed(3)}` +
    `&hourly=temperature_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,precipitation,weather_code&daily=sunrise,sunset&wind_speed_unit=ms&${common}`
  const marineUrl = sea
    ? `https://marine-api.open-meteo.com/v1/marine?latitude=${sea.lat.toFixed(3)}&longitude=${sea.lng.toFixed(3)}&hourly=wave_height&${common}`
    : null
  const [weather, marine] = await Promise.all([
    getJson(weatherUrl),
    // Waves are a bonus: a failed marine call still leaves a forecast.
    marineUrl ? getJson(marineUrl).catch(() => null) : Promise.resolve(null),
  ])
  const h = weather.hourly as Record<string, (number | null)[]> & { time: string[] }
  const d = weather.daily as { time: string[]; sunrise: string[]; sunset: string[] }
  const num = (xs: (number | null)[]) => xs.map((x) => x ?? 0)
  const waves = marine ? ((marine.hourly as Record<string, (number | null)[]>).wave_height ?? null) : null
  return {
    times: h.time,
    pressure: num(h.pressure_msl),
    wind: num(h.wind_speed_10m),
    gusts: num(h.wind_gusts_10m),
    precip: num(h.precipitation),
    temp: num(h.temperature_2m),
    code: num(h.weather_code),
    wave: waves && waves.some((w) => w != null) ? waves : null,
    days: d.time.map((date, i) => ({ date, sunrise: d.sunrise[i], sunset: d.sunset[i] })),
  }
}

// --- Moon: days since a known new moon, modulo the synodic month. ---
const SYNODIC = 29.530588853
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14)

export function moonAt(date: Date): { phase: MoonPhase; illumination: number; age: number } {
  const age = ((((date.getTime() - NEW_MOON_EPOCH) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC
  const f = age / SYNODIC
  const illumination = (1 - Math.cos(2 * Math.PI * f)) / 2
  const phase: MoonPhase =
    f < 0.034 || f >= 0.966 ? 'new'
    : f < 0.216 ? 'waxingCrescent'
    : f < 0.284 ? 'firstQuarter'
    : f < 0.466 ? 'waxingGibbous'
    : f < 0.534 ? 'full'
    : f < 0.716 ? 'waningGibbous'
    : f < 0.784 ? 'lastQuarter'
    : 'waningCrescent'
  return { phase, illumination, age }
}

// --- Hourly factors ---
function pressureLevel(p: number): number {
  if (p >= 1008 && p <= 1024) return 1
  const off = p < 1008 ? 1008 - p : p - 1024
  return 1 - Math.min(0.35, off / 30)
}
// A slow fall before a front is good feeding time; sharp swings either way
// shut the bite down.
function pressureTrend(delta6h: number): number {
  const a = Math.abs(delta6h)
  if (a <= 1) return 1
  if (delta6h < 0 && a <= 3) return 0.95
  if (a <= 3) return 0.85
  if (a <= 5) return 0.6
  return 0.4
}
function windFactor(w: number, gust: number): number {
  const base = w <= 3 ? 1 : w <= 5 ? 0.9 : w <= 7 ? 0.75 : w <= 10 ? 0.5 : 0.3
  return gust > 15 ? base * 0.8 : base
}
function waveFactor(m: number | null): number {
  if (m == null) return 1
  return m <= 0.4 ? 1 : m <= 0.8 ? 0.85 : m <= 1.3 ? 0.6 : 0.35
}
function rainFactor(mm: number, code: number): number {
  if (code >= 95) return 0.5
  return mm >= 4 ? 0.65 : mm >= 1.5 ? 0.85 : 1
}
const hourOf = (iso: string) => Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60
function lightFactor(hour: number, sunrise: number, sunset: number): number {
  const edge = Math.min(Math.abs(hour + 0.5 - sunrise), Math.abs(hour + 0.5 - sunset))
  if (edge <= 1.5) return 1.1
  return hour + 0.5 > sunrise && hour + 0.5 < sunset ? 1 : 0.8
}

// A calm, steady day lands on 4; a 5 needs something extra on top — dawn in
// a falling-pressure window, a new or full moon.
function scoreFromRaw(raw: number): ForecastDay['score'] {
  return raw >= 1.04 ? 5 : raw >= 0.92 ? 4 : raw >= 0.78 ? 3 : raw >= 0.62 ? 2 : 1
}
// A front going through: a big swing over the day hurts all of it, not
// just the hours where the six-hour change shows.
function daySwing(hpa: number): number {
  const a = Math.abs(hpa)
  return a > 10 ? 0.75 : a > 6 ? 0.88 : 1
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

// Today and the next three days. `catchHours` — 24 counts of our own
// catches by local hour (the sector's «Что клюёт здесь») — decides the best
// window when there are at least 10 of them; the score never uses them.
// `nowLocal` ('YYYY-MM-DDTHH') keeps today's best window in the future.
export function scoreForecast(raw: RawForecast, catchHours: number[] | null, nowLocal: string): ForecastDay[] {
  const totalCatches = catchHours ? catchHours.reduce((a, b) => a + b, 0) : 0
  const peakCatches = catchHours ? Math.max(1, ...catchHours) : 1
  const days: ForecastDay[] = []

  for (const day of raw.days.slice(1, 5)) {
    const idx = raw.times.map((t, i) => (t.startsWith(day.date) ? i : -1)).filter((i) => i >= 0)
    if (idx.length < 24) continue
    const sunrise = hourOf(day.sunrise)
    const sunset = hourOf(day.sunset)
    const moon = moonAt(new Date(`${day.date}T12:00:00Z`))

    const weather = idx.map((i) => {
      const delta = i >= 6 ? raw.pressure[i] - raw.pressure[i - 6] : 0
      return (
        pressureLevel(raw.pressure[i]) *
        pressureTrend(delta) *
        windFactor(raw.wind[i], raw.gusts[i]) *
        waveFactor(raw.wave ? raw.wave[i] : null) *
        rainFactor(raw.precip[i], raw.code[i])
      )
    })
    // What the score is made of: weather plus the dawn/dusk prior.
    const scored = weather.map((w, h) => w * lightFactor(h, sunrise, sunset))
    // What picks the window (and draws the hourly bars): the sector's own
    // catch hours when there are enough of them, else the same as above.
    const hours =
      catchHours && totalCatches >= 10 ? weather.map((w, h) => w * (0.5 + catchHours[h] / peakCatches)) : scored

    // Best 3-hour stretch between 04:00 and midnight; for today only what's
    // still ahead (when at least three hours are left).
    const isToday = nowLocal.startsWith(day.date)
    const nowHour = isToday ? Number(nowLocal.slice(11, 13)) : 0
    const firstStart = isToday && nowHour <= 21 ? Math.max(4, nowHour) : 4
    const window3 = (xs: number[], s: number) => (xs[s] + xs[s + 1] + xs[s + 2]) / 3
    let best: ForecastDay['best'] = null
    let bestRank = 0
    for (let s = firstStart; s <= 21; s++) {
      const m = window3(hours, s)
      if (m > bestRank) {
        bestRank = m
        best = { from: s, to: s + 3 }
      }
    }
    let bestMean = 0
    for (let s = 4; s <= 21; s++) bestMean = Math.max(bestMean, window3(scored, s))
    const dayMean = mean(scored.slice(5, 22))
    const moonFactor = moon.phase === 'new' || moon.phase === 'full' ? 1.06 : moon.phase === 'firstQuarter' || moon.phase === 'lastQuarter' ? 0.97 : 1
    const swing = raw.pressure[idx[23]] - raw.pressure[idx[0]]
    const rawScore = (0.45 * bestMean + 0.55 * dayMean) * moonFactor * daySwing(swing)

    const daytime = idx.slice(6, 22)
    const waves = raw.wave ? daytime.map((i) => raw.wave![i]).filter((w): w is number => w != null) : []
    days.push({
      date: day.date,
      score: scoreFromRaw(rawScore),
      hours,
      best,
      pressureHpa: mean(idx.map((i) => raw.pressure[i])),
      pressureTrend: swing,
      wind: mean(daytime.map((i) => raw.wind[i])),
      gusts: Math.max(...daytime.map((i) => raw.gusts[i])),
      wave: waves.length ? mean(waves) : null,
      tempMin: Math.min(...idx.map((i) => raw.temp[i])),
      tempMax: Math.max(...idx.map((i) => raw.temp[i])),
      code: raw.code[idx[13]],
      moon: { phase: moon.phase, illumination: moon.illumination },
      sunrise: day.sunrise,
      sunset: day.sunset,
    })
  }
  return days
}

// 'YYYY-MM-DDTHH' for now in a time zone — Open-Meteo's local clock.
export function nowInZone(timezone: string, at: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'
export function weatherKind(code: number): WeatherKind {
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 51) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (code === 3) return 'cloudy'
  if (code === 1 || code === 2) return 'partly'
  return 'clear'
}

export const HPA_TO_MMHG = 0.750062
