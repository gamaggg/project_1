'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { uploadSupportPhoto } from '@/lib/supabase/storage'
import { downscaleToJpeg } from '@/lib/exif'

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
