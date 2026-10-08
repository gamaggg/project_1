import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types'
import { reportingFetch } from '@/lib/errorReporting'

// Module-level singleton: a fresh client per call would each open its own
// GoTrueClient. They'd all read/write the same cookies, but `onAuthStateChange`
// only fires on the instance that performed the sign-in/out — a separate
// instance (e.g. AuthProvider's) never hears about it without a full reload.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      // A request that fails for a reason that isn't the player's is reported
      // for the super admins' alert (lib/errorReporting.ts).
      global: {
        fetch: reportingFetch((context, message) => {
          void client?.rpc('report_client_error', { p_context: context, p_message: message.slice(0, 500) }).then(
            () => {},
            () => {}
          )
        }),
      },
    })
  }
  return client
}
