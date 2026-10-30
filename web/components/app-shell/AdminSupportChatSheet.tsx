'use client'

import { useState } from 'react'
import { SupportChatSheet } from '@/components/app-shell/SupportChatSheet'
import { useAdminSendSupportMessage, useAdminSupportChat } from '@/lib/supabase/queries'

// «Написать в поддержку» from the support side (admin-support-30-10): the
// super admin, or an admin with the «Писать игрокам в поддержку» switch,
// writes to a player from their profile. Opens the player's latest request
// (the player's on the left, the support's on the right) or, when there is
// none or «Новое обращение» is tapped, the first message starts a new one.
// The player sees it in their own support chat and gets the usual
// notification. Admin-only, so the words are Russian like the rest of the
// admin screens.
export function AdminSupportChatSheet({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { data: tickets = [], isPending } = useAdminSupportChat(userId)
  const send = useAdminSendSupportMessage()
  const [fresh, setFresh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ticket = fresh ? null : tickets[0] ?? null

  const lines = (ticket?.messages ?? []).map((m) => ({
    mine: m.from === 'support',
    label: m.from === 'support' ? m.author : name,
    body: m.body,
    createdAt: m.createdAt,
    photoPath: m.photoPath,
  }))

  return (
    <SupportChatSheet
      kicker={`Поддержка · ${name}`}
      title={ticket ? `Обращение #${ticket.id}` : 'Новое обращение'}
      status={ticket ? { answered: ticket.answered } : null}
      headExtra={
        ticket && (
          <button type="button" className="support-chat-new tap-scale" onClick={() => setFresh(true)}>
            Новое
          </button>
        )
      }
      empty={!isPending && <p className="support-chat-empty">Игрок увидит сообщение в «Вопросах и ответах» → «Мои обращения», получит уведомление и сможет ответить.</p>}
      notice={error}
      lines={lines}
      onSend={async (body, photo) => {
        setError(null)
        await send.mutateAsync({ userId, ticketId: ticket?.id ?? null, body, photo })
        setFresh(false)
      }}
      onSendError={(e) => {
        const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
        setError(msg.includes('not authorized') ? 'Нет права писать игрокам' : 'Не получилось отправить, попробуй ещё раз')
      }}
      onClose={onClose}
    />
  )
}
