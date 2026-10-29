'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { UserListEntry, CityPlayer, WeeklyLeaderboardEntry, UserAward, AwardKind } from '@/lib/data/types'
import { type CityId } from '@/lib/data/city'
import { localAwardTitle, localAwardSubtitle, localAwardDescription } from '@/lib/data/dbText'
import { tn } from '@/lib/i18n/runtime'
import { useCanViewAllUsers } from '@/lib/supabase/queries/profile'

// Admin-only "Все пользователи" directory (TerritoriesListScreen's "Все
// пользователи" button → UsersListScreen). Sorted newest-first at the
// source, matching the default the screen shows before any sort chip is
// picked; the other 3 sort keys are cheap enough to do client-side on this
// small a dataset, so no extra cached query variant per sort mode.
export function useAllUsers() {
  const canViewAllUsers = useCanViewAllUsers()
  return useQuery({
    queryKey: ['all-users'],
    enabled: canViewAllUsers,
    queryFn: async (): Promise<UserListEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles_with_stats')
        .select('id, display_name, avatar_url, public_id, created_at, catches_count, territories_count')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(
        (r): UserListEntry => ({
          id: r.id!,
          displayName: r.display_name ?? tn('common.angler'),
          avatarUrl: r.avatar_url,
          publicId: r.public_id ?? '?????',
          createdAt: r.created_at ?? new Date().toISOString(),
          catchesCount: r.catches_count ?? 0,
          territoriesCount: r.territories_count ?? 0,
        })
      )
    },
  })
}

// «Все игроки» in the Рейтинг tab: everyone who plays, in every city (each
// profile carries its city), with their all-time sectors and catches —
// sorted, filtered by city and searched on the phone. A few hundred small
// rows, fetched only once the list is opened.
export function useAllPlayers(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['all-players'],
    enabled: enabled && !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<CityPlayer[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles_with_stats')
        .select('id, display_name, avatar_url, catches_count, territories_count, clan_crest, is_blocked, city, created_at')
        .order('id')
        .limit(3000)
      if (error) throw error
      return data
        .filter((r) => !r.is_blocked)
        .map(
          (r): CityPlayer => ({
            id: r.id!,
            displayName: r.display_name ?? tn('common.angler'),
            avatarUrl: r.avatar_url,
            catchesCount: r.catches_count ?? 0,
            territoriesCount: r.territories_count ?? 0,
            clanCrest: r.clan_crest ?? null,
            city: (r.city as CityId) ?? 'batumi',
            createdAt: r.created_at ?? '',
          })
        )
    },
  })
}

// Weekly rating for the Territories tab's "Рейтинг" toggle — ranked by
// sectors first-claimed this Batumi week (Mon 00:00 – Sun 23:59, see the
// RPC), catches this week as the secondary stat. friendsOnly scopes it to
// people the viewer follows (plus the viewer themselves) instead of everyone.
// A fresh query per scope (not client-side refiltering of one big list) —
// "friends" would otherwise need every profile's full follow graph client-side
// just to filter ten rows.
// `limit`: the podium screens need only the top (10 by default); the current-week rating asks for everyone who
// caught something this week (the RPC already leaves out those with nothing).
export function useWeeklyLeaderboard(friendsOnly: boolean, weekOffset: number = 0, cityPrefix: string = 'B', timezone: string = 'Asia/Tbilisi', limit: number = 10) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['weekly-leaderboard', friendsOnly, weekOffset, cityPrefix, limit],
    enabled: !!user,
    queryFn: async (): Promise<WeeklyLeaderboardEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
        p_friends_only: friendsOnly,
        p_limit: limit,
        p_week_offset: weekOffset,
        p_city_prefix: cityPrefix,
        p_timezone: timezone,
      })
      if (error) throw error
      return data.map(
        (r): WeeklyLeaderboardEntry => ({
          userId: r.user_id,
          displayName: r.display_name ?? tn('common.angler'),
          avatarUrl: r.avatar_url,
          sectorsThisWeek: r.sectors_this_week,
          catchesThisWeek: r.catches_this_week,
          rank: r.rank,
        })
      )
    },
  })
}

// Collectible medals for one profile (see AwardsRing) — public on anyone's
// profile, not just the viewer's own, so no auth gating beyond RLS itself.
export function useUserAwards(userId: string | null) {
  return useQuery({
    queryKey: ['user-awards', userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserAward[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('user_awards').select('*').eq('user_id', userId!).order('earned_at', { ascending: false })
      if (error) throw error
      return data.map(
        (r): UserAward => ({
          id: r.id,
          kind: r.kind as AwardKind,
          title: localAwardTitle(r.title),
          subtitle: localAwardSubtitle(r.title, r.subtitle),
          description: localAwardDescription(r.title, r.description),
          earnedAt: r.earned_at,
        })
      )
    },
  })
}
