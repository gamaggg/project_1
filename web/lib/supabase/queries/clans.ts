'use client'

import { useEffect } from 'react'
import { useQueryClient, useMutation, useQuery, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { ClanEligibility, ClanSummary, ClanDetail, ClanMember, ClanChatMessage, ClanRoleId, ClanChatSummary, ClanInvite, ClanChest, ClanRace, ClanWarCandidate } from '@/lib/data/types'
import { type CityId } from '@/lib/data/city'
import { tn } from '@/lib/i18n/runtime'

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
          displayName: String(m.display_name ?? tn('common.angler')),
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
              displayName: String(q.display_name ?? tn('common.angler')),
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
        displayName: r.display_name ?? tn('common.angler'),
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
          displayName: String(c.display_name ?? tn('common.angler')),
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
          displayName: String(w.display_name ?? tn('common.angler')),
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
        // A server from before the sign-up weeks has none of these: the old race for everyone.
        warMode: !!r.war_mode,
        myRole: (r.my_role as string | null) ?? null,
        myClanActive: Number(r.my_clan_active ?? 0),
        myWar: toMyWar(r.my_war),
        canStart: !!r.can_start,
      }
    },
  })
}

function toMyWar(raw: unknown): ClanRace['myWar'] {
  if (!raw || typeof raw !== 'object') return null
  const w = raw as Record<string, unknown>
  const roster = ((w.roster as Record<string, unknown>[]) ?? []).map((m) => ({
    userId: String(m.user_id),
    displayName: String(m.display_name ?? tn('common.angler')),
    avatarUrl: (m.avatar_url as string | null) ?? null,
  }))
  return { startedAt: String(w.started_at), size: Number(w.size ?? roster.length), meIn: !!w.me_in, roster }
}

// The leader's roster screen: the clan's members with last week's activity.
export function useClanWarCandidates(clanId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['clan-war-candidates', clanId],
    enabled: enabled && !!clanId,
    staleTime: 30_000,
    queryFn: async (): Promise<ClanWarCandidate[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_clan_war_candidates', { p_clan_id: clanId! })
      if (error) throw error
      return ((data as Record<string, unknown>[] | null) ?? []).map((m) => ({
        userId: String(m.user_id),
        displayName: String(m.display_name ?? tn('common.angler')),
        avatarUrl: (m.avatar_url as string | null) ?? null,
        role: String(m.role ?? 'member'),
        catches: Number(m.catches ?? 0),
        meters: Number(m.meters ?? 0),
        lastCatchAt: (m.last_catch_at as string | null) ?? null,
        inRoster: !!m.in_roster,
      }))
    },
  })
}

// Adds players to a roster that is already started (never removes): their metres
// count from now and the finish grows by 200 m each.
export function useAddClanWarPlayers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clanId, userIds }: { clanId: number; userIds: string[] }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('add_clan_war_players', { p_clan_id: clanId, p_user_ids: userIds })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clan-race'] })
      queryClient.invalidateQueries({ queryKey: ['clan-war-candidates'] })
      queryClient.invalidateQueries({ queryKey: ['clan'] })
    },
  })
}

// Opens the clan's war for the week with this roster (3 or more of its members);
// the roster cannot be changed afterwards.
export function useStartClanWar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clanId, userIds }: { clanId: number; userIds: string[] }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('start_clan_war', { p_clan_id: clanId, p_user_ids: userIds })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clan-race'] })
      queryClient.invalidateQueries({ queryKey: ['clan-war-candidates'] })
      queryClient.invalidateQueries({ queryKey: ['clan'] })
    },
  })
}
