'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { ProfileSummary, Profile, CatchReport } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'
import { useCanModerateReports, useIsAdmin, useIsSuperAdmin } from '@/lib/supabase/queries/profile'

export function useCatchLikes(catchId: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catch-likes', catchId],
    enabled: !!catchId,
    queryFn: async (): Promise<{ count: number; likedByMe: boolean; likers: ProfileSummary[] }> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catch_likes')
        .select('user_id, profiles(display_name, avatar_url)')
        .eq('catch_id', catchId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      const likers = data.map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return { userId: r.user_id, displayName: p?.display_name ?? tn('common.angler'), avatarUrl: p?.avatar_url ?? null }
      })
      return { count: likers.length, likedByMe: !!user && likers.some((l) => l.userId === user.id), likers }
    },
  })
}

export function useToggleCatchLike() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, liked }: { catchId: number; liked: boolean }) => {
      const supabase = createClient()
      const { error } = liked
        ? await supabase.from('catch_likes').delete().eq('catch_id', catchId).eq('user_id', user!.id)
        : await supabase.from('catch_likes').insert({ catch_id: catchId, user_id: user!.id })
      if (error) throw error
    },
    // Optimistic — a like needs to feel instant (CatchPhotoScreen's pop
    // animation is tied to the tap, not the round trip); rolled back on
    // failure from the snapshot captured here.
    onMutate: async ({ catchId, liked }) => {
      const key = ['catch-likes', catchId]
      await queryClient.cancelQueries({ queryKey: key })
      type LikesData = { count: number; likedByMe: boolean; likers: ProfileSummary[] }
      const previous = queryClient.getQueryData<LikesData>(key)
      // Read from cache rather than useProfile() here — this hook only
      // needs a snapshot at click time, not to re-render when it changes.
      const myProfile = user ? queryClient.getQueryData<Profile>(['profile', user.id]) : undefined
      queryClient.setQueryData(key, (old: LikesData | undefined): LikesData => {
        const likers = old?.likers ?? []
        const nextLikers = liked
          ? likers.filter((l) => l.userId !== user!.id)
          : user && !likers.some((l) => l.userId === user.id)
            ? [{ userId: user.id, displayName: myProfile?.displayName ?? tn('sector.you'), avatarUrl: myProfile?.avatarUrl ?? null }, ...likers]
            : likers
        return { count: Math.max(0, (old?.count ?? 0) + (liked ? -1 : 1)), likedByMe: !liked, likers: nextLikers }
      })
      return { previous }
    },
    onError: (_err, { catchId }, context) => {
      if (context?.previous) queryClient.setQueryData(['catch-likes', catchId], context.previous)
    },
    onSettled: (_data, _error, { catchId }) => queryClient.invalidateQueries({ queryKey: ['catch-likes', catchId] }),
  })
}

// Who follows userId — same follows_follower_id_fkey join useActivity already
// uses to resolve a follower's profile, just without the followee_id filter.
export function useFollowers(userId: string | null) {
  return useQuery({
    queryKey: ['followers', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileSummary[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id, profiles!follows_follower_id_fkey(display_name, avatar_url)')
        .eq('followee_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return { userId: r.follower_id, displayName: p?.display_name ?? tn('common.angler'), avatarUrl: p?.avatar_url ?? null }
      })
    },
  })
}

export function useIsFollowing(followeeId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['is-following', user?.id ?? null, followeeId],
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user!.id)
        .eq('followee_id', followeeId!)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
    enabled: !!user && !!followeeId,
  })
}

export function useSetFollowing() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ followeeId, following }: { followeeId: string; following: boolean }) => {
      if (!user) throw new Error('not authenticated')
      const supabase = createClient()
      if (following) {
        const { error } = await supabase.from('follows').insert({ follower_id: user.id, followee_id: followeeId })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('followee_id', followeeId)
        if (error) throw error
      }
    },
    onSuccess: (_data, { followeeId }) => {
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, followeeId] })
      queryClient.invalidateQueries({ queryKey: ['profile', followeeId] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useReportCatch() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, reason }: { catchId: number; reason: string }) => {
      if (!user) throw new Error('not authenticated')
      const supabase = createClient()
      const { error } = await supabase.from('catch_reports').insert({ catch_id: catchId, reporter_id: user.id, reason })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  })
}

// RLS only lets is_admin profiles select rows here anyway (everyone else gets
// an empty list, not an error) — `enabled` just avoids firing the request at
// all for the common case (AdminReportsScreen stays mounted for every
// visitor, admin or not, same as every other screen in this app-shell).
export function useReports() {
  const canModerateReports = useCanModerateReports()
  return useQuery({
    queryKey: ['reports'],
    enabled: canModerateReports,
    queryFn: async (): Promise<CatchReport[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catch_reports')
        .select(
          'id, reason, created_at, reporter_id, profiles!catch_reports_reporter_id_fkey(display_name), catches(id, territory_id, photo_url, species_info:species(name))'
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
        .filter((r) => r.catches)
        .map((r): CatchReport => {
          const c = Array.isArray(r.catches) ? r.catches[0] : r.catches!
          const reporter = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
          const speciesInfo = Array.isArray(c.species_info) ? c.species_info[0] : c.species_info
          return {
            id: r.id,
            catchId: c.id,
            reason: r.reason,
            createdAt: r.created_at,
            reporterId: r.reporter_id,
            reporterName: reporter?.display_name ?? tn('common.angler'),
            territoryId: c.territory_id,
            photoUrl: c.photo_url,
            speciesName: speciesInfo?.name ?? null,
          }
        })
    },
  })
}

// Separate from useReports() (that's the live report queue, catch_reports —
// rows disappear once resolved) — this counts past moderation deletions
// (admin_actions) for one user, visible to any admin/super-admin, not just
// the super-admins who can read the full admin_actions log.
export function useReportDeletionCount(userId: string | null) {
  const isAdmin = useIsAdmin()
  const isSuperAdmin = useIsSuperAdmin()
  return useQuery({
    queryKey: ['report-deletion-count', userId],
    enabled: (isAdmin || isSuperAdmin) && !!userId,
    queryFn: async (): Promise<number> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_report_deletion_count', { p_user_id: userId! })
      if (error) throw error
      return data ?? 0
    },
  })
}

export function useDismissReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (reportId: number) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_dismiss_report', { p_report_id: reportId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  })
}
