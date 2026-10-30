'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { uploadSupportPhoto } from '@/lib/supabase/storage'
import { downscaleToJpeg } from '@/lib/exif'

// «Написать в поддержку» (supabase-drafts/support.sql, support_chat.sql): the
// player's own requests, newest first, each a chat — the request itself, the
// player's follow-ups and the support's answers, oldest first. A request a
// support admin started (admin-support-30-10: started_by) opens with the
// support's message. `photoPath` is in the private bucket: shown through a
// signed link (useSupportPhotoUrl).
export type SupportMessage = { from: 'me' | 'support'; body: string; createdAt: string; photoPath: string | null }
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
        .select('id, body, photo_path, created_at, answered_at, started_by, support_replies(body, photo_path, created_at), support_messages(body, photo_path, created_at)')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) return []
      return (data ?? []).map((r) => {
        const replies = (r.support_replies ?? []) as { body: string; photo_path: string | null; created_at: string }[]
        const mine = (r.support_messages ?? []) as { body: string; photo_path: string | null; created_at: string }[]
        const messages: SupportMessage[] = [
          { from: r.started_by ? ('support' as const) : ('me' as const), body: r.body, createdAt: r.created_at, photoPath: r.photo_path },
          ...mine.map((m) => ({ from: 'me' as const, body: m.body, createdAt: m.created_at, photoPath: m.photo_path })),
          ...replies.map((x) => ({ from: 'support' as const, body: x.body, createdAt: x.created_at, photoPath: x.photo_path })),
        ].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        return { id: r.id, createdAt: r.created_at, answered: !!r.answered_at, messages }
      })
    },
  })
}

// A signed link to one support photo (the bucket is private; the storage rule
// lets a player read their own and the photos in their own chats, and a
// support admin read all). null until it comes, or when it can't be read.
export function useSupportPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['support-photo', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await createClient().storage.from('support').createSignedUrl(path!, 3600)
      return data?.signedUrl ?? null
    },
  })
}

// The support side of one player's chat (admin_get_support_chat): the super
// admin or an admin with can_message_players. `from` is who wrote it, `author`
// the admin's name on the support's messages.
export type AdminSupportMessage = { from: 'player' | 'support'; body: string; createdAt: string; photoPath: string | null; author: string | null }
export type AdminSupportTicket = { id: number; createdAt: string; answered: boolean; messages: AdminSupportMessage[] }

export function useAdminSupportChat(userId: string | null) {
  return useQuery({
    queryKey: ['admin-support', userId],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async (): Promise<AdminSupportTicket[]> => {
      const { data, error } = await createClient().rpc('admin_get_support_chat', { p_user_id: userId! })
      if (error) throw error
      type Row = { id: number; created_at: string; answered: boolean; messages: { from: 'player' | 'support'; body: string; photo_path: string | null; created_at: string; author?: string | null }[] }
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        answered: r.answered,
        messages: r.messages
          .map((m) => ({ from: m.from, body: m.body, createdAt: m.created_at, photoPath: m.photo_path, author: m.author ?? null }))
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      }))
    },
  })
}

// A support admin writes to a player (admin_send_support_message): without
// ticketId it starts a new request, with it adds to that one. The photo goes
// to the admin's own folder of the same private bucket. The player gets the
// usual «ответ поддержки» notification (and in Telegram, if linked).
export function useAdminSendSupportMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, ticketId, body, photo }: { userId: string; ticketId: number | null; body: string; photo: Blob | null }) => {
      if (!user) throw new Error('not authenticated')
      const supabase = createClient()
      const photoPath = photo ? await uploadSupportPhoto(user.id, await downscaleToJpeg(photo, 1600)) : null
      const { data, error } = await supabase.rpc('admin_send_support_message', {
        p_user_id: userId,
        p_body: body,
        p_ticket_id: ticketId ?? undefined,
        p_photo_path: photoPath ?? undefined,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-support', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
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
