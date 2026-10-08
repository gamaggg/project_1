'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { installGlobalErrorReporting } from '@/lib/errorReporting'
import { reportClientError } from '@/lib/supabase/queries'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Sectors, catches and notifications are refreshed the moment they
            // change (useRealtimeSync in lib/supabase/queries.ts), so returning
            // to the app only needs to refetch what's been sitting for a while.
            // At 15s every hop back from a Telegram chat refetched ~15 queries,
            // the bulk of the project's API requests and log ingest.
            staleTime: 2 * 60_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  )
  // Any uncaught error in the app's own code reaches the super admins' alert
  // (lib/errorReporting.ts) — once per session per message.
  useEffect(() => installGlobalErrorReporting((context, message) => reportClientError(context, { message })), [])
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
