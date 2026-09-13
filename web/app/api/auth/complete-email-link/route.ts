import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Called right after LinkEmailFlow's OtpCodeStep confirms the new email
// (proving the visitor actually controls it). That alone isn't enough to
// finish the change: this project has Supabase's "secure email change"
// (double opt-in) on, which also waits for a confirmation from the
// *current* email — but for a Telegram-linked account that's the synthetic
// tg_<id>@telegram.catchrange.com placeholder, which nobody can ever open
// to confirm. Left alone the change sits pending forever (verified live —
// email_change_confirm_status stuck at 1, email_change_token_current never
// consumed). Since ownership of the new address is already proven by the
// OTP step that gates this call, finishing the swap with the admin API is
// equivalent to what double opt-in would have produced anyway — just
// without a confirmation the synthetic side could never give.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email?.endsWith('@telegram.catchrange.com')) {
    return NextResponse.json({ error: 'not authorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: adminUser, error: getError } = await admin.auth.admin.getUserById(user.id)
  const newEmail = (adminUser?.user as { new_email?: string } | undefined)?.new_email
  if (getError || !newEmail) {
    return NextResponse.json({ error: 'no pending email change' }, { status: 400 })
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { email: newEmail, email_confirm: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
