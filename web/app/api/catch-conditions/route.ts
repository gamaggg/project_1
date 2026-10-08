import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'

// «Погода во время улова»: the weather at the sector in the hour of the
// catch, fetched once from Open-Meteo's archive and kept in
// catch_conditions — after that every viewer just reads the row. Older
// catches fill in the first time someone opens them. No sign-in needed:
// catches are public, and each catch is fetched at most once, ever.

const RECENT_DAYS = 60 // the forecast API keeps ~3 months back; older goes to the historical one

type Hourly = Record<string, (number | null)[]> & { time: string[] }

async function hourly(url: string): Promise<Hourly | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { hourly?: Hourly }
    return data.hourly ?? null
  } catch {
    return null
  }
}

const day = (d: Date) => d.toISOString().slice(0, 10)
const round1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10)

async function handlePOST(request: Request) {
  const body = (await request.json().catch(() => null)) as { catchId?: unknown } | null
  const catchId = Number(body?.catchId)
  if (!Number.isInteger(catchId) || catchId <= 0) return NextResponse.json({ error: 'bad catch id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('catch_conditions').select('*').eq('catch_id', catchId).maybeSingle()
  if (existing) return NextResponse.json(existing)

  const { data: c } = await admin.from('catches').select('id, caught_at, territory_id').eq('id', catchId).maybeSingle()
  if (!c) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data: t } = await admin.from('territories').select('lat, lng, kind').eq('id', c.territory_id).maybeSingle()
  if (!t?.lat || !t?.lng) return NextResponse.json({ error: 'no place' }, { status: 404 })

  const caughtAt = new Date(c.caught_at)
  // The hour the catch falls in, plus the three before it for the pressure trend.
  const hourKey = `${caughtAt.toISOString().slice(0, 13)}:00`
  const from = day(new Date(caughtAt.getTime() - 3 * 3600_000))
  const to = day(caughtAt)
  const recent = Date.now() - caughtAt.getTime() < RECENT_DAYS * 86400_000
  const base = recent ? 'https://api.open-meteo.com/v1/forecast' : 'https://historical-forecast-api.open-meteo.com/v1/forecast'
  const place = `latitude=${t.lat.toFixed(3)}&longitude=${t.lng.toFixed(3)}&start_date=${from}&end_date=${to}&timezone=GMT`

  const [weather, marine] = await Promise.all([
    hourly(`${base}?${place}&hourly=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&wind_speed_unit=ms`),
    t.kind === 'sea' ? hourly(`https://marine-api.open-meteo.com/v1/marine?${place}&hourly=wave_height,sea_surface_temperature`) : null,
  ])
  const i = weather?.time.indexOf(hourKey) ?? -1
  if (!weather || i < 0) return NextResponse.json({ error: 'weather unavailable' }, { status: 502 })
  const mi = marine?.time.indexOf(hourKey) ?? -1
  const pressure = weather.pressure_msl[i]
  const before = i >= 3 ? weather.pressure_msl[i - 3] : null

  const row = {
    catch_id: catchId,
    air_temp: round1(weather.temperature_2m[i]),
    water_temp: mi >= 0 ? round1(marine!.sea_surface_temperature?.[mi]) : null,
    wind: round1(weather.wind_speed_10m[i]),
    wind_dir: weather.wind_direction_10m[i] == null ? null : Math.round(weather.wind_direction_10m[i]!) % 360,
    gusts: round1(weather.wind_gusts_10m[i]),
    pressure: round1(pressure),
    pressure_trend: pressure != null && before != null ? round1(pressure - before) : null,
    wave: mi >= 0 ? round1(marine!.wave_height?.[mi]) : null,
    weather_code: weather.weather_code[i] == null ? null : Math.round(weather.weather_code[i]!),
  }
  // Two viewers opening a fresh catch at once: the second insert is a no-op
  // and both get the same row back.
  await admin.from('catch_conditions').upsert(row, { onConflict: 'catch_id', ignoreDuplicates: true })
  const { data: saved } = await admin.from('catch_conditions').select('*').eq('catch_id', catchId).maybeSingle()
  return NextResponse.json(saved ?? row)
}

export const POST = withErrorReport('catch-conditions', handlePOST)
