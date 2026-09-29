import type { createAdminClient } from '@/lib/supabase/admin'

// Server-only helpers for the accounts the Telegram Mini App creates on its
// own (see app/api/auth/telegram). They have no real mailbox: the address is
// synthetic and only ever used to mint a sign-in token.

type Admin = ReturnType<typeof createAdminClient>

export const TELEGRAM_EMAIL_DOMAIN = '@telegram.catchrange.com'

export function telegramEmail(telegramId: number) {
  return `tg_${telegramId}${TELEGRAM_EMAIL_DOMAIN}`
}

// An account the Mini App made by itself that was never actually played —
// no catches, no clan. Its Telegram link can safely move to the account the
// same person really uses (they've proven both: the Telegram through signed
// initData or /start, the account through its own session or link token).
export async function isEmptyTelegramAccount(admin: Admin, userId: string): Promise<boolean> {
  const { data: auth } = await admin.auth.admin.getUserById(userId)
  if (!auth.user?.email?.endsWith(TELEGRAM_EMAIL_DOMAIN)) return false
  const [{ count: catches }, { data: profile }] = await Promise.all([
    admin.from('catches').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('profiles_with_stats').select('clan_id').eq('id', userId).maybeSingle(),
  ])
  return catches === 0 && !profile?.clan_id
}
