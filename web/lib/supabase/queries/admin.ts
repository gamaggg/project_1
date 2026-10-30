'use client'

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { AdminPermissions, AdminAction, AdminListEntry } from '@/lib/data/types'
import { useIsSuperAdmin } from '@/lib/supabase/queries/profile'

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
        canReviewPanoramas: row?.can_review_panoramas ?? false,
        canViewStats: row?.can_view_stats ?? false,
        canViewLimits: row?.can_view_limits ?? false,
        canMessagePlayers: row?.can_message_players ?? false,
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
      canReviewPanoramas: boolean
      canViewStats: boolean
      canViewLimits: boolean
      canMessagePlayers: boolean
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
        p_can_review_panoramas: args.canReviewPanoramas,
        p_can_view_stats: args.canViewStats,
        p_can_view_limits: args.canViewLimits,
        p_can_message_players: args.canMessagePlayers,
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
