import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'
import { TERRITORY_COLUMNS, type TerritoryViewRow } from '@/lib/data/territoryMerge'

// The database side of the map's sectors (see territoryMerge.ts): the rows that say something about a
// sector of one city, plus the ids of its deleted sectors. A plain function of a Supabase client, so the
// app (useTerritories) and the check against the old load (scripts/verify-sector-load.mjs) ask the same.

const PAGE_SIZE = 1000

// PostgREST caps a single response at 1000 rows by default and stays silent about it (no error,
// just a truncated array) — a table crossed that count once admin-added sectors piled up, which is
// how a whole batch of newly created territories could exist in the database yet never reach the
// map. Page through with .range() so a list can keep growing past 1000 without this recurring.
// Pages need a fixed order (the callers order by id): without one, two separate requests may come
// back in different orders and overlap.
async function fetchAllPages<T>(fetchPage: (from: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchPage(from)
    if (page.error) throw page.error
    const data = page.data ?? []
    out.push(...data)
    if (data.length < PAGE_SIZE) return out
  }
}

// `touched`: the or() list of touchedRowsFilter. `userId`: the signed-in player, whose own sectors
// come in whatever city they are. Deleted sectors come as bare {id, is_deleted: true}: a sector
// deleted after the city's file was built is still in it, and the flag is what hides it.
export async function fetchTerritoryRows(supabase: SupabaseClient<Database>, args: { prefix: string; userId: string | undefined; touched: string }): Promise<TerritoryViewRow[]> {
  const { prefix, userId, touched } = args
  const fetchRows = (from: number) => {
    const query = supabase.from('territories_with_stats').select(TERRITORY_COLUMNS).order('id').range(from, from + PAGE_SIZE - 1)
    // In a PostgREST or() the LIKE wildcard is *, not %.
    return userId ? query.or(`and(id.like.${prefix}*,or(${touched})),owner_id.eq.${userId}`) : query.like('id', `${prefix}%`).or(touched)
  }
  const fetchDeleted = (from: number) =>
    supabase.from('territories_with_stats').select('id').eq('is_deleted', true).like('id', `${prefix}%`).order('id').range(from, from + PAGE_SIZE - 1)
  const [rows, deleted] = await Promise.all([fetchAllPages(fetchRows), fetchAllPages(fetchDeleted)])
  // The full row wins over the bare «deleted» marker for the same id.
  return [...deleted.map((d) => ({ id: d.id, is_deleted: true }) as TerritoryViewRow), ...rows]
}
