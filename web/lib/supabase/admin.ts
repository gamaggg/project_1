import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// SERVICE ROLE client — bypasses RLS entirely. Server-only: this file must
// never be imported from a 'use client' component or the key would end up
// in the browser bundle. Used for the Telegram auth bridge (admin.createUser
// / generateLink), which needs to provision auth users without a session.
export function createAdminClient() {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: retryClockSkew },
  })
}

// The secret key (sb_secret_…) is turned into a short-lived token by
// Supabase's own gateway, stamped with its clock; now and then the database
// API's clock is a moment behind and refuses it as «JWT issued at future»
// (seen 08.10 on the Telegram cron routes, a few times a day). It's gone a
// second later, so such a refusal is retried once before it counts as a
// failure. Only that refusal — every other answer passes straight through.
async function retryClockSkew(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status !== 401) return res
  const text = await res.clone().text().catch(() => '')
  if (!/issued at future/i.test(text)) return res
  await new Promise((r) => setTimeout(r, 1500))
  return fetch(input, init)
}
