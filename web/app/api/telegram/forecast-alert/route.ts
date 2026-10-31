import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/cronAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CITIES, asCityId, type CityId } from '@/lib/data/city'
import { bestMorning, fetchRawForecast, nowInZone, scoreForecast } from '@/lib/forecast/bite'
import { groupHeldSectors, sectorForecastItems, type HeldSector, type SectorForecastItem, type SectorShare } from '@/lib/forecast/sectorForecast'
import { withErrorReport } from '@/lib/serverErrors'

// «Завтра хороший клёв»: once a day at 19:00 in each city (pg_cron, switched
// on in the release migration) — tomorrow's score from the same model the
// app shows; queue_bite_forecast decides whether it's worth a message (4–5,
// at most twice a week, never two days running) and who gets it.
//
// Before it, «Завтра утром хороший клёв у твоего сектора»: tomorrow morning at the
// point of every sector held in the city (owners and clan shares), one weather call
// per few kilometres; queue_sector_forecast sends one message per player for their
// best sector at 4–5, within the same weekly limit, and the city message then skips
// whoever got one.

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
// Open-Meteo calls at a time — a city has a few dozen points at most.
const PARALLEL = 4

async function queueSectorForecasts(city: CityId, admin: ReturnType<typeof createAdminClient>) {
  const info = CITIES[city]
  const [held, shares] = await Promise.all([
    admin.from('territories').select('id, kind, lat, lng, owner_id').like('id', `${info.idPrefix}%`).eq('is_deleted', false).not('owner_id', 'is', null),
    admin.from('territory_shares').select('territory_id, user_id').like('territory_id', `${info.idPrefix}%`),
  ])
  if (held.error) throw new Error(held.error.message)
  if (shares.error) throw new Error(shares.error.message)
  const groups = groupHeldSectors((held.data ?? []) as HeldSector[], (shares.data ?? []) as SectorShare[])
  const now = nowInZone(info.timezone, Date.now())
  const items: SectorForecastItem[] = []
  let date: string | null = null
  let failed = 0
  for (let i = 0; i < groups.length; i += PARALLEL) {
    await Promise.all(
      groups.slice(i, i + PARALLEL).map(async (g) => {
        try {
          const tomorrow = scoreForecast(await fetchRawForecast(g.point, info.timezone, g.sea), null, now)[1]
          if (!tomorrow) return
          date = tomorrow.date
          items.push(...sectorForecastItems(g, bestMorning(tomorrow)))
        } catch {
          // One point's weather failing leaves the others' messages.
          failed++
        }
      })
    )
  }
  if (!date || !items.length) return { points: groups.length, failed, notified: 0 }
  const { data, error } = await admin.rpc('queue_sector_forecast', { p_city: city, p_for_date: date, p_items: items })
  if (error) throw new Error(error.message)
  return { points: groups.length, failed, candidates: items.length, notified: data }
}

async function handleGET(req: Request) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const cityParam = new URL(req.url).searchParams.get('city')
  const city: CityId = asCityId(cityParam)
  const info = CITIES[city]
  const admin = createAdminClient()
  // Its own try: a failure here must not cost the city its message.
  let sectors: Awaited<ReturnType<typeof queueSectorForecasts>> | { error: string }
  try {
    sectors = await queueSectorForecasts(city, admin)
  } catch (e) {
    sectors = { error: e instanceof Error ? e.message : 'failed' }
  }
  try {
    const raw = await fetchRawForecast(
      { lat: info.center[0], lng: info.center[1] },
      info.timezone,
      info.seaPoint ? { lat: info.seaPoint[0], lng: info.seaPoint[1] } : null
    )
    const days = scoreForecast(raw, null, nowInZone(info.timezone, Date.now()))
    const tomorrow = days[1]
    if (!tomorrow) return NextResponse.json({ city, sectors, skipped: 'no forecast' })
    if (tomorrow.score < 4) return NextResponse.json({ city, sectors, date: tomorrow.date, score: tomorrow.score, skipped: 'score' })
    const { data, error } = await admin.rpc('queue_bite_forecast', {
      p_city: city,
      p_for_date: tomorrow.date,
      p_score: tomorrow.score,
      p_from: tomorrow.best ? hh(tomorrow.best.from) : '',
      p_to: tomorrow.best ? hh(tomorrow.best.to) : '',
    })
    if (error) return NextResponse.json({ sectors, error: error.message }, { status: 500 })
    return NextResponse.json({ city, sectors, date: tomorrow.date, score: tomorrow.score, notified: data })
  } catch (e) {
    return NextResponse.json({ sectors, error: e instanceof Error ? e.message : 'failed' }, { status: 502 })
  }
}

export const GET = withErrorReport('telegram/forecast-alert', handleGET)
