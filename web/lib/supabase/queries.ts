'use client'

import { useEffect } from 'react'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Territory, TerritoryCoHolder, TerritoryStatus, Catch, ProfileSummary, ActivityEntry, TerritoryKind, Species, Profile, CatchReport, AdminAction, AdminListEntry, AdminPermissions, UserListEntry, WeeklyLeaderboardEntry, UserAward, AwardKind, CatchComment, ClanSummary, ClanDetail, ClanMember, ClanEligibility, ClanInvite, ClanChest, ClanRace, ClanChatMessage, ClanChatSummary, ClanRoleId } from '@/lib/data/types'
import type { SpeciesCategory } from '@/lib/data/species'
import { CITIES, type CityId } from '@/lib/data/city'
import { compareSectors } from '@/lib/data/sectorOrder'
import type { ShareKind } from '@/lib/guestShare'
import type { Database } from '@/lib/types'
import { mapRecap, type WeekRecap } from '@/lib/recap'
import { uploadSupportPhoto } from '@/lib/supabase/storage'
import { downscaleToJpeg } from '@/lib/exif'

type SectorGeometry = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
}

// Geometry never changes at runtime (see tools/fishing-hex) — fetched once from the
// static asset and cached for the life of the tab, independent of ownership state.
const sectorsGeometryQuery = {
  queryKey: ['sectors-geometry'],
  queryFn: async () => {
    const res = await fetch('/data/sectors.json')
    return (await res.json()) as SectorGeometry[]
  },
  staleTime: Infinity,
  gcTime: Infinity,
}

export function useSectorsGeometry() {
  return useQuery(sectorsGeometryQuery)
}

// territories_with_stats had ~1.9k rows in Sept 2026 — two pages. Those are
// requested together instead of one after the other; a table that outgrows
// them still loads in full, the extra pages just follow sequentially.
// 1 while a sector is one of the week's hot ones, else 0.
function hotRank(t: Territory): number {
  return t.hotUntil && new Date(t.hotUntil).getTime() > Date.now() ? 1 : 0
}

const TERRITORY_PAGE_SIZE = 1000
const TERRITORY_PARALLEL_PAGES = 2

// territories_with_stats.co_holders is a jsonb array of {id, avatar_url,
// display_name}, oldest share first — null when nobody shares the sector.
function toCoHolders(raw: unknown, myId: string | undefined): TerritoryCoHolder[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((h): h is { id: string; avatar_url?: string | null; display_name?: string | null } => typeof h?.id === 'string')
    .map((h) => ({ id: h.id, avatarUrl: h.avatar_url ?? null, displayName: h.display_name ?? null, isMe: h.id === myId }))
}

// Merges static geometry with live Supabase ownership (territories_with_stats) —
// see DECISIONS.md for why geometry stays a static asset instead of DB rows.
export function useTerritories() {
  const { user, sessionReady } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['territories', user?.id ?? null],
    queryFn: async (): Promise<Territory[]> => {
      const supabase = createClient()
      const columns =
        'id, kind, lat, lng, corners, owner_id, owner_avatar_url, owner_display_name, catch_count, last_catch_at, is_deleted, shield_until, owner_equipped_skin, owner_clan_id, owner_clan_name, owner_clan_crest, co_holders, capturer_id, hot_until, legend_id, defense'
      // PostgREST caps a single response at 1000 rows by default and stays
      // silent about it (no error, just a truncated array) — the table
      // crossed that count once admin-added sectors piled up, which is how
      // a whole batch of newly created territories could exist in the
      // database yet never reach the map. Page through with .range() so the
      // table can keep growing past 1000 without this recurring.
      const pageSize = TERRITORY_PAGE_SIZE
      // Pages need a fixed order: without one, two separate requests may
      // come back in different orders and overlap — some sectors twice,
      // others (up to hundreds) missing from the map.
      const fetchPage = (from: number) =>
        supabase.from('territories_with_stats').select(columns).order('id').range(from, from + pageSize - 1)
      // The static geometry and the first pages are fetched side by side —
      // the rows don't need the geometry until the merge below, so waiting
      // for sectors.json before asking the database only delayed the map.
      const [geometry, pages] = await Promise.all([
        queryClient.ensureQueryData(sectorsGeometryQuery),
        Promise.all(Array.from({ length: TERRITORY_PARALLEL_PAGES }, (_, i) => fetchPage(i * pageSize))),
      ])
      const data: NonNullable<(typeof pages)[number]['data']> = []
      for (const page of pages) {
        if (page.error) throw page.error
        data.push(...page.data)
      }
      let lastPageLength = pages[pages.length - 1].data?.length ?? 0
      for (let from = TERRITORY_PARALLEL_PAGES * pageSize; lastPageLength === pageSize; from += pageSize) {
        const page = await fetchPage(from)
        if (page.error) throw page.error
        data.push(...page.data)
        lastPageLength = page.data.length
      }

      const byId = new Map(data.map((row) => [row.id, row]))
      const staticIds = new Set(geometry.map((g) => g.id))

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
          ownerClanId: row?.owner_clan_id ?? null,
          ownerClanName: row?.owner_clan_name ?? null,
          ownerClanCrest: row?.owner_clan_crest ?? null,
          coHolders: toCoHolders(row?.co_holders, user?.id),
          capturerId: row?.capturer_id ?? null,
          hotUntil: row?.hot_until ?? null,
          legendId: row?.legend_id ?? null,
          defense: row?.defense ?? 0,
        }
      }

      const fromStatic = geometry
        // Geometry is a static asset (see useSectorsGeometry) — a sector a
        // super admin deleted (admin_delete_territory) stays in that file,
        // so it's dropped here based on the DB row's is_deleted flag instead.
        .filter((g) => !byId.get(g.id)?.is_deleted)
        // The water type in the DB wins over the static file's: a super
        // admin can change it (admin_set_territory_kind), and streams were
        // merged into rivers there. The file only fills in for sectors that
        // never got a DB row, or whose row has no kind.
        .map((g) => toTerritory(g.id, byId.get(g.id)?.kind ?? g.kind, g.lat, g.lng, g.corners))

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
        // Freshest catch first everywhere that lists territories (the map's
        // first card, the territories tab) — a single sort here instead of
        // one per screen, since every consumer shares this same array; the
        // tab re-sorts only when another order is picked there. Never-fished
        // sectors follow in number order (see compareSectors). The week's
        // hot sectors go before all of them — the map's first cards.
        .sort((a, b) => hotRank(b) - hotRank(a) || compareSectors('lastCatch')(a, b))
    },
    // Until the stored session is read the key would say "no user" and the
    // whole table would be fetched once for nobody, then again for the real
    // user.
    enabled: sessionReady,
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
        const { data, error } = await supabase.from('territories').select('id').order('id').range(from, from + pageSize - 1)
        if (error) throw error
        ids.push(...data.map((row) => row.id))
        lastPageLength = data.length
      }
      return ids
    },
  })
}

// How long after the first event of a burst the collected refetches fire.
// Measured from the first event, not reset by later ones, so a steady stream
// of catches still refreshes at least this often.
const REALTIME_COALESCE_MS = 800

// Without this, territories/catches/activity only ever refresh from this
// tab's own mutations (the invalidateQueries calls below), a window refocus,
// or a reload — another user's capture never reaches an already-open tab on
// its own (see DECISIONS.md). One shared channel for the session, mirroring
// the same query keys those mutations already invalidate on success; the
// payload itself is ignored; a change just means "go refetch" and the
// existing queries re-apply their own filtering/sorting/RLS as normal.
//
// Coalesced: one catch lands as a burst of row events (the catch itself,
// its sector's update, and more), and each event used to refetch on its
// own — measured 5 requests on every online client for just a two-event
// burst, four of them two full territory reloads (two pages each), each
// also redrawing every polygon on the map. Keys are collected and each is
// invalidated once per burst.
export function useRealtimeSync() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const pending = new Map<string, QueryKey>()
    let timer: ReturnType<typeof setTimeout> | null = null
    function schedule(...keys: QueryKey[]) {
      for (const key of keys) pending.set(JSON.stringify(key), key)
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        const keysToRefetch = [...pending.values()]
        pending.clear()
        for (const queryKey of keysToRefetch) queryClient.invalidateQueries({ queryKey })
      }, REALTIME_COALESCE_MS)
    }

    const channel = supabase
      .channel('territory-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, () => schedule(['territories']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches' }, () => schedule(['territories'], ['catches']))
      // No activity_log listener: the feed is built from `notifications`
      // (below, already scoped to this user) plus announcements, and nothing
      // under the ['activity'] key reads activity_log. Listening to it made
      // every action by anyone in the game refetch this user's feed.
      //
      // Own channel filter (not RLS) — a new row here fires for many users at
      // once (e.g. a claim fans out to one notification per follower), and
      // without user_id=eq scoping this client would get invalidation pings
      // for everyone else's notifications too, not just its own. Covers the
      // unread badge (useUnreadNotificationCount had no realtime source of
      // its own before this) and also fixes new_follower, which activity_log
      // alone never carried — follows never had a listener either.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () =>
        schedule(['activity'], ['unread-notifications', user.id], ['support'])
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
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
// One request per opened catch: the card's count and preview and the
// comments sheet all read this same cache entry (see CommentsSheet).
export function useCatchComments(catchId: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catch-comments', catchId],
    enabled: !!catchId,
    queryFn: async (): Promise<CatchComment[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_catch_comments', { p_catch_id: catchId! })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        parentId: r.parent_id,
        userId: r.user_id,
        displayName: r.display_name ?? 'Рыбак',
        avatarUrl: r.avatar_url,
        nameStyle: r.equipped_name_style,
        replyToUserId: r.reply_to_user_id,
        replyToName: r.reply_to_name,
        body: r.body,
        createdAt: r.created_at,
        deleted: r.deleted,
        mine: r.user_id === user?.id,
        clanCrest: r.clan_crest,
        clanName: r.clan_name,
      }))
    },
  })
}

// post_comment never raises for a rejected comment — the rejection has to
// commit (it feeds the mute escalation), so it comes back as a reason code
// instead (see lib/moderation.ts for the texts).
export type PostCommentResult = { ok: true } | { ok: false; reason: string; retryAfter: number | null; mutedUntil: string | null }

export function usePostComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, body, parentId }: { catchId: number; body: string; parentId: number | null }): Promise<PostCommentResult> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('post_comment', { p_catch_id: catchId, p_body: body, p_parent_id: parentId })
      if (error) throw error
      const r = data as { ok: boolean; reason?: string; retry_after?: number; muted_until?: string | null }
      if (r.ok) return { ok: true }
      return { ok: false, reason: r.reason ?? 'error', retryAfter: r.retry_after ?? null, mutedUntil: r.muted_until ?? null }
    },
    onSettled: (_data, _error, vars) => queryClient.invalidateQueries({ queryKey: ['catch-comments', vars.catchId] }),
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: number; catchId: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId })
      if (error) throw error
    },
    // Optimistic, mirroring get_catch_comments: a deleted root with live
    // replies stays as a placeholder, anything else just disappears.
    onMutate: ({ commentId, catchId }) => {
      const key = ['catch-comments', catchId]
      const previous = queryClient.getQueryData<CatchComment[]>(key)
      if (previous) {
        const next = previous.map((c) => (c.id === commentId ? { ...c, deleted: true, body: null } : c))
        queryClient.setQueryData<CatchComment[]>(
          key,
          next.filter((c) => !c.deleted || (c.parentId === null && next.some((r) => r.parentId === c.id && !r.deleted)))
        )
      }
      return { previous }
    },
    onError: (_error, { catchId }, context) => {
      if (context?.previous) queryClient.setQueryData(['catch-comments', catchId], context.previous)
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ['catch-comments', vars.catchId] })
      queryClient.invalidateQueries({ queryKey: ['admin-comment-reports'] })
    },
  })
}

export function useReportComment() {
  return useMutation({
    mutationFn: async ({ commentId, reason }: { commentId: number; reason: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('report_comment', { p_comment_id: commentId, p_reason: reason })
      if (error) throw error
    },
  })
}

// Live comments, but only while a sheet is actually open on this catch —
// one filtered channel, torn down on close, so nothing extra runs for
// everyone else (see useRealtimeSync for the app-wide channel).
export function useCatchCommentsLive(catchId: number | null) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!catchId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`catch-comments:${catchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catch_comments', filter: `catch_id=eq.${catchId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['catch-comments', catchId] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [catchId, queryClient])
}

export function useAdminCommentReports(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-comment-reports'],
    enabled,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_get_comment_reports')
      if (error) throw error
      return (data ?? []).map((r) => ({
        commentId: r.comment_id,
        catchId: r.catch_id,
        body: r.body,
        authorId: r.author_id,
        authorName: r.author_name,
        reportCount: Number(r.report_count),
        reasons: r.reasons ?? [],
        lastReportedAt: r.last_reported_at,
      }))
    },
  })
}

export function useAdminDismissCommentReports() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: number) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_dismiss_comment_reports', { p_comment_id: commentId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-comment-reports'] }),
  })
}

// What the text filter turned down (moderate_text), newest first, and who is
// muted right now — the «Фильтр» tab of the reports screen.
export type TextModerationLogEntry = {
  id: number
  userId: string
  displayName: string
  avatarUrl: string | null
  context: string
  reason: string
  body: string | null
  createdAt: string
  mutedUntil: string | null
}

export function useAdminTextModerationLog(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-text-moderation-log'],
    enabled,
    queryFn: async (): Promise<TextModerationLogEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_get_text_moderation_log', { p_limit: 150 })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        displayName: r.display_name ?? 'Рыбак',
        avatarUrl: r.avatar_url,
        context: r.context,
        reason: r.reason,
        body: r.body,
        createdAt: r.created_at,
        mutedUntil: r.muted_until,
      }))
    },
  })
}

export function useAdminUnmuteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_unmute_user', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-text-moderation-log'] }),
  })
}

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

export type LastCatchChoices = {
  methods: string[]
  baits: string[]
  // The newest catch's species and when it was caught — the form reuses it
  // within the same outing (see ConfirmScreen), when it's often the same fish
  // again and again.
  lastSpecies: { key: string; caughtAt: string } | null
  // Species keys by how often this person caught them, most first.
  frequentSpecies: string[]
}

// The caller's recently used methods, baits and species, newest first, so
// the catch form can open on what they picked last. Read back from their own
// catches rather than a separate "preference" stored per device: it follows
// the account across Telegram and the browser, and needs nothing new saved.
// Lists (not just the latest value) because baits are per city — the form
// takes the newest one that exists in the current sector's city list, so a
// Batumi-only bait doesn't get prefilled on a Moscow catch. Under the
// 'catches' key prefix, so the existing invalidations after a confirmed
// catch refresh it too.
export function useLastCatchChoices() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'last-choices', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<LastCatchChoices> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('catches')
        .select('species, method, bait, caught_at')
        .eq('user_id', user!.id)
        .order('caught_at', { ascending: false })
        .limit(60)
      if (error) throw error
      const methods: string[] = []
      const baits: string[] = []
      const counts = new Map<string, number>()
      for (const row of data) {
        if (row.method && !methods.includes(row.method)) methods.push(row.method)
        if (row.bait && !baits.includes(row.bait)) baits.push(row.bait)
        if (row.species) counts.set(row.species, (counts.get(row.species) ?? 0) + 1)
      }
      const last = data[0]
      return {
        methods,
        baits,
        lastSpecies: last?.species ? { key: last.species, caughtAt: last.caught_at } : null,
        frequentSpecies: [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([key]) => key),
      }
    },
  })
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
// Game notifications drawn as one generic row in «Активность».
const GAME_EVENT_KINDS = new Set(['hot_sector_week', 'hot_sector_won', 'legend_gained', 'legend_lost', 'bite_forecast', 'daily_reward_reminder', 'sector_attacked', 'support_reply', 'admin_gift'])

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
                              : row.kind === 'catch_comment'
                                ? 'comment'
                                : row.kind === 'comment_reply'
                                  ? 'comment_reply'
                                  : row.kind === 'comment_removed'
                                    ? 'comment_removed'
                                    : row.kind === 'clan_invite' ||
                                        row.kind === 'clan_join_request' ||
                                        row.kind === 'clan_join_accepted' ||
                                        row.kind === 'clan_role_changed' ||
                                        row.kind === 'clan_kicked' ||
                                        row.kind === 'clan_disbanded' ||
                                        row.kind === 'clan_chest_reward' ||
                                        row.kind === 'clan_race_result' ||
                                        row.kind === 'clan_race_overtaken' ||
                                        row.kind === 'clan_race_finished' ||
                                        row.kind === 'clan_chat_mention' ||
                                        row.kind === 'referral_joined' ||
                                        row.kind === 'referral_reward' ||
                                        row.kind === 'system_alert'
                                      ? (row.kind as ActivityEntry['kind'])
                                      : GAME_EVENT_KINDS.has(row.kind)
                                        ? 'game_event'
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
            commentText: kind === 'comment' || kind === 'comment_reply' || kind === 'clan_chat_mention' ? ((payload.text as string) ?? null) : null,
            commentId: (payload.comment_id as number | undefined) ?? null,
            clanId: (payload.clan_id as number | undefined) ?? null,
            clanName: (payload.clan_name as string | undefined) ?? null,
            clanCrest: payload.crest ?? null,
            clanRole: (payload.role as string | undefined) ?? null,
            clanWeek:
              kind === 'clan_chest_reward' || kind === 'clan_race_result' || kind === 'clan_race_overtaken' || kind === 'clan_race_finished'
                ? {
                    tier: (payload.tier as number | undefined) ?? null,
                    coins: (payload.coins as number | undefined) ?? null,
                    place: ((payload.place ?? payload.rank) as number | undefined) ?? null,
                    finished: !!payload.finished,
                    ahead: (payload.ahead as string | undefined) ?? null,
                    trophies: (payload.trophies as number | undefined) ?? null,
                  }
                : null,
            alertText: kind === 'system_alert' ? ((payload.text as string) ?? null) : null,
            gameEvent: kind === 'game_event' ? { kind: row.kind, payload } : null,
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
        commentText: null,
        commentId: null,
        clanId: null,
        clanName: null,
        clanCrest: null,
        clanRole: null,
        clanWeek: null,
        alertText: null,
      }))

      return [...notificationEntries, ...announcementEntries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    },
  })
}

// The «Все» tab's public half: recent catches by everyone in the player's
// city, followed or not (get_city_feed — never your own). Plain reading, no
// read state: these are never notifications. Under the 'catches' key prefix
// so the realtime catch listener (useRealtimeSync) keeps it fresh.
export function useCityFeed(city: CityId, enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['catches', 'city-feed', city, user?.id ?? null],
    enabled: enabled && !!user,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_city_feed', { p_city: city, p_limit: 60 })
      if (error) throw error
      return (data ?? []).map(
        (r): ActivityEntry => ({
          id: `city:${r.catch_id}`,
          who: r.display_name ?? 'Рыбак',
          userId: r.user_id,
          avatarUrl: r.avatar_url,
          mine: false,
          kind: 'catch',
          unread: false,
          fromCity: true,
          claimed: r.claimed,
          territoryId: r.territory_id,
          territoryKind: r.territory_kind ?? undefined,
          speciesName: r.species_name,
          speciesCategory: (r.species_category as SpeciesCategory | null) ?? null,
          lengthCm: r.length_cm,
          weightKg: r.weight_kg,
          photoUrl: r.photo_url,
          catchId: r.catch_id,
          createdAt: r.caught_at,
          body: null,
          buttonLabel: null,
          buttonUrl: null,
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
          commentText: null,
          commentId: null,
          clanId: null,
          clanName: null,
          clanCrest: null,
          clanRole: null,
          clanWeek: null,
          alertText: null,
        })
      )
    },
  })
}

// A shared screen for a guest (no account): get_share_preview works without
// signing in and returns only what any player can already see — no sector
// coordinates. null — nothing to show (deleted, blocked, wrong link).
export function useSharePreview(kind: ShareKind | null, key: string | null) {
  return useQuery({
    queryKey: ['share-preview', kind, key],
    enabled: !!kind && !!key,
    staleTime: 60_000,
    queryFn: async (): Promise<unknown> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_share_preview', { p_kind: kind!, p_key: key! })
      if (error) throw error
      return data ?? null
    },
  })
}

// Signed up from someone's link: 100 coins now (only a brand-new account,
// once — see claim_referral), and the one who shared gets theirs after
// this player's first catch.
export type ClaimReferralResult = { ok: true; coins: number; referrerName: string | null } | { ok: false; reason: string }

export function useClaimReferral() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ ref, source }: { ref: string; source: string }): Promise<ClaimReferralResult> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('claim_referral', { p_ref: ref, p_source: source })
      if (error) throw error
      const r = data as { ok: boolean; reason?: string; coins?: number; referrer_name?: string | null }
      return r.ok ? { ok: true, coins: r.coins ?? 0, referrerName: r.referrer_name ?? null } : { ok: false, reason: r.reason ?? 'error' }
    },
    onSuccess: (r) => {
      if (r.ok) queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
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
        clanId: data.clan_id ?? null,
        clanName: data.clan_name ?? null,
        clanCrest: data.clan_crest ?? null,
        clanRole: (data.clan_role as Profile['clanRole']) ?? null,
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
  // false = a prize, not for sale (the slots' jackpot frames); buy_shop_item refuses it.
  purchasable: boolean
}

// The catalog rarely changes (a handful of rows, hand-curated) — cached like
// species/sectors-geometry rather than refetched per screen visit.
export function useShopItems() {
  return useQuery({
    queryKey: ['shop-items'],
    queryFn: async (): Promise<ShopItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('shop_items').select('id, category, name, price, purchasable').order('category').order('sort_order')
      if (error) throw error
      return data.map((r) => ({ id: r.id, category: r.category as ShopItem['category'], name: r.name, price: r.price, purchasable: r.purchasable }))
    },
    staleTime: Infinity,
    gcTime: Infinity,
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

// Static-file sectors with no DB row yet get one created by the RPC, which
// is why lat/lng travel along.
export type ClanModerationAction = 'reset_name' | 'reset_motto' | 'reset_announcement' | 'reset_crest' | 'void_race' | 'disband'

// Super admin only (checked server-side too) — see admin_moderate_clan.
export function useAdminModerateClan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clanId, action }: { clanId: number; action: ClanModerationAction }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_moderate_clan', { p_clan_id: clanId, p_action: action })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateClanMembership(queryClient)
      queryClient.invalidateQueries({ queryKey: ['clan-race'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

// Super admin: extra member slots for a clan on top of its level's capacity.
export function useAdminSetClanExtraSlots() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clanId, extra }: { clanId: number; extra: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_clan_extra_slots', { p_clan_id: clanId, p_extra: extra })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateClanMembership(queryClient)
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

// Super admin fixes a catch that GPS put in the wrong sector — ownership of
// both sectors is recomputed server-side (see admin_move_catch).
export function useAdminMoveCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, territoryId }: { catchId: number; territoryId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_move_catch', { p_catch_id: catchId, p_territory_id: territoryId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

// Super admin: correct a catch's species, length and weight (see
// admin_edit_catch). Coins already paid for it stay as they were; the
// angler's achievements are re-synced server-side. Resolves with what
// changed, in the words the admin journal uses.
export function useAdminEditCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ catchId, species, lengthCm, weightKg }: { catchId: number; species: string; lengthCm: number | null; weightKg: number | null }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_edit_catch', {
        p_catch_id: catchId,
        p_species: species,
        p_length_cm: lengthCm,
        p_weight_kg: weightKg,
      })
      if (error) throw error
      return (data as { changes?: string[] } | null)?.changes ?? []
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] })
      queryClient.invalidateQueries({ queryKey: ['challenge-week-state'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export function useAdminSetTerritoryKind() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ territory, kind }: { territory: Territory; kind: TerritoryKind }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_set_territory_kind', {
        p_territory_id: territory.id,
        p_kind: kind,
        p_lat: territory.lat,
        p_lng: territory.lng,
      })
      if (error) throw error
    },
    // Returned so the mutation stays pending until the map has the new
    // kind — otherwise the picker flashes back to the old one in between.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-challenges'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      return queryClient.invalidateQueries({ queryKey: ['territories'] })
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

// «Первые шаги» (supabase-drafts/first_steps.sql): a newcomer's six steps,
// worked out on the server from what they've actually done, and the one-off
// 100 coins for all six. Null when the server doesn't have it (yet) — then
// the app behaves as before: no checklist, the «Что нового» tours.
export type FirstStepKey = 'catch' | 'treasury' | 'daily' | 'fortify' | 'challenge' | 'clan'
export type FirstSteps = { eligible: boolean; claimed: boolean; reward: number; steps: Record<FirstStepKey, boolean> }

export function useFirstSteps() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['first-steps', user?.id ?? null],
    enabled: !!user,
    // Steps finish on other screens (a challenge, a clan) too — while the
    // checklist is up, look again every minute.
    refetchInterval: (q) => (q.state.data && q.state.data.eligible && !q.state.data.claimed ? 60_000 : false),
    queryFn: async (): Promise<FirstSteps | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_first_steps')
      if (error) return null
      return data as unknown as FirstSteps
    },
    staleTime: 30_000,
  })
}

export function useClaimFirstSteps() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('claim_first_steps')
      if (error) throw error
      return data as unknown as { coins: number; balance: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

// «Написать в поддержку» (supabase-drafts/support.sql, support_chat.sql): the
// player's own requests, newest first, each a chat — the request itself, the
// player's follow-ups and the support's answers, oldest first. `photo` only
// says a screenshot was attached: the bucket is private, the app can't show it.
export type SupportMessage = { from: 'me' | 'support'; body: string; createdAt: string; photo: boolean }
export type SupportTicket = { id: number; createdAt: string; answered: boolean; messages: SupportMessage[] }

// `live` while a chat is open: re-read every 15 s on top of the realtime
// nudge from the «новое сообщение» notification (useRealtimeSync).
export function useMySupport(live = false) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['support', user?.id ?? null],
    enabled: !!user,
    refetchInterval: live ? 15000 : false,
    queryFn: async (): Promise<SupportTicket[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, body, photo_path, created_at, answered_at, support_replies(body, created_at), support_messages(body, photo_path, created_at)')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) return []
      return (data ?? []).map((r) => {
        const replies = (r.support_replies ?? []) as { body: string; created_at: string }[]
        const mine = (r.support_messages ?? []) as { body: string; photo_path: string | null; created_at: string }[]
        const messages: SupportMessage[] = [
          { from: 'me' as const, body: r.body, createdAt: r.created_at, photo: !!r.photo_path },
          ...mine.map((m) => ({ from: 'me' as const, body: m.body, createdAt: m.created_at, photo: !!m.photo_path })),
          ...replies.map((x) => ({ from: 'support' as const, body: x.body, createdAt: x.created_at, photo: false })),
        ].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        return { id: r.id, createdAt: r.created_at, answered: !!r.answered_at, messages }
      })
    },
  })
}

// A follow-up in an existing request: same path as a new one — screenshot to
// the private bucket, the message, then the route that forwards it to the
// admins' Telegram (a reply there answers this same request).
export function useAddSupportMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, body, photo }: { ticketId: number; body: string; photo: Blob | null }) => {
      if (!user) throw new Error('not authenticated')
      const supabase = createClient()
      const photoPath = photo ? await uploadSupportPhoto(user.id, await downscaleToJpeg(photo, 1600)) : null
      const { data, error } = await supabase.rpc('add_support_message', { p_ticket_id: ticketId, p_body: body, p_photo_path: photoPath ?? undefined })
      if (error) throw error
      await fetch('/api/support/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, messageId: data }),
      }).catch(() => {})
      return data as number
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  })
}

// Sends a request: the screenshot (downscaled) to the private bucket, the
// request itself, then a nudge to the server route that forwards it to the
// admins' Telegram.
export function useCreateSupportTicket() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, photo }: { body: string; photo: Blob | null }) => {
      if (!user) throw new Error('not authenticated')
      const supabase = createClient()
      const photoPath = photo ? await uploadSupportPhoto(user.id, await downscaleToJpeg(photo, 1600)) : null
      const { data, error } = await supabase.rpc('create_support_ticket', { p_body: body, p_photo_path: photoPath ?? undefined })
      if (error) throw error
      await fetch('/api/support/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: data }),
      }).catch(() => {})
      return data as number
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
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
      return {
        speciesCoins: data.species_coins,
        captureCoins: data.capture_coins,
        clanSupport: !!data.clan_support,
        // «Защита сектора»: an outsider's catch on a defended sector wears
        // the defense down instead of taking it. Both are absent from a
        // server that predates the release migration — then it's a capture,
        // as before.
        attacked: !!data.attacked,
        defense: typeof data.defense === 'number' ? data.defense : null,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['catches'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      // Every catch adds a free spin in the Shop's slots.
      queryClient.invalidateQueries({ queryKey: ['slot-state'] })
      queryClient.invalidateQueries({ queryKey: ['sector-insights'] })
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

export type SlotSymbol = 'stavrida' | 'skorpena' | 'lufar' | 'katran' | 'hook' | 'hex'
export type SlotPrize = 'jackpot' | 'jackpot_coins' | 'shield' | 'double' | 'lufar' | 'triple' | 'free_spin' | 'pair' | 'none'
// left counts the gift spins too (`bonus` of them) — a super admin's present
// that doesn't burn at midnight and is spent after the day's own spins.
export type SlotState = { total: number; used: number; left: number; bonus: number; nextReset: string; freeShields: number }
export type SlotSpinResult = { reels: SlotSymbol[]; prize: SlotPrize; coins: number; balance: number; left: number; total: number; bonus: number; freeShields: number }

// Free spins (the Shop's «Слоты» tab, which replaced ДЭП): one a day plus
// one per catch, at most 4 — get_slot_state counts them in the player's own
// city day, spin_slots rolls the outcome and pays it.
export function useSlotState() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['slot-state', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<SlotState> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_slot_state')
      if (error) throw error
      const d = data as { total: number; used: number; left: number; bonus?: number; next_reset: string; free_shields: number }
      return { total: d.total, used: d.used, left: d.left, bonus: d.bonus ?? 0, nextReset: d.next_reset, freeShields: d.free_shields }
    },
  })
}

// Like ДЭП before it, this doesn't refresh the coin balance on its own: the
// reels take a few seconds to stop, and a balance that jumps first would give
// the result away. SlotsScreen refreshes it once the last reel lands.
export function useSpinSlots() {
  return useMutation({
    mutationFn: async (): Promise<SlotSpinResult> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('spin_slots')
      if (error) throw error
      const d = data as { reels: SlotSymbol[]; prize: SlotPrize; coins: number; balance: number; left: number; total: number; bonus?: number; free_shields: number }
      return { reels: d.reels, prize: d.prize, coins: d.coins, balance: d.balance, left: d.left, total: d.total, bonus: d.bonus ?? 0, freeShields: d.free_shields }
    },
  })
}

export type AdminSlotSpins = { dailyLeft: number; dailyTotal: number; bonus: number }

// Super admin: a player's spins right now — today's own and the gift ones.
export function useAdminSlotSpins(userId: string | null) {
  return useQuery({
    queryKey: ['admin-slot-spins', userId],
    enabled: !!userId,
    queryFn: async (): Promise<AdminSlotSpins> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_slot_spins', { p_user_id: userId! })
      if (error) throw error
      const d = data as { daily_left: number; daily_total: number; bonus: number }
      return { dailyLeft: d.daily_left, dailyTotal: d.daily_total, bonus: d.bonus }
    },
  })
}

// Super admin: a gift to the chosen players, or everyone (userIds null) —
// coins and/or bonus slot spins and their own few words; each gets
// «Подарок от RANGE» in «Активность» (supabase-drafts/admin_gift.sql).
export function useAdminGift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userIds, coins, spins, note }: { userIds: string[] | null; coins: number; spins: number; note: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_gift', { p_user_ids: userIds, p_coins: coins, p_spins: spins, p_note: note.trim() || undefined })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['slot-state'] })
    },
  })
}

// Super admin: gift spins to anyone, themselves included (negative takes
// them back, never below 0; at most 100 either way per call).
export function useAdminGrantSpins() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_grant_spins', { p_user_id: userId, p_amount: amount })
      if (error) throw error
      return data as number
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-slot-spins', userId] })
      queryClient.invalidateQueries({ queryKey: ['slot-state'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export type DailyRewardState = { claimedToday: boolean; day: number; broken: boolean; amounts: number[]; nextReset: string }

// The 10-day login reward under the Shop's balance. `day` is today's step
// of the run — the one to claim, or the one already claimed today.
export function useDailyRewardState() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['daily-reward', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<DailyRewardState> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_daily_reward_state')
      if (error) throw error
      const d = data as { claimed_today: boolean; day: number; broken: boolean; amounts: number[]; next_reset: string }
      return { claimedToday: d.claimed_today, day: d.day, broken: d.broken, amounts: d.amounts, nextReset: d.next_reset }
    },
  })
}

export function useClaimDailyReward() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (): Promise<{ day: number; coins: number; balance: number }> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('claim_daily_reward')
      if (error) throw error
      return data as { day: number; coins: number; balance: number }
    },
    onSuccess: (res) => {
      queryClient.setQueryData<DailyRewardState>(['daily-reward', user?.id ?? null], (old) =>
        old ? { ...old, claimedToday: true, day: res.day, broken: false } : old
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-reward', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
    },
  })
}

export type TreasuryState = { available: number; collectedToday: number; dailyCap: number; perDay: number; sectors: number }

// Казна: coins the player's sectors have earned since the last collection
// (no further back than a day), at most 30 a day.
export function useTreasury(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['treasury', user?.id ?? null],
    enabled: !!user && enabled,
    queryFn: async (): Promise<TreasuryState> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_treasury')
      if (error) throw error
      const d = data as { available: number; collected_today: number; daily_cap: number; per_day: number; sectors: number }
      return { available: d.available, collectedToday: d.collected_today, dailyCap: d.daily_cap, perDay: d.per_day, sectors: d.sectors }
    },
  })
}

export function useCollectTreasury() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (): Promise<{ coins: number; balance: number }> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('collect_treasury')
      if (error) throw error
      return data as { coins: number; balance: number }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
    },
  })
}

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

export type AppStats = {
  from: string
  daily: { day: string; active: number; signedIn: number; newUsers: number; catches: number }[]
  wau: number
  mau: number
  funnel: { registered: number; onboarded: number; camera: number; firstCatch: number; secondDay: number }
  retention: { cohort: number; d1: number; w1: number }
  screens: { screen: string; views: number; people: number }[]
  onboarding: { step: string; devices: number }[]
}

// Super admin's «Статистика» (get_app_stats checks the role itself).
export function useAppStats(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ['app-stats', days],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AppStats> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_app_stats', { p_days: days, p_tz: 'Asia/Tbilisi' })
      if (error) throw error
      const d = data as {
        from: string
        daily: { day: string; active: number; signed_in: number; new_users: number; catches: number }[]
        wau: number
        mau: number
        funnel: { registered: number; onboarded: number; camera: number; first_catch: number; second_day: number }
        retention: { cohort: number; d1: number; w1: number }
        screens: { screen: string; views: number; people: number }[]
        onboarding: { step: string; devices: number }[]
      }
      return {
        from: d.from,
        daily: d.daily.map((x) => ({ day: x.day, active: x.active, signedIn: x.signed_in, newUsers: x.new_users, catches: x.catches })),
        wau: d.wau,
        mau: d.mau,
        funnel: { registered: d.funnel.registered, onboarded: d.funnel.onboarded, camera: d.funnel.camera, firstCatch: d.funnel.first_catch, secondDay: d.funnel.second_day },
        retention: d.retention,
        screens: d.screens,
        onboarding: d.onboarding,
      }
    },
  })
}

export type DiaryDay = { day: string; note: string | null; territoryId: string | null }
export type DiaryCatch = {
  id: number
  day: string
  caughtAt: string
  species: string
  lengthCm: number | null
  weightKg: number | null
  photoUrl: string
  territoryId: string | null
}

// Дневник рыбака: the owner's notes / fishing days without a catch, and
// gallery catches that live only here. Owner-only by RLS.
export function useDiary(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['diary', user?.id ?? null],
    enabled: enabled && !!user,
    queryFn: async (): Promise<{ days: DiaryDay[]; catches: DiaryCatch[] }> => {
      const supabase = createClient()
      const [days, catches] = await Promise.all([
        supabase.from('diary_days').select('day, note, territory_id').order('day', { ascending: false }),
        supabase.from('diary_catches').select('id, day, caught_at, species, length_cm, weight_kg, photo_url, territory_id').order('caught_at', { ascending: false }),
      ])
      if (days.error) throw days.error
      if (catches.error) throw catches.error
      return {
        days: days.data.map((d) => ({ day: d.day, note: d.note, territoryId: d.territory_id })),
        catches: catches.data.map((c) => ({
          id: c.id,
          day: c.day,
          caughtAt: c.caught_at,
          species: c.species,
          lengthCm: c.length_cm,
          weightKg: c.weight_kg,
          photoUrl: c.photo_url,
          territoryId: c.territory_id,
        })),
      }
    },
  })
}

export function useSaveDiaryDay() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ day, note, territoryId }: { day: string; note: string | null; territoryId?: string | null }) => {
      const supabase = createClient()
      const row: Database['public']['Tables']['diary_days']['Insert'] = { user_id: user!.id, day, note, updated_at: new Date().toISOString() }
      if (territoryId !== undefined) row.territory_id = territoryId
      const { error } = await supabase.from('diary_days').upsert(row, { onConflict: 'user_id,day' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

export function useDeleteDiaryDay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (day: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('diary_days').delete().eq('day', day)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

export function useAddDiaryCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (c: Omit<DiaryCatch, 'id'> & { lat: number | null; lng: number | null }) => {
      const supabase = createClient()
      const { error } = await supabase.from('diary_catches').insert({
        day: c.day,
        caught_at: c.caughtAt,
        species: c.species,
        length_cm: c.lengthCm,
        weight_kg: c.weightKg,
        photo_url: c.photoUrl,
        lat: c.lat,
        lng: c.lng,
        territory_id: c.territoryId,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

export function useDeleteDiaryCatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const supabase = createClient()
      const { error } = await supabase.from('diary_catches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

// The caller's most recent catch — right after confirm_catch, that's the
// one just saved (confirm_catch doesn't hand back its id).
export async function latestOwnCatchId(userId: string): Promise<number | null> {
  const supabase = createClient()
  const { data } = await supabase.from('catches').select('id').eq('user_id', userId).order('caught_at', { ascending: false }).limit(1).maybeSingle()
  return data?.id ?? null
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

export type CatchConditions = {
  airTemp: number | null
  waterTemp: number | null
  wind: number | null
  windDir: number | null
  gusts: number | null
  pressure: number | null
  pressureTrend: number | null
  wave: number | null
  weatherCode: number | null
}

// «Погода во время улова»: the stored row if someone has opened this catch
// before, else the server fetches it from Open-Meteo's archive once and
// stores it (/api/catch-conditions). Weather in the past never changes.
// Null when it can't be had — the catch screen just shows nothing then.
export function useCatchConditions(catchId: number | null) {
  return useQuery({
    queryKey: ['catch-conditions', catchId],
    enabled: !!catchId,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<CatchConditions | null> => {
      const supabase = createClient()
      const { data } = await supabase.from('catch_conditions').select('*').eq('catch_id', catchId!).maybeSingle()
      let row: Database['public']['Tables']['catch_conditions']['Row'] | null = data
      if (!row) {
        const res = await fetch('/api/catch-conditions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catchId }) })
        if (!res.ok) return null
        row = await res.json()
      }
      if (!row) return null
      return {
        airTemp: row.air_temp,
        waterTemp: row.water_temp,
        wind: row.wind,
        windDir: row.wind_dir,
        gusts: row.gusts,
        pressure: row.pressure,
        pressureTrend: row.pressure_trend,
        wave: row.wave,
        weatherCode: row.weather_code,
      }
    },
  })
}

export function useUseFreeShield() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (territoryId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('use_free_shield', { p_territory_id: territoryId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['slot-state', user?.id ?? null] })
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

// ---------- Clans (see DECISIONS.md «Кланы», clans_core migration) ----------

// Anything that changes who's in which clan also changes the map's «Кланы»
// layer (territories_with_stats carries the owner's clan) and every profile
// that shows a clan badge — so membership changes refresh all three.
function invalidateClanMembership(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['clan'] })
  queryClient.invalidateQueries({ queryKey: ['clan-badges'] })
  queryClient.invalidateQueries({ queryKey: ['clans'] })
  queryClient.invalidateQueries({ queryKey: ['profile'] })
  queryClient.invalidateQueries({ queryKey: ['territories'] })
  queryClient.invalidateQueries({ queryKey: ['clan-eligibility'] })
  queryClient.invalidateQueries({ queryKey: ['my-clan-invites'] })
}

export function useClanEligibility(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['clan-eligibility', user?.id ?? null],
    enabled: enabled && !!user,
    queryFn: async (): Promise<ClanEligibility> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_eligibility')
      if (error) throw error
      const r = data as Record<string, unknown>
      return {
        sectors: Number(r.sectors ?? 0),
        sectorsNeeded: Number(r.sectors_needed ?? 3),
        coins: Number(r.coins ?? 0),
        price: Number(r.price ?? 1000),
        inClan: !!r.in_clan,
        cooldownUntil: (r.cooldown_until as string | null) ?? null,
      }
    },
  })
}

export function useClanList(city: CityId, query: string) {
  return useQuery({
    queryKey: ['clans', city, query.trim().toLowerCase()],
    queryFn: async (): Promise<ClanSummary[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('list_clans', { p_city: city, p_query: query.trim() || null })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        motto: r.motto,
        crest: r.crest,
        background: r.background,
        level: r.level,
        trophies: r.trophies,
        members: r.members,
        capacity: r.capacity,
        joinType: r.join_type as ClanSummary['joinType'],
        minSectors: r.min_sectors,
        sectorsHeld: r.sectors_held,
      }))
    },
  })
}

export function useClan(clanId: number | null) {
  return useQuery({
    queryKey: ['clan', clanId],
    enabled: !!clanId,
    queryFn: async (): Promise<ClanDetail | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan', { p_clan_id: clanId! })
      if (error) throw error
      if (!data) return null
      const r = data as Record<string, unknown>
      const members = (r.members as Record<string, unknown>[]) ?? []
      const requests = r.requests as Record<string, unknown>[] | null
      const events = (r.events as Record<string, unknown>[]) ?? []
      return {
        id: Number(r.id),
        city: r.city as ClanDetail['city'],
        name: String(r.name),
        motto: (r.motto as string | null) ?? null,
        announcement: (r.announcement as string | null) ?? null,
        crest: r.crest,
        background: String(r.background),
        joinType: r.join_type as ClanDetail['joinType'],
        minSectors: Number(r.min_sectors),
        xp: Number(r.xp),
        level: Number(r.level),
        capacity: Number(r.capacity),
        extraSlots: r.extra_slots === undefined ? undefined : Number(r.extra_slots),
        trophies: Number(r.trophies),
        createdAt: String(r.created_at),
        renamedAt: (r.renamed_at as string | null) ?? null,
        disbanded: !!r.disbanded,
        myRole: (r.my_role as ClanDetail['myRole']) ?? null,
        myRequestPending: !!r.my_request_pending,
        myInvite: !!r.my_invite,
        raceWins: Number(r.race_wins ?? 0),
        wonLastWeek: !!r.won_last_week,
        sectorsHeld: Number(r.sectors_held ?? 0),
        members: members.map((m) => ({
          userId: String(m.user_id),
          displayName: String(m.display_name ?? 'Рыбак'),
          avatarUrl: (m.avatar_url as string | null) ?? null,
          nameStyle: (m.name_style as string | null) ?? null,
          role: m.role as ClanMember['role'],
          joinedAt: String(m.joined_at),
          weekCatches: Number(m.week_catches ?? 0),
          sectors: Number(m.sectors ?? 0),
        })),
        requests: requests
          ? requests.map((q) => ({
              userId: String(q.user_id),
              displayName: String(q.display_name ?? 'Рыбак'),
              avatarUrl: (q.avatar_url as string | null) ?? null,
              sectors: Number(q.sectors ?? 0),
              createdAt: String(q.created_at),
            }))
          : null,
        events: events.map((e) => ({
          kind: String(e.kind),
          actorName: (e.actor_name as string | null) ?? null,
          targetName: (e.target_name as string | null) ?? null,
          payload: (e.payload as Record<string, unknown> | null) ?? null,
          createdAt: String(e.created_at),
        })),
      }
    },
  })
}

// ---- Clan chat (see DECISIONS.md «Чат клана») ----

const CLAN_CHAT_PAGE = 50

// Pages come newest first (get_clan_chat); the next page asks for messages
// older than the last one of the previous page. The screen flattens and
// reverses them into reading order. A refetch walks the pages again from
// the newest, re-deriving every cursor, so new messages never leave a gap.
export function useClanChat(clanId: number | null) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: ['clan-chat', clanId],
    enabled: !!clanId && !!user,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }): Promise<ClanChatMessage[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_chat', { p_clan_id: clanId!, p_before_id: pageParam, p_limit: CLAN_CHAT_PAGE })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        displayName: r.display_name ?? 'Рыбак',
        avatarUrl: r.avatar_url,
        nameStyle: r.name_style,
        role: (r.role as ClanRoleId | null) ?? null,
        body: r.body,
        createdAt: r.created_at,
        mine: !!user && r.user_id === user.id,
      }))
    },
    getNextPageParam: (last) => (last.length === CLAN_CHAT_PAGE ? last[last.length - 1].id : undefined),
  })
}

export function useClanChatSummary(clanId: number | null) {
  return useQuery({
    queryKey: ['clan-chat-summary', clanId],
    enabled: !!clanId,
    staleTime: 30_000,
    queryFn: async (): Promise<ClanChatSummary | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_chat_summary', { p_clan_id: clanId! })
      if (error) throw error
      if (!data) return null
      const r = data as { unread?: number; last?: { id: number; body: string; created_at: string; author: string; mine: boolean } | null }
      return {
        unread: r.unread ?? 0,
        last: r.last ? { id: r.last.id, body: r.last.body, createdAt: r.last.created_at, author: r.last.author, mine: !!r.last.mine } : null,
      }
    },
  })
}

// post_clan_message never raises for a rejected text — like post_comment,
// the rejection has to commit (it feeds the shared mute), so it comes back
// as a reason code instead (see lib/moderation.ts).
export type PostClanMessageResult = { ok: true } | { ok: false; reason: string; retryAfter: number | null; mutedUntil: string | null }

export function usePostClanMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clanId, body }: { clanId: number; body: string }): Promise<PostClanMessageResult> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('post_clan_message', { p_clan_id: clanId, p_body: body })
      if (error) throw error
      const r = data as { ok: boolean; reason?: string; retry_after?: number; muted_until?: string | null }
      if (r.ok) return { ok: true }
      return { ok: false, reason: r.reason ?? 'error', retryAfter: r.retry_after ?? null, mutedUntil: r.muted_until ?? null }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ['clan-chat', vars.clanId] })
      queryClient.invalidateQueries({ queryKey: ['clan-chat-summary', vars.clanId] })
    },
  })
}

export function useDeleteClanMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId }: { messageId: number; clanId: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('delete_clan_message', { p_message_id: messageId })
      if (error) throw error
    },
    onMutate: ({ messageId, clanId }) => {
      const key = ['clan-chat', clanId]
      const previous = queryClient.getQueryData<InfiniteData<ClanChatMessage[], number | null>>(key)
      if (previous) {
        queryClient.setQueryData<InfiniteData<ClanChatMessage[], number | null>>(key, {
          ...previous,
          pages: previous.pages.map((page) => page.filter((m) => m.id !== messageId)),
        })
      }
      return { previous }
    },
    onError: (_error, { clanId }, context) => {
      if (context?.previous) queryClient.setQueryData(['clan-chat', clanId], context.previous)
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ['clan-chat', vars.clanId] })
      queryClient.invalidateQueries({ queryKey: ['clan-chat-summary', vars.clanId] })
    },
  })
}

// Opening the chat (and every new message while it's open) reads it up to
// now; the card's badge drops to zero without waiting for a refetch.
export function useMarkClanChatRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clanId: number) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('mark_clan_chat_read', { p_clan_id: clanId })
      if (error) throw error
    },
    onMutate: (clanId) => {
      queryClient.setQueryData<ClanChatSummary | null>(['clan-chat-summary', clanId], (s) => (s ? { ...s, unread: 0 } : s))
    },
  })
}

// One channel per clan the player is in, for the app's whole session: a new
// message refreshes the open chat and the unread badges on the clan and
// profile cards. Row-level security keeps it to that clan's members.
// Deletions can't be filtered by clan (their payload carries only the id),
// so any deletion refreshes — they're rare.
export function useClanChatLive(clanId: number | null) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!clanId) return
    const supabase = createClient()
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['clan-chat', clanId] })
      queryClient.invalidateQueries({ queryKey: ['clan-chat-summary', clanId] })
    }
    const channel = supabase
      .channel(`clan-chat:${clanId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clan_messages', filter: `clan_id=eq.${clanId}` }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clan_messages' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [clanId, queryClient])
}

export function useMyClanInvites(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-clan-invites', user?.id ?? null],
    enabled: enabled && !!user,
    queryFn: async (): Promise<ClanInvite[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_my_clan_invites')
      if (error) throw error
      return (data ?? []).map((r) => ({ clanId: r.clan_id, name: r.name, crest: r.crest, invitedByName: r.invited_by_name, createdAt: r.created_at }))
    },
  })
}

// Live name check while typing in the clan constructor — same rules the
// server applies again inside create_clan/update_clan.
export function useClanNameCheck(name: string, enabled: boolean) {
  const trimmed = name.trim()
  return useQuery({
    queryKey: ['clan-name-check', trimmed.toLowerCase()],
    enabled: enabled && trimmed.length >= 3,
    staleTime: 30_000,
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('check_clan_name', { p_name: trimmed })
      if (error) throw error
      return data ?? null
    },
  })
}

export type ClanSettingsInput = {
  name: string
  motto: string
  crest: { shape: string; symbol: string; primary: string; secondary: string }
  background: string
  joinType: 'open' | 'request' | 'invite'
  minSectors: number
}

export function useCreateClan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClanSettingsInput): Promise<number> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('create_clan', {
        p_name: input.name.trim(),
        p_motto: input.motto.trim() || null,
        p_crest: input.crest,
        p_background: input.background,
        p_join_type: input.joinType,
        p_min_sectors: input.minSectors,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateClanMembership(queryClient),
  })
}

export function useUpdateClan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClanSettingsInput & { announcement: string; rename: boolean; clanId: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('update_clan', {
        p_name: input.rename ? input.name.trim() : null,
        p_motto: input.motto.trim() || null,
        p_announcement: input.announcement.trim() || null,
        p_crest: input.crest,
        p_background: input.background,
        p_join_type: input.joinType,
        p_min_sectors: input.minSectors,
        p_clan_id: input.clanId,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateClanMembership(queryClient),
  })
}

function useClanAction<TVars>(run: (supabase: ReturnType<typeof createClient>, vars: TVars) => PromiseLike<{ error: unknown; data?: unknown }>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { error, data } = await run(createClient(), vars)
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateClanMembership(queryClient),
  })
}

// The code from an invite link (see get_clan_invite_code) counts as an
// invitation. Sent only when there is one, so a plain join keeps the call
// every published version makes.
export const useJoinClan = () =>
  useClanAction<{ clanId: number; inviteCode?: string | null }>((s, v) =>
    v.inviteCode ? s.rpc('join_clan', { p_clan_id: v.clanId, p_invite_code: v.inviteCode }) : s.rpc('join_clan', { p_clan_id: v.clanId }),
  )
// The clan's invite-link code — only leaders, co-leaders and elders get one
// (null for anyone else). Fetched ahead of the share tap: a clipboard write
// has to happen right in the tap, with no request in between.
export function useClanInviteCode(clanId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['clan-invite-code', clanId],
    enabled: enabled && clanId !== null,
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_invite_code', { p_clan_id: clanId! })
      if (error) throw error
      return data ?? null
    },
  })
}
export const useCancelClanJoinRequest = () => useClanAction<number>((s, clanId) => s.rpc('cancel_clan_join_request', { p_clan_id: clanId }))
// A player can be in one clan per city, so every action names its clan —
// otherwise, while in Moscow, a Batumi clan's request could land in the
// Moscow one (see _clan_membership).
export const useLeaveClan = () => useClanAction<number>((s, clanId) => s.rpc('leave_clan', { p_clan_id: clanId }))
export const useKickClanMember = () =>
  useClanAction<{ userId: string; clanId: number }>((s, v) => s.rpc('kick_clan_member', { p_user_id: v.userId, p_clan_id: v.clanId }))
export const useSetClanMemberRole = () =>
  useClanAction<{ userId: string; role: string; clanId: number }>((s, v) =>
    s.rpc('set_clan_member_role', { p_user_id: v.userId, p_role: v.role, p_clan_id: v.clanId })
  )
export const useRespondClanJoinRequest = () =>
  useClanAction<{ userId: string; accept: boolean; clanId: number }>((s, v) =>
    s.rpc('respond_clan_join_request', { p_user_id: v.userId, p_accept: v.accept, p_clan_id: v.clanId })
  )
export const useInviteToClan = () =>
  useClanAction<{ userId: string; clanId: number }>((s, v) => s.rpc('invite_to_clan', { p_user_id: v.userId, p_clan_id: v.clanId }))
export const useDeclineClanInvite = () => useClanAction<number>((s, clanId) => s.rpc('decline_clan_invite', { p_clan_id: clanId }))

// Who's in which clan in a city — for the crest next to names in the weekly
// rating. One small request, only while the rating is on screen.
export function useClanBadges(city: CityId, enabled: boolean) {
  return useQuery({
    queryKey: ['clan-badges', city],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, { clanId: number; name: string; crest: unknown }>> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_badges', { p_city: city })
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.user_id, { clanId: r.clan_id, name: r.clan_name, crest: r.crest }]))
    },
  })
}

export function useClanChest(clanId: number | null) {
  return useQuery({
    queryKey: ['clan-chest', clanId],
    enabled: !!clanId,
    queryFn: async (): Promise<ClanChest | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_chest', { p_clan_id: clanId! })
      if (error) throw error
      if (!data) return null
      const r = data as Record<string, unknown>
      const contributors = (r.contributors as Record<string, unknown>[]) ?? []
      const last = r.last_week as Record<string, unknown> | null
      return {
        weekStart: String(r.week_start),
        weekEnd: String(r.week_end),
        points: Number(r.points ?? 0),
        tier: Number(r.tier ?? 0),
        thresholds: (r.thresholds as number[]) ?? [],
        rewards: (r.rewards as number[]) ?? [20, 45, 80, 120, 170],
        contributors: contributors.map((c) => ({
          userId: String(c.user_id),
          displayName: String(c.display_name ?? 'Рыбак'),
          avatarUrl: (c.avatar_url as string | null) ?? null,
          points: Number(c.points ?? 0),
        })),
        lastWeek: last ? { tier: Number(last.tier ?? 0), points: Number(last.points ?? 0) } : null,
      }
    },
  })
}

// The whole city's regatta in one call. Only fetched where it's shown (the
// clan screen's tab, the regatta screen, the map pill for clan members), so
// nobody outside a clan pays for it at launch.
export function useClanRace(city: CityId, enabled: boolean) {
  return useQuery({
    queryKey: ['clan-race', city],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ClanRace> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_race', { p_city: city })
      if (error) throw error
      const r = (data ?? {}) as Record<string, unknown>
      const clans = (r.clans as Record<string, unknown>[]) ?? []
      const last = (r.last_week as Record<string, unknown>[]) ?? []
      return {
        weekStart: String(r.week_start),
        weekEnd: String(r.week_end),
        myClanId: (r.my_clan_id as number | null) ?? null,
        myToday: Number(r.my_today ?? 0),
        dailyCap: Number(r.daily_cap ?? 150),
        myRowers: ((r.my_rowers as Record<string, unknown>[]) ?? []).map((w) => ({
          userId: String(w.user_id),
          displayName: String(w.display_name ?? 'Рыбак'),
          avatarUrl: (w.avatar_url as string | null) ?? null,
          meters: Number(w.meters ?? 0),
        })),
        clans: clans.map((c) => ({
          id: Number(c.id),
          name: String(c.name),
          crest: c.crest,
          meters: Number(c.meters ?? 0),
          finish: Number(c.finish ?? 600),
          finishedAt: (c.finished_at as string | null) ?? null,
          members: Number(c.members ?? 0),
          rank: Number(c.rank ?? 0),
        })),
        lastWeek: last.map((c) => ({
          id: Number(c.id),
          name: String(c.name),
          crest: c.crest,
          place: Number(c.place),
          finished: !!c.finished,
          meters: Number(c.meters ?? 0),
          finish: Number(c.finish ?? 0),
        })),
      }
    },
  })
}

// Tells the super admins something is broken for real players: the server
// logs it and system_health_tick turns it into a system_alert (in-app +
// Telegram, at most hourly per problem). Network drops are recorded but never
// alert. Fire-and-forget — reporting must never get in the way of the flow
// that just failed.
export function reportClientError(context: string, error: unknown) {
  const e = (error ?? {}) as { code?: unknown; message?: unknown }
  const message = [e.code, e.message ?? String(error)].filter(Boolean).join(': ')
  void createClient()
    .rpc('report_client_error', { p_context: context, p_message: message.slice(0, 500) })
    .then(
      () => {},
      () => {}
    )
}
