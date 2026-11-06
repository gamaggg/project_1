import type { RealClan } from '@/lib/clan2/demoStore'
import { RARE_COINS, weekStartOf } from '@/lib/clan2/rules'
import type { ClanDetail } from '@/lib/data/types'
import { createClient } from '@/lib/supabase/client'
import { CITIES } from '@/lib/data/city'

// What the clan's real catches say, read-only: this week's tallies for the weekly task, the records for the hall of
// fame (the biggest fish of every species among the members' catches, ever), and who fished lately.
// Two reads of `catches` for the clan's members and one of the species table; nothing is written.

type Row = { user_id: string; species: string; length_cm: number | null; weight_kg: number | null; caught_at: string; territory_id: string; photo_url?: string | null }

export async function fetchRealClan(clan: ClanDetail, now: number): Promise<RealClan | null> {
  const ids = clan.members.map((m) => m.userId)
  if (ids.length === 0) return null
  const supabase = createClient()
  const since = new Date(weekStartOf(now)).toISOString()
  const [recent, top, species] = await Promise.all([
    supabase.from('catches').select('user_id,species,length_cm,weight_kg,caught_at,territory_id').in('user_id', ids).gte('caught_at', since).limit(2000),
    // The hall of fame counts only the clan's own city: catches on sectors of that city (sector ids start with its letter).
    supabase.from('catches').select('user_id,species,length_cm,weight_kg,caught_at,territory_id,photo_url').in('user_id', ids).like('territory_id', `${CITIES[clan.city].idPrefix}%`).not('length_cm', 'is', null).order('length_cm', { ascending: false }).limit(600),
    supabase.from('species').select('key,coin_value'),
  ])
  if (recent.error || top.error) return null
  // The generated types do not list the species table's coin_value, though the column is there (confirm_catch reads it).
  const speciesRows = (species.data ?? []) as unknown as { key: string; coin_value: number | null }[]
  const coins = new Map<string, number>(speciesRows.map((s) => [s.key, s.coin_value ?? 0]))
  const week = (recent.data ?? []) as Row[]
  const name = new Map(clan.members.map((m) => [m.userId, m.displayName]))
  const seenSpecies = new Set<string>()
  const seenMembers = new Set<string>()
  const seenDays = new Set<string>()
  const seenSectors = new Set<string>()
  let rare = 0
  let maxCm = 0
  let lengthCm = 0
  const last = new Map<string, number>()
  for (const c of week) {
    seenSpecies.add(c.species)
    seenMembers.add(c.user_id)
    seenDays.add(new Date(c.caught_at).toDateString())
    seenSectors.add(c.territory_id)
    if ((coins.get(c.species) ?? 0) >= RARE_COINS) rare++
    maxCm = Math.max(maxCm, c.length_cm ?? 0)
    lengthCm += c.length_cm ?? 0
    const t = new Date(c.caught_at).getTime()
    if (t > (last.get(c.user_id) ?? 0)) last.set(c.user_id, t)
  }
  const lastCatchMin: Record<string, number | null> = {}
  for (const id of ids) {
    const t = last.get(id)
    // No catch this week: «давно» is enough for the screens; the exact day is not read.
    lastCatchMin[id] = t ? Math.max(0, Math.round((now - t) / 60_000)) : 8 * 24 * 60
  }
  const best = new Map<string, RealClan['hall'][number]>()
  for (const c of (top.data ?? []) as Row[]) {
    if (!c.length_cm || best.has(c.species)) continue
    const kg = c.weight_kg ?? Math.round(Math.pow(c.length_cm / 20, 3) * 0.12 * 10) / 10
    best.set(c.species, { species: c.species, member: name.get(c.user_id) ?? '', userId: c.user_id, cm: c.length_cm, kg, at: new Date(c.caught_at).getTime(), photo: c.photo_url ?? null })
  }
  return {
    catches: week.length,
    species: seenSpecies.size,
    rare,
    maxCm,
    lengthM: Math.round(lengthCm / 10) / 10,
    members: seenMembers.size,
    days: seenDays.size,
    sectors: seenSectors.size,
    lastCatchMin,
    hall: [...best.values()],
  }
}
