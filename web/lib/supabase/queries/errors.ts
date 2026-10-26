'use client'

import { createClient } from '@/lib/supabase/client'
import { reportsEnabled } from '@/lib/errorReporting'

// Tells the super admins something is broken for real players: the server
// logs it and system_health_tick turns it into a system_alert (in-app +
// Telegram, at most hourly per problem). Network drops are recorded but never
// alert. Fire-and-forget — reporting must never get in the way of the flow
// that just failed.
export function reportClientError(context: string, error: unknown) {
  if (!reportsEnabled) return
  const e = (error ?? {}) as { code?: unknown; message?: unknown }
  const message = [e.code, e.message ?? String(error)].filter(Boolean).join(': ')
  void createClient()
    .rpc('report_client_error', { p_context: context, p_message: message.slice(0, 500) })
    .then(
      () => {},
      () => {}
    )
}
