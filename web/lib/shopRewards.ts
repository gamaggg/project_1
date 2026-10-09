'use client'

import { useSlotState } from '@/lib/supabase/queries'

// What's waiting in the Shop: the slot spins left. Lights the number on the
// profile tab, the profile's Shop card and the slots card. (Today's login
// reward isn't here: it's collected with the Казна, from the coin chip on
// the map — TreasuryChip.)
export function useShopRewardsCount(): { total: number } {
  const { data: slots } = useSlotState()
  return { total: slots?.left ?? 0 }
}
