'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

// Purchases for Telegram Stars (25.11.2026, supabase-drafts/economy-24-11/11; the server side is lib/telegram/stars.ts).
// Loosely typed like the box: the generated types don't know these functions until the migration is applied, and
// before that the showcase is simply empty.
// kind 'kit' (25.11.2026): a background + frame + name style of one family sold together (glKits.ts) — `owned` when all
// three are the player's, `ownedAny` when at least one is (then the kit can't be bought, the rest goes one by one).
export type StarsProduct = { id: string; kind: 'coins' | 'keys' | 'item' | 'kit'; amount: number; itemId: string | null; stars: number; owned: boolean; ownedAny: boolean }

type LooseRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

export function useStarsProducts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['stars-products', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<StarsProduct[]> => {
      const supabase = createClient()
      const { data, error } = await (supabase.rpc.bind(supabase) as unknown as LooseRpc)('get_stars_products')
      if (error || !Array.isArray(data)) return []
      return (data as { id: string; kind: StarsProduct['kind']; amount: number; item_id: string | null; stars: number; owned: boolean; owned_any?: boolean }[]).map((p) => ({
        id: p.id,
        kind: p.kind,
        amount: p.amount,
        itemId: p.item_id,
        stars: p.stars,
        owned: p.owned,
        ownedAny: p.owned_any ?? p.owned,
      }))
    },
  })
}

// Inside Telegram only: Stars are paid on Telegram's own sheet (WebApp.openInvoice).
export function canPayWithStars(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData && !!window.Telegram.WebApp.openInvoice
}

export type StarsBuyResult = 'paid' | 'cancelled' | 'failed' | 'pending'

// Asks the server for an invoice, opens it, and once it is paid refreshes what the purchase changed. The bot gives the
// purchase when Telegram reports the payment (a moment later), so the refresh is repeated a few times.
export function useBuyForStars() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    // `preset`: the live background's preset the player picked before buying (stored with the order, so it is theirs
    // from the first moment).
    mutationFn: async ({ productId, preset, onOpened }: { productId: string; preset?: string | null; onOpened?: () => void }): Promise<StarsBuyResult> => {
      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productId, preset: preset ?? null }),
      })
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !body.url) throw new Error(body.error ?? 'STARS:failed')
      const open = window.Telegram?.WebApp?.openInvoice
      if (!open) throw new Error('STARS:no_telegram')
      return new Promise<StarsBuyResult>((resolve) => {
        open(body.url!, (status) => resolve(status as StarsBuyResult))
        // Telegram gives no signal when its sheet has come up: a moment after asking, the waiting screen can go.
        window.setTimeout(() => onOpened?.(), 700)
      })
    },
    onSuccess: (status) => {
      if (status !== 'paid' && status !== 'pending') return
      const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
        queryClient.invalidateQueries({ queryKey: ['my-inventory', user?.id ?? null] })
        queryClient.invalidateQueries({ queryKey: ['secret-box', user?.id ?? null] })
        queryClient.invalidateQueries({ queryKey: ['stars-products', user?.id ?? null] })
        queryClient.invalidateQueries({ queryKey: ['my-gl-presets', user?.id ?? null] })
        queryClient.invalidateQueries({ queryKey: ['my-coin-transactions', user?.id ?? null] })
      }
      refresh()
      window.setTimeout(refresh, 2000)
      window.setTimeout(refresh, 6000)
    },
  })
}
