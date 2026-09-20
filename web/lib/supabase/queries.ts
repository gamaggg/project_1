'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Territory, TerritoryStatus, Catch, ProfileSummary, ActivityEntry, TerritoryKind, Species, Profile, CatchReport, AdminAction, AdminListEntry, AdminPermissions, UserListEntry, WeeklyLeaderboardEntry, UserAward, AwardKind } from '@/lib/data/types'
import type { SpeciesCategory } from '@/lib/data/species'
import { CITIES, type CityId } from '@/lib/data/city'

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
      const columns = 'id, kind, lat, lng, corners, owner_id, owner_avatar_url, owner_display_name, catch_count, last_catch_at, is_deleted, shield_until, owner_equipped_skin'
      // PostgREST caps a single response at 1000 rows by default and stays
      // silent about it (no error, just a truncated array) — the table
      // crossed that count once admin-added sectors piled up, which is how
      // a whole batch of newly created territories could exist in the
      // database yet never reach the map. Page through with .range() so the
      // table can keep growing past 1000 without this recurring.
      const pageSize = 1000
      const first = await supabase.from('territories_with_stats').select(columns).range(0, pageSize - 1)
      if (first.error) throw first.error
      const data = first.data
      let lastPageLength = data.length
      for (let from = pageSize; lastPageLength === pageSize; from += pageSize) {
        const page = await supabase.from('territories_with_stats').select(columns).range(from, from + pageSize - 1)
        if (page.error) throw page.error
        data.push(...page.data)
        lastPageLength = page.data.length
      }

      const byId = new Map(data.map((row) => [row.id, row]))
      const staticIds = new Set(geometry.data!.map((g) => g.id))

      function toTerritory(id: string, kind: TerritoryKind, lat: number, lng: number, corners: [number, number][]): Territory {
        const row = byId.get(id)
        const ownerId = row?.owner_id ?? null
        const status: TerritoryStatus = ownerId === null ? 'free' : ownerId === user?.id ? 'mine' : 'other'
        return {
          id,
          kind,
          lat,
          lng,
          corners,
          ownerId,
          ownerAvatarUrl: row?.owner_avatar_url ?? null,
          ownerDisplayName: row?.owner_display_name ?? null,
          status,
          catchCount: row?.catch_count ?? 0,
          lastCatchAt: row?.last_catch_at ?? null,
          shieldUntil: row?.shield_until ?? null,
          ownerEquippedSkin: row?.owner_equipped_skin ?? null,
        }
      }

      const fromStatic = geometry.data!
        // Geometry is a static asset (see useSectorsGeometry) — a sector a
        // super admin deleted (admin_delete_territory) stays in that file,
        // so it's dropped here based on the DB row's is_deleted flag instead.
        .filter((g) => !byId.get(g.id)?.is_deleted)
        .map((g) => toTerritory(g.id, g.kind, g.lat, g.lng, g.corners))

      // Sectors a super admin placed on the map (admin_add_territory) live
      // only in the DB — the static file is generated once offline (see
      // tools/fishing-hex) and isn't writable at runtime, so their geometry
      // is stored on the row itself instead (see lib/data/hexGrid.ts for how
      // it's computed to still land on the exact same grid).
      const fromDb = data
        // territories_with_stats' columns are typed nullable because it's a
        // view (PostgREST can't see the base table's NOT NULL constraints
        // through the join) — id/kind/lat/lng are never actually null here,
        // same reasoning as useAllUsers' row.id! below.
        .filter((row): row is typeof row & { corners: NonNullable<typeof row.corners> } => !staticIds.has(row.id!) && !row.is_deleted && !!row.corners)
        .map((row) => toTerritory(row.id!, row.kind!, row.lat!, row.lng!, row.corners as unknown as [number, number][]))

      return [...fromStatic, ...fromDb]
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

// Every id that has ever existed, deleted or not — useTerritories() filters
// out is_deleted rows, but admin_add_territory rejects any id that's already
// a row in the table regardless of is_deleted, so picking a "next available"
// id (see lib/data/hexGrid.ts's nextSectorId) needs the unfiltered set or it
// can re-offer an id that's just soft-deleted, not actually free. Admin-only:
// nothing outside the bulk-add flow needs this.
export function useAllTerritoryIds() {
  const isSuperAdmin = useIsSuperAdmin()
  return useQuery({
    queryKey: ['all-territory-ids'],
    enabled: isSuperAdmin,
    queryFn: async (): Promise<string[]> => {
      const supabase = createClient()
      // Same PostgREST 1000-row cap as useTerritories() above — this list
      // decides the next free sector id (see hexGrid.ts's nextSectorId), so
      // a silent truncation here doesn't just hide rows, it makes the admin
      // bulk-add flow think already-used ids are free and collide with them.
      const pageSize = 1000
      const ids: string[] = []
      let lastPageLength = 0
      for (let from = 0; from === 0 || lastPageLength === pageSize; from += pageSize) {
        const { data, error } = await supabase.from('territories').select('id').range(from, from + pageSize - 1)
        if (error) throw error
        ids.push(...data.map((row) => row.id))
        lastPageLength = data.length
      }
      return ids
    },
  })
}

// Without this, territories/catches/activity only ever refresh from this
// tab's own mutations (the invalidateQueries calls below), a window refocus,
// or a reload — another user's capture never reaches an already-open tab on
// its own (see DECISIONS.md). One shared channel for the session, mirroring
// the same query keys those mutations already invalidate on success; the
// payload itself is ignored; a change just means "go refetch" and the
// existing queries re-apply their own filtering/sorting/RLS as normal.
export function useRealtimeSync() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase
      .channel('territory-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, () => {
        queryClient.invalidateQueries({ queryKey: ['territories'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['territories'] })
        queryClient.invalidateQueries({ queryKey: ['catches'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['activity'] })
      })
      // Own channel filter (not RLS) — a new row here fires for many users at
      // once (e.g. a claim fans out to one notification per follower), and
      // without user_id=eq scoping this client would get invalidation pings
      // for everyone else's notifications too, not just its own. Covers the
      // unread badge (useUnreadNotificationCount had no realtime source of
      // its own before this) and also fixes new_follower, which activity_log
      // alone never carried — follows never had a listener either.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activity'] })
          queryClient.invalidateQueries({ queryKey: ['unread-notifications', user.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])
}

// Reference data (36 species, sea/river/stream/lake) — read-only, cached like
// the sector geometry. See DECISIONS.md for why this is a DB table, not a
// hardcoded list like METHODS/BAITS.
export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: async (): Promise<Species[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('species').select('key, name, category').order('sort_order').order('name')
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
    speciesCategory: (info?.category as SpeciesCategory) ?? 'marine',
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

// Fetches one catch directly by id — for CatchPhotoScreen, which needs to be
// self-contained (same reasoning as MyCatchesScreen/AchievementDetailScreen)
// and openable from a ?catch=<id> deep link a viewer's own list caches may
// not already contain.
export function useCatchById(id: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'by-id', id],
    queryFn: async (): Promise<Catch> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('catches').select(CATCH_SELECT).eq('id', id!).single()
      if (error) throw error
      return rowToCatch(data as CatchRow, user?.id)
    },
    enabled: !!id,
  })
}

// Powers both the heart+count and CatchPhotoScreen's facepile — one fetch,
// most-recent-first (so the facepile's leading avatars are whoever just
// liked it), since a catch's like count is small enough that paginating
// separately from the preview isn't worth the extra round trip.
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
        return { userId: r.user_id, displayName: p?.display_name ?? 'Рыбак', avatarUrl: p?.avatar_url ?? null }
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
            ? [{ userId: user.id, displayName: myProfile?.displayName ?? 'Ты', avatarUrl: myProfile?.avatarUrl ?? null }, ...likers]
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

export function useMyCatches() {
  const { user } = useAuth()
  return useCatchesByUser(user?.id ?? null)
}

// A personal inbox rather than a public timeline: each row was written for
// this specific person at the moment the event happened (see the
// fanout_activity_notification trigger), so none of the "is this relevant to
// me" filtering this used to do client-side is needed any more — and read
// state lives in the database instead of one browser's localStorage, where it
// silently reset on every device switch.
//
// Your own actions are deliberately absent: unread should mean "someone did
// something", not "you caught a fish". Announcements stay outside the table
// because they're identical for everyone — fanning one out into a row per
// user would multiply writes for no gain — so they're fetched globally and
// merged back in at the right chronological spot.
export function useActivity() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['activity', user?.id ?? null],
    queryFn: async (): Promise<ActivityEntry[]> => {
      const supabase = createClient()

      let notificationEntries: ActivityEntry[] = []
      if (user) {
        // No user_id filter: row-level security already limits this to the
        // caller's own notifications, and naming two FKs to profiles means
        // the actor embed has to say which one it follows.
        const { data, error } = await supabase
          .from('notifications')
          .select(
            'id, kind, created_at, read_at, actor_id, territory_id, catch_id, payload, territories(kind), catches(length_cm, weight_kg, photo_url, species_info:species(name, category)), actor:profiles!notifications_actor_id_fkey(display_name, avatar_url)'
          )
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error

        notificationEntries = (data ?? []).map((row): ActivityEntry => {
          const territory = Array.isArray(row.territories) ? row.territories[0] : row.territories
          const c = Array.isArray(row.catches) ? row.catches[0] : row.catches
          const speciesInfo = c ? (Array.isArray(c.species_info) ? c.species_info[0] : c.species_info) : null
          const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor
          const payload = (row.payload ?? {}) as Record<string, unknown>
          const kind: ActivityEntry['kind'] =
            row.kind === 'sector_lost'
              ? 'sector_lost'
              : row.kind === 'catch_liked'
                ? 'like'
                : row.kind === 'new_follower'
                  ? 'follow'
                  : row.kind === 'moderation'
                    ? 'moderation'
                    : row.kind === 'award_granted'
                      ? 'award'
                      : row.kind === 'weekly_result'
                        ? 'weekly_result'
                        : row.kind === 'challenge_completed'
                          ? 'challenge'
                          : row.kind === 'challenges_week_done'
                            ? 'challenges_week_done'
                            : row.kind === 'challenge_deadline_soon'
                              ? 'challenge_deadline'
                              : 'catch'
          return {
            id: `notif:${row.id}`,
            who: actor?.display_name ?? 'Рыбак',
            userId: row.actor_id ?? '',
            avatarUrl: actor?.avatar_url ?? null,
            // The one kind that's about a sector of yours rather than about
            // someone else's activity — what the "Мои территории" filter now
            // selects on.
            mine: row.kind === 'sector_lost',
            kind,
            territoryId: row.territory_id ?? undefined,
            territoryKind: territory?.kind ?? undefined,
            speciesName: speciesInfo?.name ?? null,
            speciesCategory: (speciesInfo?.category as SpeciesCategory | undefined) ?? null,
            lengthCm: c?.length_cm ?? null,
            weightKg: c?.weight_kg ?? null,
            photoUrl: c?.photo_url ?? null,
            catchId: row.catch_id,
            createdAt: row.created_at,
            unread: row.read_at === null,
            body: null,
            buttonLabel: null,
            buttonUrl: null,
            awardTitle: kind === 'award' ? ((payload.title as string) ?? null) : null,
            awardSubtitle: kind === 'award' ? ((payload.subtitle as string) ?? null) : null,
            awardCoins: kind === 'award' ? ((payload.coins as number) ?? null) : null,
            weeklyRank: kind === 'weekly_result' ? ((payload.rank as number) ?? null) : null,
            weeklySectors: kind === 'weekly_result' ? ((payload.sectors as number) ?? null) : null,
            weeklyCatches: kind === 'weekly_result' ? ((payload.catches as number) ?? null) : null,
            challengeTitle: kind === 'challenge' ? ((payload.title as string) ?? null) : null,
            challengeCoins: kind === 'challenge' || kind === 'challenges_week_done' ? ((payload.coins as number) ?? null) : null,
            challengeHours: kind === 'challenge_deadline' ? ((payload.hours as number) ?? null) : null,
            moderationSpecies: kind === 'moderation' ? ((payload.species as string) ?? null) : null,
            moderationCoinsRemoved: kind === 'moderation' ? ((payload.coinsRemoved as number) ?? null) : null,
          }
        })
      }

      // Super-admin broadcasts (see admin_post_announcement) — global, not
      // scoped to this user or who they follow, so every user's feed shows
      // the same ones merged in at the right chronological spot.
      const { data: announcementRows, error: announcementsError } = await supabase
        .from('announcements')
        .select('id, body, button_label, button_url, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (announcementsError) throw announcementsError
      const announcementEntries: ActivityEntry[] = (announcementRows ?? []).map((a) => ({
        id: `announcement:${a.id}`,
        who: 'RANGE',
        userId: '',
        avatarUrl: null,
        mine: false,
        kind: 'announcement',
        speciesName: null,
        speciesCategory: null,
        lengthCm: null,
        weightKg: null,
        photoUrl: null,
        catchId: null,
        createdAt: a.created_at,
        // Announcements have no per-person row to carry read state, so they
        // never show an unread dot of their own.
        unread: false,
        body: a.body,
        buttonLabel: a.button_label,
        buttonUrl: a.button_url,
        awardTitle: null,
        awardSubtitle: null,
        awardCoins: null,
        weeklyRank: null,
        weeklySectors: null,
        weeklyCatches: null,
        challengeTitle: null,
        challengeCoins: null,
        challengeHours: null,
        moderationSpecies: null,
        moderationCoinsRemoved: null,
      }))

      return [...notificationEntries, ...announcementEntries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    },
  })
}

// Drives the badge on the "Активность" tab. Kept separate from useActivity so
// the count is available without the feed itself being mounted.
export function useUnreadNotificationCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['unread-notifications', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const supabase = createClient()
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.rpc('mark_notifications_read')
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-notifications', user?.id ?? null] })
    },
  })
}

export function useAdminPostAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      body,
      buttonLabel,
      buttonUrl,
      broadcastTelegram,
      photoUrl,
    }: {
      body: string
      buttonLabel?: string
      buttonUrl?: string
      broadcastTelegram?: boolean
      photoUrl?: string
    }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_post_announcement', {
        p_body: body,
        p_button_label: buttonLabel,
        p_button_url: buttonUrl,
        p_broadcast_telegram: broadcastTelegram,
        p_photo_url: photoUrl,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] })
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
        heroBg: data.hero_bg ?? null,
        onboardingCompleted: data.onboarding_completed ?? true,
        createdAt: data.created_at ?? new Date().toISOString(),
        city: (data.city as CityId) ?? 'batumi',
        canModerateReports: data.can_moderate_reports ?? null,
        canBlockUsers: data.can_block_users ?? null,
        canAddCatchManually: data.can_add_catch_manually ?? null,
        canViewAllUsers: data.can_view_all_users ?? null,
        canAddCatchFromGallery: data.can_add_catch_from_gallery ?? null,
        equippedFrame: data.equipped_frame ?? null,
        coins: data.coins ?? null,
        equippedNameStyle: data.equipped_name_style ?? null,
        equippedSkin: data.equipped_skin ?? null,
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

// Weekly rating for the Territories tab's "Рейтинг" toggle — ranked by
// sectors first-claimed this Batumi week (Mon 00:00 – Sun 23:59, see the
// RPC), catches this week as the secondary stat. friendsOnly scopes it to
// people the viewer follows (plus the viewer themselves) instead of everyone.
// A fresh query per scope (not client-side refiltering of one big list) —
// "friends" would otherwise need every profile's full follow graph client-side
// just to filter ten rows.
export function useWeeklyLeaderboard(friendsOnly: boolean, weekOffset: number = 0, cityPrefix: string = 'B', timezone: string = 'Asia/Tbilisi') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['weekly-leaderboard', friendsOnly, weekOffset, cityPrefix],
    enabled: !!user,
    queryFn: async (): Promise<WeeklyLeaderboardEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
        p_friends_only: friendsOnly,
        p_limit: 10,
        p_week_offset: weekOffset,
        p_city_prefix: cityPrefix,
        p_timezone: timezone,
      })
      if (error) throw error
      return data.map(
        (r): WeeklyLeaderboardEntry => ({
          userId: r.user_id,
          displayName: r.display_name ?? 'Рыбак',
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
          title: r.title,
          subtitle: r.subtitle,
          description: r.description,
          earnedAt: r.earned_at,
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

// Gates one of the 4 delegable admin actions on the *viewer's own* account —
// a super admin always passes (they're not limited by the granular flags),
// a plain admin needs is_admin plus the specific permission column.
function useAdminFlag(flag: 'canModerateReports' | 'canBlockUsers' | 'canAddCatchManually' | 'canViewAllUsers' | 'canAddCatchFromGallery') {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  return !!profile?.isSuperAdmin || (!!profile?.isAdmin && !!profile?.[flag])
}
export function useCanModerateReports() {
  return useAdminFlag('canModerateReports')
}
export function useCanBlockUsers() {
  return useAdminFlag('canBlockUsers')
}
export function useCanAddCatchManually() {
  return useAdminFlag('canAddCatchManually')
}
export function useCanViewAllUsers() {
  return useAdminFlag('canViewAllUsers')
}
export function useCanAddCatchFromGallery() {
  return useAdminFlag('canAddCatchFromGallery')
}

// The real, unmasked permission set for one admin (profiles_with_stats masks
// these to null for anyone but the row's own owner) — only a super admin can
// call get_admin_permissions, for any target user. Pre-fills
// AdminPermissionsModal's toggles when editing an existing admin.
export function useAdminPermissions(userId: string | null) {
  const isSuperAdmin = useIsSuperAdmin()
  return useQuery({
    queryKey: ['admin-permissions', userId],
    enabled: isSuperAdmin && !!userId,
    queryFn: async (): Promise<AdminPermissions> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_admin_permissions', { p_user_id: userId! })
      if (error) throw error
      const row = data?.[0]
      return {
        isAdmin: row?.is_admin ?? false,
        canModerateReports: row?.can_moderate_reports ?? false,
        canBlockUsers: row?.can_block_users ?? false,
        canAddCatchManually: row?.can_add_catch_manually ?? false,
        canViewAllUsers: row?.can_view_all_users ?? false,
        canAddCatchFromGallery: row?.can_add_catch_from_gallery ?? false,
      }
    },
  })
}

// Only a super admin may call this (admin_set_admin checks is_super_admin,
// not just is_admin, on the caller) — granting/revoking admin rights is not
// itself an admin capability, see DECISIONS.md. Sets the full permission set
// in one call — used both to grant a fresh admin (with whichever toggles were
// picked) and to edit an existing admin's permissions (isAdmin stays true).
export function useSetAdminPermissions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      userId: string
      isAdmin: boolean
      canModerateReports: boolean
      canBlockUsers: boolean
      canAddCatchManually: boolean
      canViewAllUsers: boolean
      canAddCatchFromGallery: boolean
    }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_admin', {
        p_user_id: args.userId,
        p_is_admin: args.isAdmin,
        p_can_moderate_reports: args.canModerateReports,
        p_can_block_users: args.canBlockUsers,
        p_can_add_catch_manually: args.canAddCatchManually,
        p_can_view_all_users: args.canViewAllUsers,
        p_can_add_catch_from_gallery: args.canAddCatchFromGallery,
      })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-permissions', userId] })
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
      heroBg?: string
      onboardingCompleted?: boolean
      city?: CityId
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
          ...(patch.heroBg !== undefined ? { hero_bg: patch.heroBg } : {}),
          ...(patch.onboardingCompleted !== undefined ? { onboarding_completed: patch.onboardingCompleted } : {}),
          ...(patch.city !== undefined ? { city: patch.city } : {}),
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

export type TelegramNotificationState = {
  // Do we know who this person is in Telegram at all? Mini App sign-ups do;
  // people who registered by email through the browser don't until they use
  // the connect button.
  linked: boolean
  // A bot may not message someone who never opened a chat with it, so this
  // has to be true before any notification can arrive — being linked isn't
  // enough on its own.
  botStarted: boolean
  enabled: boolean
  // Telegram told us the chat is closed for good (blocked, or the account is
  // gone). Shown as "reconnect", not as an error.
  unreachable: boolean
}

export function useTelegramNotificationState() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['telegram-notification-state', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<TelegramNotificationState> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('my_telegram_notification_state')
      if (error) throw error
      const row = data?.[0]
      return {
        linked: row?.linked ?? false,
        botStarted: row?.bot_started ?? false,
        enabled: row?.enabled ?? false,
        unreachable: row?.unreachable ?? false,
      }
    },
  })
}

export function useSetTelegramNotifications() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('set_telegram_notifications', { p_enabled: enabled })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-notification-state', user?.id ?? null] })
    },
  })
}

// Mints the one-tap deep link that attaches this account to whichever
// Telegram opens it. Goes through the API route rather than the RPC directly
// because the bot's @username has to be read from Telegram server-side.
export function useCreateTelegramLink() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const res = await fetch('/api/telegram/link-token', { method: 'POST' })
      if (!res.ok) throw new Error('link failed')
      const body = await res.json()
      return body.url as string
    },
  })
}

export type ShopItem = {
  id: string
  category: 'hero_bg' | 'avatar_frame' | 'name_style' | 'territory_skin'
  name: string
  price: number
}

// The catalog rarely changes (a handful of rows, hand-curated) — cached like
// species/sectors-geometry rather than refetched per screen visit.
export function useShopItems() {
  return useQuery({
    queryKey: ['shop-items'],
    queryFn: async (): Promise<ShopItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('shop_items').select('id, category, name, price').order('category').order('sort_order')
      if (error) throw error
      return data.map((r) => ({ id: r.id, category: r.category as ShopItem['category'], name: r.name, price: r.price }))
    },
  })
}

// Which item ids the signed-in user owns — a flat id set is all the Shop
// screen and the equip buttons need (RLS already scopes this to the caller).
export function useMyInventory() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-inventory', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('user_inventory').select('item_id')
      if (error) throw error
      return new Set(data.map((r) => r.item_id))
    },
  })
}

export function useBuyShopItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('buy_shop_item', { p_item_id: itemId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inventory', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}

// itemId null unequips the current avatar frame — see equip_shop_item.
export function useEquipShopItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ itemId, category }: { itemId: string | null; category?: 'avatar_frame' | 'name_style' | 'territory_skin' }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('equip_shop_item', { p_item_id: itemId, p_category: category ?? 'avatar_frame' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['territories'] })
    },
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
        return { userId: r.follower_id, displayName: p?.display_name ?? 'Рыбак', avatarUrl: p?.avatar_url ?? null }
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

export function useAdminAddTerritory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (draft: { id: string; kind: TerritoryKind; lat: number; lng: number; corners: [number, number][] }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_add_territory', {
        p_id: draft.id,
        p_kind: draft.kind,
        p_lat: draft.lat,
        p_lng: draft.lng,
        p_corners: draft.corners,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      queryClient.invalidateQueries({ queryKey: ['all-territory-ids'] })
    },
  })
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export function useAdminSetPublicId() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, publicId }: { userId: string; publicId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_public_id', { p_user_id: userId, p_public_id: publicId })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

// Positive amount grants, negative deducts (clamped to 0 server-side —
// never goes below). Visible only to the caller here because coins itself
// is self-only masked in profiles_with_stats, except for a super admin
// viewing someone else — see that view's own coins CASE.
export function useAdminGrantCoins() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_grant_coins', { p_user_id: userId, p_amount: amount })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export type AdminInventoryEntry = {
  kind: 'item' | 'buff'
  itemId: string
  activeBuffId: number | null
  label: string
  price: number
  expiresAt: string | null
}

// Super-admin-only view of another player's purchases (owned shop_items +
// still-active, unconsumed buffs) — powers the "Вернуть" refund UI on
// UserProfileScreen. Not used for the viewer's own inventory (that's
// useMyInventory, a plain id set for cheap owned-item lookups).
export function useAdminUserInventory(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-inventory', userId],
    enabled: !!userId,
    queryFn: async (): Promise<AdminInventoryEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_get_user_inventory', { p_user_id: userId! })
      if (error) throw error
      return (data ?? []).map((r) => ({
        kind: r.kind as 'item' | 'buff',
        itemId: r.item_id,
        activeBuffId: r.active_buff_id,
        label: r.label,
        price: r.price,
        expiresAt: r.expires_at,
      }))
    },
  })
}

export function useAdminRefundItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, itemId }: { userId: string; itemId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_refund_shop_item', { p_user_id: userId, p_item_id: itemId })
      if (error) throw error
    },
    // Refunding is now specifically a super-admin self-service tool (see
    // ProfileScreen.tsx's own "Инвентарь" section) — userId is always the
    // caller's own id in practice, so my-inventory needs invalidating too
    // for the Shop grid to drop the refunded item immediately.
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-inventory', userId] })
      queryClient.invalidateQueries({ queryKey: ['my-inventory', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export function useAdminRefundBuff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, activeBuffId }: { userId: string; activeBuffId: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_refund_buff', { p_user_id: userId, p_active_buff_id: activeBuffId })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-inventory', userId] })
      queryClient.invalidateQueries({ queryKey: ['my-active-buffs', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
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
      const { data, error } = await supabase
        .rpc('confirm_catch', {
          p_territory_id: args.territoryId,
          p_species: args.species,
          p_photo_url: args.photoUrl,
          p_length_cm: args.lengthCm ?? undefined,
          p_weight_kg: args.weightKg ?? undefined,
          p_method: args.method ?? undefined,
          p_bait: args.bait ?? undefined,
        })
        .single()
      if (error) throw error
      return { speciesCoins: data.species_coins, captureCoins: data.capture_coins }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
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
        name: r.name,
        description: r.description,
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

export type Buff = {
  id: string
  name: string
  description: string
  price: number
  durationHours: number | null
}

// Catalog is a handful of hand-curated rows — cached like shop_items/species
// rather than refetched per screen visit.
export function useBuffs() {
  return useQuery({
    queryKey: ['buffs'],
    queryFn: async (): Promise<Buff[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('buffs').select('id, name, description, price, duration_hours').order('sort_order')
      if (error) throw error
      return data.map((r) => ({ id: r.id, name: r.name, description: r.description, price: r.price, durationHours: r.duration_hours }))
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export type ActiveBuff = {
  id: number
  buffId: string
  activatedAt: string
  expiresAt: string
  consumed: boolean
}

// Everything the caller has bought that hasn't expired — the duration buff
// (double_coins) shows a countdown, armed-but-unconsumed ones (tide/echo)
// show "ready, waiting for your next catch".
export function useMyActiveBuffs() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-active-buffs', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<ActiveBuff[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('active_buffs')
        .select('id, buff_id, activated_at, expires_at, consumed')
        .gt('expires_at', new Date().toISOString())
        .order('activated_at', { ascending: false })
      if (error) throw error
      return data.map((r) => ({ id: r.id, buffId: r.buff_id, activatedAt: r.activated_at, expiresAt: r.expires_at, consumed: r.consumed }))
    },
  })
}

export type CoinTransaction = {
  id: number
  amount: number
  reason: string
  label: string
  createdAt: string
}

// Every coin-mutating RPC (buy_shop_item, activate_buff, buy_shield,
// swap_challenge, buy_extra_challenge, sync_my_challenges' payouts,
// admin_grant_coins, admin_refund_*) logs one row here — see the
// coin_transactions_ledger migration. RLS scopes this to the caller's own
// rows, so no p_user_id param is needed. Refetches on every mount rather
// than being wired into every mutation's onSuccess (nine call sites across
// four screens) — the history is opened on demand, not shown live, so a
// fresh fetch each time it opens is simpler and just as correct.
export function useMyCoinTransactions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-coin-transactions', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<CoinTransaction[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('coin_transactions')
        .select('id, amount, reason, label, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, label: r.label, createdAt: r.created_at }))
    },
  })
}

// Super-admin-only view of another player's coin history (GrantCoinsModal's
// "История" section) — same shape as useMyCoinTransactions but goes through
// admin_get_user_coin_transactions since coin_transactions' RLS only exposes
// the caller's own rows (see that policy).
export function useAdminUserCoinTransactions(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-coin-transactions', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CoinTransaction[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_get_user_coin_transactions', { p_user_id: userId! })
      if (error) throw error
      return data.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, label: r.label, createdAt: r.created_at }))
    },
  })
}

// tide/echo/double_coins — the three buffs with no purchase-time target
// (see buy_shield for the fourth, which needs a sector).
export function useActivateBuff() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (buffId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('activate_buff', { p_buff_id: buffId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-active-buffs', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}

export type WheelSpinResult = {
  segmentIndex: number
  multiplier: number
  payout: number
  newBalance: number
}

// ДЭП (Shop's wheel-of-fortune tab) — the RNG and payout live entirely in
// spin_wheel itself (client can't influence or predict the roll), this just
// forwards the bet and hands back which slot it landed on so WheelScreen can
// spin the dial to the right angle before showing the result. Deliberately
// does NOT invalidate the profile/coins query on its own success: the RPC
// resolves almost instantly, well before the multi-second spin animation
// finishes, so refetching here would flash the new balance in the header
// while the dial is still spinning — spoiling the reveal by telegraphing
// the outcome early. WheelScreen invalidates it itself once the dial
// actually stops, see its onSpinEnd.
export function useSpinWheel() {
  return useMutation({
    mutationFn: async (bet: number): Promise<WheelSpinResult> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('spin_wheel', { p_bet: bet }).single()
      if (error) throw error
      return { segmentIndex: data.segment_index, multiplier: data.multiplier, payout: data.payout, newBalance: data.new_balance }
    },
  })
}

export function useBuyShield() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (territoryId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('buy_shield', { p_territory_id: territoryId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}
