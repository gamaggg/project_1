import type { SocialPost } from '@/lib/socialBot'
import type { createAdminClient } from '@/lib/supabase/admin'

// Live numbers in post texts. A text may hold placeholders in curly braces; the tick fills them from the database
// an hour before the post goes out (when the preview is made), so the text the owner approves is the text that is published.
//   {catches_total} all catches · {catches_7d} catches in the last 7 days · {players} all players
//   {new_players_7d} new players in the last 7 days · {clans} clans · {to_2000} how many catches are left to 2000
// Plan: docs/10 Продукт/Продвижение в соцсетях.md

type Admin = ReturnType<typeof createAdminClient>

const NAMES = ['catches_total', 'catches_7d', 'players', 'new_players_7d', 'clans', 'to_2000'] as const
const RE = new RegExp(`\\{(${NAMES.join('|')})\\}`, 'g')

export function hasLivePlaceholders(text: string): boolean {
  RE.lastIndex = 0
  return RE.test(text)
}

// 1821 -> «1 821» (a thin non-breaking space keeps the number in one piece)
const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/\s/g, ' ')

export async function liveValues(admin: Admin): Promise<Record<string, string>> {
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
  const [catchesTotal, catches7d, players, newPlayers7d, clans] = await Promise.all([
    count(admin.from('catches').select('id', { count: 'exact', head: true })),
    count(admin.from('catches').select('id', { count: 'exact', head: true }).gte('caught_at', week)),
    count(admin.from('profiles').select('id', { count: 'exact', head: true })),
    count(admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', week)),
    // the clans table is not in the generated types (lib/types.ts), so it is read through a plain client
    count((admin as unknown as { from: (t: string) => { select: (c: string, o: object) => PromiseLike<{ count: number | null }> } }).from('clans').select('id', { count: 'exact', head: true })),
  ])
  return {
    catches_total: fmt(catchesTotal),
    catches_7d: fmt(catches7d),
    players: fmt(players),
    new_players_7d: fmt(newPlayers7d),
    clans: fmt(clans),
    to_2000: fmt(Math.max(0, 2000 - catchesTotal)),
  }
}

function fill(text: string, values: Record<string, string>): string {
  return text.replace(RE, (_, name: string) => values[name] ?? '')
}

// Fills the placeholders of a post (body and every text), saves the result and returns the filled post.
export async function fillLive(admin: Admin, p: SocialPost): Promise<SocialPost> {
  const texts = [p.body, ...Object.entries(p.captions).filter(([k]) => !k.startsWith('_')).map(([, v]) => v)]
  if (!texts.some((t) => typeof t === 'string' && hasLivePlaceholders(t))) return p
  const values = await liveValues(admin)
  const captions = Object.fromEntries(Object.entries(p.captions).map(([k, v]) => [k, k.startsWith('_') || typeof v !== 'string' ? v : fill(v, values)]))
  const next = { ...p, body: fill(p.body, values), captions }
  await admin.from('social_posts').update({ body: next.body, captions, updated_at: new Date().toISOString() }).eq('id', p.id)
  return next
}
