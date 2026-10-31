'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { ActivityEntry } from '@/lib/data/types'
import type { SpeciesCategory } from '@/lib/data/species'
import { type CityId } from '@/lib/data/city'
import type { ShareKind } from '@/lib/guestShare'
import { localSpeciesName } from '@/lib/data/species'
import { tn } from '@/lib/i18n/runtime'

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
const GAME_EVENT_KINDS = new Set(['hot_sector_week', 'hot_sector_won', 'legend_gained', 'legend_lost', 'bite_forecast', 'sector_forecast', 'daily_reward_reminder', 'sector_attacked', 'support_reply', 'admin_gift', 'geo_bonus', 'catch_edited', 'catch_species_changed'])

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
                                        row.kind === 'clan_war_started' ||
                                        row.kind === 'clan_war_reminder' ||
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
            who: actor?.display_name ?? tn('common.angler'),
            userId: row.actor_id ?? '',
            avatarUrl: actor?.avatar_url ?? null,
            // The one kind that's about a sector of yours rather than about
            // someone else's activity — what the "Мои территории" filter now
            // selects on.
            mine: row.kind === 'sector_lost',
            kind,
            territoryId: row.territory_id ?? undefined,
            territoryKind: territory?.kind ?? undefined,
            speciesName: speciesInfo?.name ? localSpeciesName(speciesInfo.name) : null,
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
          who: r.display_name ?? tn('common.angler'),
          userId: r.user_id,
          avatarUrl: r.avatar_url,
          mine: false,
          kind: 'catch',
          unread: false,
          fromCity: true,
          claimed: r.claimed,
          territoryId: r.territory_id,
          territoryKind: r.territory_kind ?? undefined,
          speciesName: r.species_name ? localSpeciesName(r.species_name) : r.species_name,
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
