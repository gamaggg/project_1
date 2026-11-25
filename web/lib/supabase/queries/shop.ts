'use client'

import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import { localShopName, localBuff, localTxLabel } from '@/lib/data/dbText'

export type ShopItem = {
  id: string
  category: 'hero_bg' | 'avatar_frame' | 'name_style' | 'territory_skin'
  name: string
  price: number
  // false = a prize, not for sale (the slots' jackpot frames); buy_shop_item refuses it.
  purchasable: boolean
}

// The catalog rarely changes (a handful of rows, hand-curated) — cached like
// species/sectors-geometry rather than refetched per screen visit.
export function useShopItems() {
  return useQuery({
    queryKey: ['shop-items'],
    queryFn: async (): Promise<ShopItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('shop_items').select('id, category, name, price, purchasable').order('category').order('sort_order')
      if (error) throw error
      return data.map((r) => ({ id: r.id, category: r.category as ShopItem['category'], name: localShopName(r.id, r.name), price: r.price, purchasable: r.purchasable }))
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Which item ids the signed-in user owns — a flat id set is all the Shop
// screen and the equip buttons need (RLS already scopes this to the caller).
export function useMyInventory() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-inventory', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('user_inventory').select('item_id')
      if (error) throw error
      return new Set(data.map((r) => r.item_id))
    },
  })
}

export function useBuyShopItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('buy_shop_item', { p_item_id: itemId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inventory', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}

// ─── Новинки и секретный бокс (24.11.2026, supabase-drafts/economy-24-11/03, 04) ───
// The functions are typed loosely: the generated types do not know them until the migrations are applied, and before
// that every call here answers «nothing new / no box» instead of failing.
type LooseRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
const looseRpc = () => {
  const supabase = createClient()
  return supabase.rpc.bind(supabase) as unknown as LooseRpc
}

// What is NEW in the Shop for this player: shop_new_items() also marks «first seen» for anything new, so the badge
// burns for 3 days (08, 25.11.2026; was 7) from this player's first visit after the update. Called once when the app opens (FishZoneApp), the
// Shop reads the same cached answer.
export function useShopNew() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shop-new', user?.id ?? null],
    enabled: !!user,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await looseRpc()('shop_new_items')
      if (error || !Array.isArray(data)) return new Set()
      return new Set(data as string[])
    },
  })
}
export function useIsShopNew(id: string): boolean {
  const { data } = useShopNew()
  return !!data?.has(id)
}

// Секретный бокс (24.11.2026): opens any number of times for the price; null — no box for this player (not released yet,
// or not in the database). free — free openings won on the slots (three chests, 25.11.2026); they go first.
export type SecretBoxState = { price: number; free: number }
export type SecretBoxResult = { itemId: string | null; tier: number; duplicate: boolean; refund: number; coins: number; free: boolean }
export function useSecretBox() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['secret-box', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<SecretBoxState | null> => {
      const { data, error } = await looseRpc()('get_secret_box_state')
      if (error || !data) return null
      const d = data as { price: number; free?: number }
      return { price: d.price, free: d.free ?? 0 }
    },
  })
}
export function useOpenSecretBox() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (): Promise<SecretBoxResult> => {
      const { data, error } = await looseRpc()('open_secret_box')
      if (error) throw error
      const d = data as { item_id: string | null; tier: number; duplicate: boolean; refund: number; coins?: number; free?: boolean }
      return { itemId: d.item_id, tier: d.tier, duplicate: !!d.duplicate, refund: d.refund ?? 0, coins: d.coins ?? 0, free: !!d.free }
    },
    // The balance and the inventory refresh at once (the coins chip on the screen counts down while the strip runs).
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inventory', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['my-coin-transactions', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['secret-box', user?.id ?? null] })
    },
  })
}

// itemId null unequips the current avatar frame — see equip_shop_item.
export function useEquipShopItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ itemId, category }: { itemId: string | null; category?: 'avatar_frame' | 'name_style' | 'territory_skin' }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('equip_shop_item', { p_item_id: itemId, p_category: category ?? 'avatar_frame' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['territories'] })
    },
  })
}

// Positive amount grants, negative deducts (clamped to 0 server-side —
// never goes below). Visible only to the caller here because coins itself
// is self-only masked in profiles_with_stats, except for a super admin
// viewing someone else — see that view's own coins CASE.
export function useAdminGrantCoins() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_grant_coins', { p_user_id: userId, p_amount: amount })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export type AdminInventoryEntry = {
  kind: 'item' | 'buff'
  itemId: string
  activeBuffId: number | null
  label: string
  price: number
  expiresAt: string | null
}

// Super-admin-only view of another player's purchases (owned shop_items +
// still-active, unconsumed buffs) — powers the "Вернуть" refund UI on
// UserProfileScreen. Not used for the viewer's own inventory (that's
// useMyInventory, a plain id set for cheap owned-item lookups).
export function useAdminUserInventory(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-inventory', userId],
    enabled: !!userId,
    queryFn: async (): Promise<AdminInventoryEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_get_user_inventory', { p_user_id: userId! })
      if (error) throw error
      return (data ?? []).map((r) => ({
        kind: r.kind as 'item' | 'buff',
        itemId: r.item_id,
        activeBuffId: r.active_buff_id,
        label: r.label,
        price: r.price,
        expiresAt: r.expires_at,
      }))
    },
  })
}

export function useAdminRefundItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, itemId }: { userId: string; itemId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_refund_shop_item', { p_user_id: userId, p_item_id: itemId })
      if (error) throw error
    },
    // Refunding is now specifically a super-admin self-service tool (see
    // ProfileScreen.tsx's own "Инвентарь" section) — userId is always the
    // caller's own id in practice, so my-inventory needs invalidating too
    // for the Shop grid to drop the refunded item immediately.
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-inventory', userId] })
      queryClient.invalidateQueries({ queryKey: ['my-inventory', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export function useAdminRefundBuff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, activeBuffId }: { userId: string; activeBuffId: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_refund_buff', { p_user_id: userId, p_active_buff_id: activeBuffId })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-inventory', userId] })
      queryClient.invalidateQueries({ queryKey: ['my-active-buffs', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export type Buff = {
  id: string
  name: string
  description: string
  price: number
  durationHours: number | null
}

// Catalog is a handful of hand-curated rows — cached like shop_items/species
// rather than refetched per screen visit.
export function useBuffs() {
  return useQuery({
    queryKey: ['buffs'],
    queryFn: async (): Promise<Buff[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('buffs').select('id, name, description, price, duration_hours').order('sort_order')
      if (error) throw error
      return data.map((r) => ({ id: r.id, ...localBuff(r.id, r.name, r.description), price: r.price, durationHours: r.duration_hours }))
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export type ActiveBuff = {
  id: number
  buffId: string
  activatedAt: string
  expiresAt: string
  consumed: boolean
}

// Everything the caller has bought that hasn't expired — the duration buff
// (double_coins) shows a countdown, armed-but-unconsumed ones (tide/echo)
// show "ready, waiting for your next catch".
export function useMyActiveBuffs() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-active-buffs', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<ActiveBuff[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('active_buffs')
        .select('id, buff_id, activated_at, expires_at, consumed')
        .gt('expires_at', new Date().toISOString())
        .order('activated_at', { ascending: false })
      if (error) throw error
      return data.map((r) => ({ id: r.id, buffId: r.buff_id, activatedAt: r.activated_at, expiresAt: r.expires_at, consumed: r.consumed }))
    },
  })
}

export type CoinTransaction = {
  id: number
  amount: number
  reason: string
  label: string
  createdAt: string
}

// Every coin-mutating RPC (buy_shop_item, activate_buff, swap_challenge,
// buy_extra_challenge, sync_my_challenges' payouts,
// admin_grant_coins, admin_refund_*) logs one row here — see the
// coin_transactions_ledger migration. RLS scopes this to the caller's own
// rows, so no p_user_id param is needed. Refetches on every mount rather
// than being wired into every mutation's onSuccess (nine call sites across
// four screens) — the history is opened on demand, not shown live, so a
// fresh fetch each time it opens is simpler and just as correct.
// A hundred at a time, «Показать ещё» for older ones — each page starts
// right after the oldest row already shown (not at an offset), so coins that
// land while the history is open don't push a row onto the next page twice.
// The cursor is time and id together: a catch's reward and its capture are
// written in the same instant, and a time-only cursor dropped one of them
// when they fell on a page's edge.
const COIN_HISTORY_PAGE = 100
export function useMyCoinTransactions() {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: ['my-coin-transactions', user?.id ?? null],
    enabled: !!user,
    initialPageParam: null as { at: string; id: number } | null,
    queryFn: async ({ pageParam }): Promise<CoinTransaction[]> => {
      const supabase = createClient()
      let q = supabase
        .from('coin_transactions')
        .select('id, amount, reason, label, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(COIN_HISTORY_PAGE)
      if (pageParam) q = q.or(`created_at.lt.${pageParam.at},and(created_at.eq.${pageParam.at},id.lt.${pageParam.id})`)
      const { data, error } = await q
      if (error) throw error
      return data.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, label: localTxLabel(r.reason, r.label), createdAt: r.created_at }))
    },
    getNextPageParam: (last) => {
      if (last.length < COIN_HISTORY_PAGE) return undefined
      const oldest = last[last.length - 1]
      return { at: oldest.createdAt, id: oldest.id }
    },
  })
}

// Super-admin-only view of another player's coin history (GrantCoinsModal's
// "История" section) — same shape as useMyCoinTransactions but goes through
// admin_get_user_coin_transactions since coin_transactions' RLS only exposes
// the caller's own rows (see that policy).
export function useAdminUserCoinTransactions(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-coin-transactions', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CoinTransaction[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_get_user_coin_transactions', { p_user_id: userId! })
      if (error) throw error
      return data.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, label: localTxLabel(r.reason, r.label), createdAt: r.created_at }))
    },
  })
}

// tide/echo/double_coins — bought and switched on in one go. Shields aren't
// sold at all: they only drop in the slots (see useUseFreeShield).
export function useActivateBuff() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (buffId: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('activate_buff', { p_buff_id: buffId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-active-buffs', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}
