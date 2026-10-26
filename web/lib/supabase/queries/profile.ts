'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Profile } from '@/lib/data/types'
import { type CityId } from '@/lib/data/city'
import { tn } from '@/lib/i18n/runtime'

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async (): Promise<Profile> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('profiles_with_stats').select('*').eq('id', userId!).single()
      if (error) throw error
      return {
        id: data.id!,
        displayName: data.display_name ?? tn('common.angler'),
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
        canReviewPanoramas: data.can_review_panoramas ?? null,
        canViewStats: data.can_view_stats ?? null,
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

// Thin wrapper over the viewer's own (already-cached) profile query — no
// extra request, just reads the is_admin flag off it. See DECISIONS.md for
// why admin status lives on profiles instead of a client-side email check.
export function useIsAdmin() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  return profile?.isAdmin ?? false
}

export function useIsSuperAdmin() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  return profile?.isSuperAdmin ?? false
}

// Gates one of the 4 delegable admin actions on the *viewer's own* account —
// a super admin always passes (they're not limited by the granular flags),
// a plain admin needs is_admin plus the specific permission column.
function useAdminFlag(flag: 'canModerateReports' | 'canBlockUsers' | 'canAddCatchManually' | 'canViewAllUsers' | 'canAddCatchFromGallery' | 'canReviewPanoramas' | 'canViewStats') {
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
// «Где это?» panoramas: review them and plan the days (admin_geo_* RPCs).
export function useCanReviewPanoramas() {
  return useAdminFlag('canReviewPanoramas')
}
// «Статистика»: the super admin, or an admin given the switch (get_app_stats_range checks the same).
export function useCanViewStats() {
  return useAdminFlag('canViewStats')
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
    onSuccess: (_, patch) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      // «Где это?» is the profile city's game: another city, another panorama
      // (or, if today's already answered, still that one — the server knows).
      if (patch.city !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['geo-today'] })
        queryClient.invalidateQueries({ queryKey: ['geo-board'] })
      }
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
