'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRawForecast, nowInZone, scoreForecast, type ForecastDay, type ForecastPoint } from '@/lib/forecast/bite'
import { useNow } from '@/lib/useNow'

// Weather changes slowly and Open-Meteo updates hourly: one fetch per point
// an hour is plenty, and the map and a sector screen nearby share the city's
// numbers through the rounded key.
export function useBiteForecast({
  point,
  timezone,
  sea,
  catchHours = null,
  enabled = true,
}: {
  point: ForecastPoint
  timezone: string
  sea: ForecastPoint | null
  catchHours?: number[] | null
  enabled?: boolean
}): { days: ForecastDay[] | null; isError: boolean } {
  const { data: raw, isError } = useQuery({
    queryKey: ['bite-forecast', point.lat.toFixed(2), point.lng.toFixed(2), sea ? `${sea.lat.toFixed(2)},${sea.lng.toFixed(2)}` : null, timezone],
    enabled,
    queryFn: () => fetchRawForecast(point, timezone, sea),
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })
  const now = useNow(10 * 60 * 1000)
  const nowLocal = nowInZone(timezone, now)
  // Past midnight on data fetched yesterday, «today» is the second day.
  const days = useMemo(
    () => (raw ? scoreForecast(raw, catchHours, nowLocal).filter((d) => d.date >= nowLocal.slice(0, 10)) : null),
    [raw, catchHours, nowLocal]
  )
  return { days, isError }
}
