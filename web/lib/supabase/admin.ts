import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// SERVICE ROLE client — bypasses RLS entirely. Server-only: this file must
// never be imported from a 'use client' component or the key would end up
// in the browser bundle. Used for the Telegram auth bridge (admin.createUser
// / generateLink), which needs to provision auth users without a session.
export function createAdminClient() {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
