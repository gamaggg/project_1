'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Territory, Catch, ActivityEntry, TerritoryKind, Species, Profile, CatchReport, AdminAction, AdminListEntry, UserListEntry } from '@/lib/data/types'

type SectorGeometry = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
}

// Geometry never changes at runtime (see tools/fishing-hex) — fetched once from the
// static asset and cached for the life of the tab, independent of ownership state.
function useSectorsGeometry() {
  return useQuery({
    queryKey: ['sectors-geometry'],
    queryFn: async () => {
      const res = await fetch('/data/sectors.json')
      return (await res.json()) as SectorGeometry[]
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Merges static geometry with live Supabase ownership (territories_with_stats) —
// see DECISIONS.md for why geometry stays a static asset instead of DB rows.
export function useTerritories() {
  const { user } = useAuth()
  const geometry = useSectorsGeometry()

  return useQuery({
    queryKey: ['territories', user?.id ?? null],
    queryFn: async (): Promise<Territory[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('territories_with_stats')
        .select('id, kind, lat, lng, owner_id, catch_count, last_catch_at, is_deleted')
      if (error) throw error

      const byId = new Map(data!.map((row) => [row.id, row]))
      return geometry.data!
        // Geometry is a static asset (see useSectorsGeometry) — a sector a
        // super admin deleted (admin_delete_territory) stays in that file,
        // so it's dropped here based on the DB row's is_deleted flag instead.
        .filter((g) => !byId.get(g.id)?.is_deleted)
        .map((g) => {
          const row = byId.get(g.id)
          const ownerId = row?.owner_id ?? null
          return {
            id: g.id,
            kind: g.kind,
            lat: g.lat,
            lng: g.lng,
            corners: g.corners,
            ownerId,
            status: ownerId === null ? 'free' : ownerId === user?.id ? 'mine' : 'other',
            catchCount: row?.catch_count ?? 0,
            lastCatchAt: row?.last_catch_at ?? null,
          }
        })
        // Most-caught sectors first everywhere that lists territories (map
        // carousel, territories tab) — a single sort here instead of one per
        // screen, since every consumer shares this same array. Zero-catch
        // sectors tie on the primary key, so the id fallback alone gives them
        // ascending-by-number order for free.
        .sort((a, b) => b.catchCount - a.catchCount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    },
    enabled: geometry.isSuccess,
  })
}

// Reference data (36 species, sea/river/stream/lake) — read-only, cached like
// the sector geometry. See DECISIONS.md for why this is a DB table, not a
// hardcoded list like METHODS/BAITS.
export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: async (): Promise<Species[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('species').select('key, name, category').order('name')
      if (error) throw error
      return data as Species[]
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

const CATCH_SELECT = '*, species_info:species(name, category)'

type CatchRow = {
  id: number
  territory_id: string
  user_id: string
  species: string
  species_info: { name: string; category: string } | { name: string; category: string }[] | null
  length_cm: number | null
  weight_kg: number | null
  method: string | null
  bait: string | null
  photo_url: string
  caught_at: string
}

function rowToCatch(c: CatchRow, currentUserId?: string): Catch {
  const info = Array.isArray(c.species_info) ? c.species_info[0] : c.species_info
  return {
    id: c.id,
    territoryId: c.territory_id,
    userId: c.user_id,
    species: c.species,
    speciesName: info?.name ?? c.species,
    speciesCategory: (info?.category as 'marine' | 'freshwater') ?? 'marine',
    lengthCm: c.length_cm,
    weightKg: c.weight_kg,
    method: c.method,
    bait: c.bait,
    photoUrl: c.photo_url,
    caughtAt: c.caught_at,
    mine: c.user_id === currentUserId,
  }
}

export function useCatchesByTerritory(territoryId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'territory', territoryId],
    queryFn: async (): Promise<Catch[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select(CATCH_SELECT)
        .eq('territory_id', territoryId!)
        .order('caught_at', { ascending: false })
      if (error) throw error
      return (data as CatchRow[]).map((c) => rowToCatch(c, user?.id))
    },
    enabled: !!territoryId,
  })
}

// Parameterized so a user's public profile page can show their catches too —
// `mine` on each Catch still reflects the *viewer's* own id, not userId.
export function useCatchesByUser(userId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'by-user', userId],
    queryFn: async (): Promise<Catch[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select(CATCH_SELECT)
        .eq('user_id', userId!)
        .order('caught_at', { ascending: false })
      if (error) throw error
      return (data as CatchRow[]).map((c) => rowToCatch(c, user?.id))
    },
    enabled: !!userId,
  })
}

export function useMyCatches() {
  const { user } = useAuth()
  return useCatchesByUser(user?.id ?? null)
}

// Logged out: unfiltered public feed (no "me" to personalize around — matches
// the map/territories/profile-view being open to anonymous visitors). Logged
// in: only your own activity, activity from people you follow (but only from
// the moment you followed them — following doesn't backfill their past
// catches, see DECISIONS.md), and "someone else claimed a territory you used
// to own" (previous_owner_id, set by the confirm_catch RPC at claim time).
// The user/followee part of the filter is applied server-side, before the
// limit, so relevant-but-old events aren't crowded out of the top 100 by
// unrelated global activity once the feed gets busy; the follow-time cutoff
// is then applied client-side (PostgREST can't express a per-followee
// threshold in one query).
export function useActivity() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['activity', user?.id ?? null],
    queryFn: async (): Promise<ActivityEntry[]> => {
      const supabase = createClient()

      // activity_log now has two FKs to profiles (user_id, previous_owner_id) —
      // the embed must name which one, or PostgREST 300s as ambiguous.
      let query = supabase
        .from('activity_log')
        .select(
          'id, kind, created_at, user_id, previous_owner_id, territory_id, territories(kind), catches(length_cm, weight_kg, photo_url, species_info:species(name, category)), profiles!activity_log_user_id_fkey(display_name, avatar_url)'
        )

      let followedSince = new Map<string, string>()
      if (user) {
        const { data: follows } = await supabase.from('follows').select('followee_id, created_at').eq('follower_id', user.id)
        followedSince = new Map((follows ?? []).map((f) => [f.followee_id, f.created_at]))
        const followeeIds = [...followedSince.keys()]
        const orParts = [`user_id.eq.${user.id}`, `previous_owner_id.eq.${user.id}`]
        if (followeeIds.length) orParts.push(`user_id.in.(${followeeIds.join(',')})`)
        query = query.or(orParts.join(','))
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(100)
      if (error) throw error

      // A followed user's activity only counts from the moment you followed
      // them — following someone doesn't backfill their past catches into your
      // feed, only "mine" and "someone took my territory" are unconditional.
      const relevant = data!.filter((row) => {
        if (!user || row.user_id === user.id || row.previous_owner_id === user.id) return true
        const since = followedSince.get(row.user_id)
        return !!since && row.created_at > since
      })

      const catchEntries = relevant.map((row): ActivityEntry => {
        const territory = Array.isArray(row.territories) ? row.territories[0] : row.territories
        const c = Array.isArray(row.catches) ? row.catches[0] : row.catches
        const speciesInfo = c ? (Array.isArray(c.species_info) ? c.species_info[0] : c.species_info) : null
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id: `log:${row.id}`,
          who: row.user_id === user?.id ? 'Ты' : (profile?.display_name ?? 'Рыбак'),
          userId: row.user_id,
          avatarUrl: profile?.avatar_url ?? null,
          mine: row.user_id === user?.id,
          kind: row.kind as 'catch' | 'claim',
          territoryId: row.territory_id,
          territoryKind: territory?.kind ?? 'sea',
          speciesName: speciesInfo?.name ?? null,
          speciesCategory: (speciesInfo?.category as 'marine' | 'freshwater' | undefined) ?? null,
          lengthCm: c?.length_cm ?? null,
          weightKg: c?.weight_kg ?? null,
          photoUrl: c?.photo_url ?? null,
          createdAt: row.created_at,
        }
      })

      // "Someone followed you" isn't stored in activity_log (would need a
      // nullable territory_id and a trigger on follows) — synthesized here
      // from the follows table instead, merged and re-sorted with the rest.
      let followEntries: ActivityEntry[] = []
      if (user) {
        const { data: followedByRows, error: followedByError } = await supabase
          .from('follows')
          .select('follower_id, created_at, profiles!follows_follower_id_fkey(display_name, avatar_url)')
          .eq('followee_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        if (followedByError) throw followedByError
        followEntries = (followedByRows ?? []).map((f): ActivityEntry => {
          const p = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles
          return {
            id: `follow:${f.follower_id}`,
            who: p?.display_name ?? 'Рыбак',
            userId: f.follower_id,
            avatarUrl: p?.avatar_url ?? null,
            mine: false,
            kind: 'follow',
            speciesName: null,
            speciesCategory: null,
            lengthCm: null,
            weightKg: null,
            photoUrl: null,
            createdAt: f.created_at,
          }
        })
      }

      return [...catchEntries, ...followEntries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    },
  })
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async (): Promise<Profile> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('profiles_with_stats').select('*').eq('id', userId!).single()
      if (error) throw error
      return {
        id: data.id!,
        displayName: data.display_name ?? 'Рыбак',
        location: data.location,
        avatarUrl: data.avatar_url,
        bio: data.bio,
        isAdmin: data.is_admin ?? false,
        isSuperAdmin: data.is_super_admin ?? false,
        isBlocked: data.is_blocked ?? false,
        publicId: data.public_id ?? '?????',
        followersCount: data.followers_count ?? 0,
        followingCount: data.following_count ?? 0,
        birthDate: data.birth_date ?? null,
        gender: (data.gender as Profile['gender']) ?? null,
        heightCm: data.height_cm ?? null,
        weightKg: data.weight_kg ?? null,
        territoryColor: data.territory_color ?? null,
        onboardingCompleted: data.onboarding_completed ?? true,
        createdAt: data.created_at ?? new Date().toISOString(),
      }
    },
    enabled: !!userId,
  })
}

// Admin-only "Все пользователи" directory (TerritoriesListScreen's "Все
// пользователи" button → UsersListScreen). Sorted newest-first at the
// source, matching the default the screen shows before any sort chip is
// picked; the other 3 sort keys are cheap enough to do client-side on this
// small a dataset, so no extra cached query variant per sort mode.
export function useAllUsers() {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: ['all-users'],
    enabled: isAdmin,
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
          displayName: r.display_name ?? 'Рыбак',
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

// Thin wrapper over the viewer's own (already-cached) profile query — no
// extra request, just reads the is_admin flag off it. See DECISIONS.md for
// why admin status lives on profiles instead of a client-side email check.
export function useIsAdmin() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  return profile?.isAdmin ?? false
}

// An imperative "search on submit" action, not a reactive cached lookup — a
// useMutation fits better here than useQuery (same reasoning as the other
// on-demand admin actions in this file).
export function useFindUserByPublicId() {
  return useMutation({
    mutationFn: async (publicId: string): Promise<string | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('profiles').select('id').eq('public_id', publicId).maybeSingle()
      if (error) throw error
      return data?.id ?? null
    },
  })
}

export function useSetBlocked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_blocked', { p_user_id: userId, p_blocked: blocked })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    },
  })
}

export function useIsSuperAdmin() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  return profile?.isSuperAdmin ?? false
}

// Only a super admin may call this (admin_set_admin checks is_super_admin,
// not just is_admin, on the caller) — granting/revoking admin rights is not
// itself an admin capability, see DECISIONS.md.
export function useSetAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_admin', { p_user_id: userId, p_is_admin: isAdmin })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      queryClient.invalidateQueries({ queryKey: ['current-admins'] })
    },
  })
}

// "Последние действия" — full unfiltered log of every admin action.
export function useAdminActions() {
  const isSuperAdmin = useIsSuperAdmin()
  return useQuery({
    queryKey: ['admin-actions'],
    enabled: isSuperAdmin,
    queryFn: async (): Promise<AdminAction[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('admin_actions')
        .select(
          'id, details, created_at, territory_id, target_user_id, profiles!admin_actions_admin_id_fkey(display_name), target:profiles!admin_actions_target_user_id_fkey(display_name)'
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map((row): AdminAction => {
        const admin = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        const target = Array.isArray(row.target) ? row.target[0] : row.target
        return {
          id: row.id,
          adminName: admin?.display_name ?? 'Админ',
          details: row.details,
          createdAt: row.created_at,
          targetUserId: row.target_user_id,
          targetUserName: target?.display_name ?? null,
          territoryId: row.territory_id,
        }
      })
    },
  })
}

// "Доступы" — a live list of who currently holds admin access (not a log:
// revoking someone removes them from this list instead of leaving a
// "revoked" trace). Grant date comes from the most recent grant_admin entry
// in admin_actions for that user, since profiles itself doesn't track it.
export function useCurrentAdmins() {
  const isSuperAdmin = useIsSuperAdmin()
  return useQuery({
    queryKey: ['current-admins'],
    enabled: isSuperAdmin,
    queryFn: async (): Promise<AdminListEntry[]> => {
      const supabase = createClient()
      const { data: admins, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('is_admin', true)
        .eq('is_super_admin', false)
      if (error) throw error
      if (!admins.length) return []

      const ids = admins.map((a) => a.id)
      const { data: grants, error: grantsError } = await supabase
        .from('admin_actions')
        .select('target_user_id, created_at')
        .eq('action', 'grant_admin')
        .in('target_user_id', ids)
        .order('created_at', { ascending: false })
      if (grantsError) throw grantsError

      const grantedAt = new Map<string, string>()
      for (const g of grants ?? []) {
        if (g.target_user_id && !grantedAt.has(g.target_user_id)) grantedAt.set(g.target_user_id, g.created_at)
      }

      return admins
        .map((a): AdminListEntry => ({
          id: a.id,
          displayName: a.display_name ?? 'Админ',
          grantedAt: grantedAt.get(a.id) ?? null,
        }))
        .sort((x, y) => (y.grantedAt ?? '').localeCompare(x.grantedAt ?? ''))
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (patch: {
      displayName?: string
      avatarUrl?: string
      bio?: string | null
      birthDate?: string
      gender?: 'male' | 'female'
      heightCm?: number | null
      weightKg?: number | null
      territoryColor?: string
      onboardingCompleted?: boolean
    }) => {
      if (!user) throw new Error('not authenticated')
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
          ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
          ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
          ...(patch.birthDate !== undefined ? { birth_date: patch.birthDate } : {}),
          ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
          ...(patch.heightCm !== undefined ? { height_cm: patch.heightCm } : {}),
          ...(patch.weightKg !== undefined ? { weight_kg: patch.weightKg } : {}),
          ...(patch.territoryColor !== undefined ? { territory_color: patch.territoryColor } : {}),
          ...(patch.onboardingCompleted !== undefined ? { onboarding_completed: patch.onboardingCompleted } : {}),
        })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
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
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: ['reports'],
    enabled: isAdmin,
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
            reporterName: reporter?.display_name ?? 'Рыбак',
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

export function useAdminDeleteCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (catchId: number) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_delete_catch', { p_catch_id: catchId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useAdminDeleteTerritory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (territoryId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_delete_territory', { p_territory_id: territoryId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
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

export function useConfirmCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      territoryId: string
      species: string
      photoUrl: string
      lengthCm: number | null
      weightKg: number | null
      method: string | null
      bait: string | null
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('confirm_catch', {
        p_territory_id: args.territoryId,
        p_species: args.species,
        p_photo_url: args.photoUrl,
        p_length_cm: args.lengthCm ?? undefined,
        p_weight_kg: args.weightKg ?? undefined,
        p_method: args.method ?? undefined,
        p_bait: args.bait ?? undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}
