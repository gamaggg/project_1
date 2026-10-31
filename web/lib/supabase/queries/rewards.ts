'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

// «Первые шаги» (supabase-drafts/first_steps.sql): a newcomer's six steps,
// worked out on the server from what they've actually done, and the one-off
// 100 coins for all six. Null when the server doesn't have it (yet) — then
// the app behaves as before: no checklist, the «Что нового» tours.
export type FirstStepKey = 'catch' | 'treasury' | 'daily' | 'fortify' | 'challenge' | 'clan'
// newbie_until: «Задание новичка» (supabase-drafts/newbie-forecast-30-10) — until when the first
// catch pays triple and brings a shield; null once it's caught or the 7 days are over.
export type FirstSteps = { eligible: boolean; claimed: boolean; reward: number; newbie_until?: string | null; steps: Record<FirstStepKey, boolean> }

export function useFirstSteps() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['first-steps', user?.id ?? null],
    enabled: !!user,
    // Steps finish on other screens (a challenge, a clan) too — while the
    // checklist is up, look again every minute.
    refetchInterval: (q) => (q.state.data && q.state.data.eligible && !q.state.data.claimed ? 60_000 : false),
    queryFn: async (): Promise<FirstSteps | null> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_first_steps')
      if (error) return null
      return data as unknown as FirstSteps
    },
    staleTime: 30_000,
  })
}

export function useClaimFirstSteps() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('claim_first_steps')
      if (error) throw error
      return data as unknown as { coins: number; balance: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export type SlotSymbol = 'stavrida' | 'skorpena' | 'lufar' | 'katran' | 'hook' | 'hex'
export type SlotPrize = 'jackpot' | 'jackpot_coins' | 'shield' | 'double' | 'lufar' | 'triple' | 'free_spin' | 'pair' | 'none'
// left counts the gift spins too (`bonus` of them) — a super admin's present
// that doesn't burn at midnight and is spent after the day's own spins.
export type SlotState = { total: number; used: number; left: number; bonus: number; nextReset: string; freeShields: number }
export type SlotSpinResult = { reels: SlotSymbol[]; prize: SlotPrize; coins: number; balance: number; left: number; total: number; bonus: number; freeShields: number }

// Free spins (the Shop's slots card, once its «Слоты» tab, which replaced ДЭП): one a day plus
// one per catch, at most 4 — get_slot_state counts them in the player's own
// city day, spin_slots rolls the outcome and pays it.
export function useSlotState() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['slot-state', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<SlotState> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_slot_state')
      if (error) throw error
      const d = data as { total: number; used: number; left: number; bonus?: number; next_reset: string; free_shields: number }
      return { total: d.total, used: d.used, left: d.left, bonus: d.bonus ?? 0, nextReset: d.next_reset, freeShields: d.free_shields }
    },
  })
}

// Like ДЭП before it, this doesn't refresh the coin balance on its own: the
// reels take a few seconds to stop, and a balance that jumps first would give
// the result away. SlotsScreen refreshes it once the last reel lands.
export function useSpinSlots() {
  return useMutation({
    mutationFn: async (): Promise<SlotSpinResult> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('spin_slots')
      if (error) throw error
      const d = data as { reels: SlotSymbol[]; prize: SlotPrize; coins: number; balance: number; left: number; total: number; bonus?: number; free_shields: number }
      return { reels: d.reels, prize: d.prize, coins: d.coins, balance: d.balance, left: d.left, total: d.total, bonus: d.bonus ?? 0, freeShields: d.free_shields }
    },
  })
}

export type AdminSlotSpins = { dailyLeft: number; dailyTotal: number; bonus: number }

// Super admin: a player's spins right now — today's own and the gift ones.
export function useAdminSlotSpins(userId: string | null) {
  return useQuery({
    queryKey: ['admin-slot-spins', userId],
    enabled: !!userId,
    queryFn: async (): Promise<AdminSlotSpins> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_slot_spins', { p_user_id: userId! })
      if (error) throw error
      const d = data as { daily_left: number; daily_total: number; bonus: number }
      return { dailyLeft: d.daily_left, dailyTotal: d.daily_total, bonus: d.bonus }
    },
  })
}

// Super admin: a gift to the chosen players, or everyone (userIds null) —
// coins and/or bonus slot spins and their own few words; each gets
// «Подарок от RANGE» in «Активность» (supabase-drafts/admin_gift.sql).
export function useAdminGift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userIds, coins, spins, note }: { userIds: string[] | null; coins: number; spins: number; note: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_gift', { p_user_ids: userIds, p_coins: coins, p_spins: spins, p_note: note.trim() || undefined })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['slot-state'] })
    },
  })
}

// Super admin: gift spins to anyone, themselves included (negative takes
// them back, never below 0; at most 100 either way per call).
export function useAdminGrantSpins() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_grant_spins', { p_user_id: userId, p_amount: amount })
      if (error) throw error
      return data as number
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-slot-spins', userId] })
      queryClient.invalidateQueries({ queryKey: ['slot-state'] })
      queryClient.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}

export type DailyRewardState = { claimedToday: boolean; day: number; broken: boolean; amounts: number[]; nextReset: string }

// The 10-day login reward under the Shop's balance. `day` is today's step
// of the run — the one to claim, or the one already claimed today.
export function useDailyRewardState() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['daily-reward', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<DailyRewardState> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_daily_reward_state')
      if (error) throw error
      const d = data as { claimed_today: boolean; day: number; broken: boolean; amounts: number[]; next_reset: string }
      return { claimedToday: d.claimed_today, day: d.day, broken: d.broken, amounts: d.amounts, nextReset: d.next_reset }
    },
  })
}

export function useClaimDailyReward() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (): Promise<{ day: number; coins: number; balance: number }> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('claim_daily_reward')
      if (error) throw error
      return data as { day: number; coins: number; balance: number }
    },
    onSuccess: (res) => {
      queryClient.setQueryData<DailyRewardState>(['daily-reward', user?.id ?? null], (old) =>
        old ? { ...old, claimedToday: true, day: res.day, broken: false } : old
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-reward', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
    },
  })
}

export type TreasuryState = { available: number; collectedToday: number; dailyCap: number; perDay: number; sectors: number }

// Казна: coins the player's sectors have earned since the last collection
// (no further back than a day), at most 30 a day.
export function useTreasury(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['treasury', user?.id ?? null],
    enabled: !!user && enabled,
    queryFn: async (): Promise<TreasuryState> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_treasury')
      if (error) throw error
      const d = data as { available: number; collected_today: number; daily_cap: number; per_day: number; sectors: number }
      return { available: d.available, collectedToday: d.collected_today, dailyCap: d.daily_cap, perDay: d.per_day, sectors: d.sectors }
    },
  })
}

export function useCollectTreasury() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (): Promise<{ coins: number; balance: number }> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('collect_treasury')
      if (error) throw error
      return data as { coins: number; balance: number }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', user?.id ?? null] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['first-steps'] })
    },
  })
}
