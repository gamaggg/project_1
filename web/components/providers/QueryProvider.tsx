'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
