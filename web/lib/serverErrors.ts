import { createAdminClient } from '@/lib/supabase/admin'

// A server route that throws or answers 5xx is written to client_errors as
// «api:<route>» (no player — user_id stays empty), so system_health_tick
// raises the same plain-language alert for it as for a player's error
// (lib/errorReporting.ts covers the app side).
export function withErrorReport<A extends unknown[]>(route: string, handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      const res = await handler(...args)
      if (res.status >= 500) await record(route, `HTTP ${res.status}: ${await res.clone().text().catch(() => '')}`)
      return res
    } catch (err) {
      await record(route, err instanceof Error ? `${err.name}: ${err.message}` : String(err))
      throw err
    }
  }
}

// client_errors isn't in the generated lib/types.ts (it predates the table),
// hence the narrow cast.
type ErrorsTable = { from: (table: 'client_errors') => { insert: (row: { context: string; message: string; network: boolean }) => PromiseLike<unknown> } }

async function record(route: string, message: string) {
  try {
    const db = createAdminClient() as unknown as ErrorsTable
    await db.from('client_errors').insert({ context: `api:${route}`.slice(0, 40), message: message.slice(0, 500), network: false })
  } catch {}
}
