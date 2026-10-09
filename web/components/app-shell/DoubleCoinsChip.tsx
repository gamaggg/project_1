'use client'

import { useMyActiveBuffs } from '@/lib/supabase/queries'
import { useNow } from '@/lib/useNow'
import { hapticTap } from '@/lib/telegram/haptics'

// When «Двойные монеты» ends, or null if it isn't on (bought in the shop or
// won as «3 крючка» in the slots).
export function useDoubleCoinsUntil(): number | null {
  const { data: buffs = [] } = useMyActiveBuffs()
  const now = useNow(60_000)
  const until = buffs
    .filter((b) => b.buffId === 'double_coins')
    .map((b) => new Date(b.expiresAt).getTime())
    .filter((t) => t > now)
  return until.length ? Math.max(...until) : null
}

function left(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60_000))
  return min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч`
}

// «×2» in the map's top panel while double coins are on — players won it in
// the slots and couldn't tell it was working. A tap says what it doubles.
export function DoubleCoinsChip({ onToast }: { onToast: (msg: string) => void }) {
  const until = useDoubleCoinsUntil()
  const now = useNow(60_000)
  if (!until) return null
  const rest = left(until - now)
  return (
    <button
      type="button"
      className="double-coins-chip tap-scale"
      aria-label={`Двойные монеты, ещё ${rest}`}
      onClick={() => {
        hapticTap()
        onToast(`Двойные монеты ещё ${rest}: за уловы, захваты, челленджи и награды — вдвое больше`)
      }}
    >
      <b>×2</b>
      <span>{rest}</span>
    </button>
  )
}
