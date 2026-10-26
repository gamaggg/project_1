'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { TerritoryKind } from '@/lib/data/types'
import { type CityId } from '@/lib/data/city'
import { type WeekRecap, mapRecap } from '@/lib/recap'

export type SectorInsights = {
  // Only ever this sector's own catches. 'sector': 3+ here in 90 days,
  // these are they. 'sector_all': fewer, so every catch ever made here
  // (total 0 — nobody has fished here, and the card stays hidden).
  scope: 'sector' | 'sector_all'
  kind: TerritoryKind
  total: number
  species: { key: string; count: number }[]
  // 24 counts, one per local hour 0–23.
  hours: number[]
  methods: { name: string; count: number }[]
  baits: { name: string; count: number }[]
  lastCatchAt: string | null
  legend: { id: string; name: string | null; avatarUrl: string | null; count: number } | null
  // The viewer's own catches here in the legend's 90 days (null signed out).
  myCount: number | null
}

// «Что клюёт здесь» and the sector's legend — one request per opened
// sector screen, public like the map itself.
export function useSectorInsights(territoryId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['sector-insights', territoryId, user?.id ?? null],
    enabled: !!territoryId,
    queryFn: async (): Promise<SectorInsights> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_sector_insights', { p_territory_id: territoryId! })
      if (error) throw error
      const d = data as {
        scope: 'sector' | 'sector_all'
        kind: TerritoryKind
        total: number
        species: { key: string; count: number }[]
        hours: number[]
        methods: { name: string; count: number }[]
        baits: { name: string; count: number }[]
        last_catch_at: string | null
        legend: { id: string; name: string | null; avatar_url: string | null; count: number } | null
        my_count: number | null
      }
      return {
        scope: d.scope,
        kind: d.kind,
        total: d.total,
        species: d.species,
        hours: d.hours,
        methods: d.methods,
        baits: d.baits,
        lastCatchAt: d.last_catch_at,
        legend: d.legend ? { id: d.legend.id, name: d.legend.name, avatarUrl: d.legend.avatar_url, count: d.legend.count } : null,
        myCount: d.my_count,
      }
    },
  })
}

export type AppStatsPoint = { t: string; active: number; signedIn: number; newUsers: number; onboarded: number; catches: number }

export type AppStatsPlayer = {
  id: string
  name: string | null
  publicId: string | null
  at: string
  city: string | null
  telegram: boolean
  onboarded: boolean
  catches: number
  seen: string | null
}

export type AppStats = {
  from: string
  to: string
  bucket: 'hour' | 'day'
  series: AppStatsPoint[]
  totals: {
    newUsers: number
    onboarded: number
    viaTelegram: number
    firstCatch: number
    active: number
    signedIn: number
    catches: number
    catchers: number
    playersTotal: number
  }
  prev: { newUsers: number; active: number; catches: number; firstCatch: number }
  byCity: { city: string; n: number }[]
  newPlayers: AppStatsPlayer[]
  funnel: { registered: number; onboarded: number; camera: number; firstCatch: number; secondDay: number }
  retention: { cohort: number; d1: number; w1: number }
  screens: { screen: string; views: number; people: number }[]
  onboarding: { step: string; devices: number }[]
}

// Super admin's «Статистика» for any period (get_app_stats_range checks the role itself):
// from/to are ISO instants (to = null: until now), bucket 'auto' picks hours for up to 3 days.
export function useAppStatsRange(from: string, to: string | null, bucket: 'auto' | 'hour' | 'day', enabled: boolean) {
  return useQuery({
    queryKey: ['app-stats-range', from, to, bucket],
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<AppStats> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_app_stats_range', {
        p_from: from,
        p_to: to,
        p_bucket: bucket,
        p_tz: 'Asia/Tbilisi',
      })
      if (error) throw error
      const d = data as {
        from: string
        to: string
        bucket: 'hour' | 'day'
        series: { t: string; active: number; signed_in: number; new_users: number; onboarded: number; catches: number }[]
        totals: {
          new_users: number
          onboarded: number
          via_telegram: number
          first_catch: number
          active: number
          signed_in: number
          catches: number
          catchers: number
          players_total: number
        }
        prev: { new_users: number; active: number; catches: number; first_catch: number }
        by_city: { city: string; n: number }[]
        new_players: {
          id: string
          name: string | null
          public_id: string | null
          at: string
          city: string | null
          telegram: boolean
          onboarded: boolean
          catches: number
          seen: string | null
        }[]
        funnel: { registered: number; onboarded: number; camera: number; first_catch: number; second_day: number }
        retention: { cohort: number; d1: number; w1: number }
        screens: { screen: string; views: number; people: number }[]
        onboarding: { step: string; devices: number }[]
      }
      return {
        from: d.from,
        to: d.to,
        bucket: d.bucket,
        series: d.series.map((x) => ({ t: x.t, active: x.active, signedIn: x.signed_in, newUsers: x.new_users, onboarded: x.onboarded, catches: x.catches })),
        totals: {
          newUsers: d.totals.new_users,
          onboarded: d.totals.onboarded,
          viaTelegram: d.totals.via_telegram,
          firstCatch: d.totals.first_catch,
          active: d.totals.active,
          signedIn: d.totals.signed_in,
          catches: d.totals.catches,
          catchers: d.totals.catchers,
          playersTotal: d.totals.players_total,
        },
        prev: { newUsers: d.prev.new_users, active: d.prev.active, catches: d.prev.catches, firstCatch: d.prev.first_catch },
        byCity: d.by_city,
        newPlayers: d.new_players.map((x) => ({
          id: x.id,
          name: x.name,
          publicId: x.public_id,
          at: x.at,
          city: x.city,
          telegram: x.telegram,
          onboarded: x.onboarded,
          catches: x.catches,
          seen: x.seen,
        })),
        funnel: { registered: d.funnel.registered, onboarded: d.funnel.onboarded, camera: d.funnel.camera, firstCatch: d.funnel.first_catch, secondDay: d.funnel.second_day },
        retention: d.retention,
        screens: d.screens,
        onboarding: d.onboarding,
      }
    },
  })
}

// «Неделя в городе»: last full week's recap for the map banner and the
// story player (get_city_week_recap). One request, a little after launch.
export function useCityWeekRecap(city: CityId, enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['city-week-recap', city, user?.id ?? null],
    enabled: enabled && !!user,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<WeekRecap | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_city_week_recap', { p_city: city })
      if (error) throw error
      return data ? mapRecap(data as Parameters<typeof mapRecap>[0]) : null
    },
  })
}
