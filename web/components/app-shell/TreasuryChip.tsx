'use client'

import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useCollectTreasury, useTreasury } from '@/lib/supabase/queries'
import { useT } from '@/lib/i18n'
import { hapticSuccess, hapticTap } from '@/lib/telegram/haptics'

// Казна in the map's top panel: what the player's sectors have earned,
// collected with one tap. Small on purpose — it shares the bar with the logo
// and the layer switch, so the panel keeps its height. Only for someone who
// holds at least one sector (the map already knows, so no request otherwise).
// What happened is said in the app's own toast: the map panel clips
// anything hanging below it.
export function TreasuryChip({ enabled, onToast }: { enabled: boolean; onToast: (msg: string) => void }) {
  const t = useT()
  const { data } = useTreasury(enabled)
  const collect = useCollectTreasury()

  if (!enabled || !data || data.sectors === 0) return null
  const ready = data.available > 0
  const capReached = data.collectedToday >= data.dailyCap

  function onTap() {
    if (!data) return
    if (!ready) {
      hapticTap()
      onToast(capReached ? t('treasury.capReached', { cap: data.dailyCap }) : t('treasury.empty'))
      return
    }
    collect.mutate(undefined, {
      onSuccess: (res) => {
        hapticSuccess()
        onToast(t('treasury.collected', { coins: res.coins }))
      },
    })
  }

  return (
    <button
      type="button"
      className={`treasury-chip tap-scale${ready ? ' ready' : ''}`}
      disabled={collect.isPending}
      onClick={onTap}
      aria-label={`${t('treasury.title')}: ${t('treasury.amount', { available: data.available, cap: data.dailyCap })}${ready ? ` — ${t('treasury.collect')}` : ''}`}
    >
      <CoinIcon size={16} />
      <span className="treasury-chip-num">{data.available}</span>
      <span className="treasury-chip-cap">/{data.dailyCap}</span>
    </button>
  )
}
