import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CITIES, type CityId } from '@/lib/data/city'
import { fetchRawForecast, nowInZone, scoreForecast } from '@/lib/forecast/bite'

// «Завтра хороший клёв»: once a day at 19:00 in each city (pg_cron, switched
// on in the release migration) — tomorrow's score from the same model the
// app shows; queue_bite_forecast decides whether it's worth a message (4–5,
// at most twice a week, never two days running) and who gets it.

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const cityParam = new URL(req.url).searchParams.get('city')
  const city: CityId = cityParam === 'moscow' ? 'moscow' : 'batumi'
  const info = CITIES[city]
  try {
    const raw = await fetchRawForecast(
      { lat: info.center[0], lng: info.center[1] },
      info.timezone,
      info.seaPoint ? { lat: info.seaPoint[0], lng: info.seaPoint[1] } : null
    )
    const days = scoreForecast(raw, null, nowInZone(info.timezone, Date.now()))
    const tomorrow = days[1]
    if (!tomorrow) return NextResponse.json({ city, skipped: 'no forecast' })
    if (tomorrow.score < 4) return NextResponse.json({ city, date: tomorrow.date, score: tomorrow.score, skipped: 'score' })
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('queue_bite_forecast', {
      p_city: city,
      p_for_date: tomorrow.date,
      p_score: tomorrow.score,
      p_from: tomorrow.best ? hh(tomorrow.best.from) : '',
      p_to: tomorrow.best ? hh(tomorrow.best.to) : '',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ city, date: tomorrow.date, score: tomorrow.score, notified: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 })
  }
}
