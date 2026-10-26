'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { CatchComment } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'

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
        displayName: r.display_name ?? tn('common.angler'),
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
        displayName: r.display_name ?? tn('common.angler'),
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
