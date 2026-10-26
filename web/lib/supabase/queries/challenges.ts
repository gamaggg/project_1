'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { type CityId, CITIES, asCityId } from '@/lib/data/city'
import { localChallenge } from '@/lib/data/dbText'

// The angler's own correction of a catch after the fact — size, weight, bait
// and method (edit_my_catch; the species stays, the coins were paid for it).
// The achievements this player has EVER earned (user_achievements, written once
// by the server when one opens and never taken back). An achievement that was
// earned stays unlocked even when what it was earned for is gone — ten sectors
// lost again, the catches behind it deleted.
export function useEarnedAchievements(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['earned-achievements', userId ?? null],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('user_achievements').select('achievement_key').eq('user_id', userId!)
      if (error) throw error
      return data.map((r) => r.achievement_key)
    },
  })
}

// For the "Отбил территорию" achievement — has this profile ever taken over
// a sector that belonged to someone else? activity_log is publicly readable
// (see the unauthenticated-feed comment on useActivity above), so this works
// for any profile, not just the viewer's own. limit(1) since only presence
// matters, not a count.
export function useHasClaimedFromOthers(userId: string | null) {
  return useQuery({
    queryKey: ['claimed-from-others', userId],
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('activity_log')
        .select('id')
        .eq('kind', 'claim')
        .eq('user_id', userId!)
        .not('previous_owner_id', 'is', null)
        .limit(1)
      if (error) throw error
      return (data?.length ?? 0) > 0
    },
  })
}

export type WeeklyChallenge = {
  id: number
  challengeId: string
  name: string
  description: string
  tier: 'soft' | 'light' | 'medium' | 'hard'
  coinReward: number
  target: number
  progress: number
  completedAt: string | null
}

// Settles any of the caller's past unfinished weeks (full or partial coin
// payout — see sync_my_challenges) and assigns this week's trio the first
// time it's opened, so this is safe — required, even — to call every time
// the Challenges screen mounts, not just once.
export function useMyChallenges(city: CityId) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const cityInfo = CITIES[city]
  return useQuery({
    queryKey: ['my-challenges', user?.id ?? null, city],
    enabled: !!user,
    queryFn: async (): Promise<WeeklyChallenge[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('sync_my_challenges', { p_city: city, p_timezone: cityInfo.timezone })
      if (error) throw error
      const rows = (data ?? []).map((r) => ({
        id: r.id,
        challengeId: r.challenge_id,
        ...localChallenge(r.challenge_id, r.name, r.description),
        tier: r.tier as WeeklyChallenge['tier'],
        coinReward: r.coin_reward,
        target: r.target,
        progress: r.progress,
        completedAt: r.completed_at,
      }))
      // A challenge can settle (and pay out) as a side effect of this same
      // call — the coin pill elsewhere on screen needs to catch up too.
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      return rows
    },
  })
}

// Recomputes the caller's own achievement milestones server-side and pays
// out coins for any newly-crossed one (see _sync_achievements_for_user) —
// same reasoning as useMyChallenges/sync_my_challenges: safe, idempotent,
// meant to be called every time the Achievements screen mounts rather than
// once. `enabled` lets AchievementsScreen skip this when it's showing
// someone ELSE's achievements (the RPC only ever acts on auth.uid(), so
// syncing there would just be a wasted call, not wrong).
export function useSyncMyAchievements(enabled: boolean) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['sync-my-achievements', user?.id ?? null],
    enabled: !!user && enabled,
    queryFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.rpc('sync_my_achievements')
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      return true
    },
  })
}

// Fire-and-forget view tracking for the two soft challenges that need it
// (Разведка/Картограф via territory, Наблюдатель via catch) — never awaited
// by its caller and never allowed to throw, so a failed log can't break the
// navigation it's riding along with.
export function logChallengeEvent(args: { eventType: 'territory_viewed' | 'catch_viewed'; territoryId?: string; catchId?: number }) {
  const supabase = createClient()
  supabase
    .rpc('log_challenge_event', { p_event_type: args.eventType, p_territory_id: args.territoryId ?? null, p_catch_id: args.catchId ?? null })
    .then(() => {}, () => {})
}

export function useChallengeWeekState(city: CityId) {
  const { user } = useAuth()
  const cityInfo = CITIES[city]
  return useQuery({
    queryKey: ['challenge-week-state', user?.id ?? null, city],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_my_challenge_week_state', { p_timezone: cityInfo.timezone })
      if (error) throw error
      const row = data?.[0]
      return {
        swapUsed: row?.swap_used ?? false,
        extraSlotBought: row?.extra_slot_bought ?? false,
        slotCount: row?.slot_count ?? 0,
        weekEndsAt: row?.week_ends_at ?? null,
      }
    },
  })
}

// The city whose set of weekly challenges is the player's this week, when the city shown has
// none (challenges belong to the city they were given for and count catches only there:
// get_my_other_city_challenges). Null when the shown city has its own set or there is none.
export function useOtherCityChallenges(city: CityId, enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['other-city-challenges', user?.id ?? null, city],
    enabled: !!user && enabled,
    queryFn: async (): Promise<CityId | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_my_other_city_challenges', { p_city: city })
      if (error) throw error
      return data ? asCityId(data) : null
    },
  })
}

export function useSwapChallenge(city: CityId) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (userChallengeId: number) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('swap_challenge', { p_user_challenge_id: userChallengeId, p_city: city })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-challenges', user?.id ?? null, city] })
      queryClient.invalidateQueries({ queryKey: ['challenge-week-state', user?.id ?? null, city] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}

export function useBuyExtraChallenge(city: CityId) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const cityInfo = CITIES[city]
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.rpc('buy_extra_challenge', { p_city: city, p_timezone: cityInfo.timezone })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-challenges', user?.id ?? null, city] })
      queryClient.invalidateQueries({ queryKey: ['challenge-week-state', user?.id ?? null, city] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}
