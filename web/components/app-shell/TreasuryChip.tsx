'use client'

import { useState } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useDailyRewardState, useTreasury } from '@/lib/supabase/queries'
import { RewardsModal } from '@/components/app-shell/RewardsModal'
import { useI18n } from '@/lib/i18n'
import { hapticTap } from '@/lib/telegram/haptics'

// Казна and the daily login reward in the map's top panel, collected in one
// place: the chip by the logo opens a sheet with both, each with its own
// «Забрать». Small on purpose — it shares the bar with the logo and the
// layer switch. A sector holder sees what the Казна has ready («12/30»);
// anyone else sees it only while today's reward is waiting («+35»). A dot
// on a holder's chip means the daily reward is waiting too.
export function TreasuryChip({ enabled, onToast }: { enabled: boolean; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { data } = useTreasury(enabled)
  const { data: daily } = useDailyRewardState()
  const [open, setOpen] = useState(false)

  const holds = enabled && !!data && data.sectors > 0
  const dailyReady = !!daily && !daily.claimedToday
  const sheet = open && <RewardsModal treasury={holds ? data : null} onClose={() => setOpen(false)} onToast={onToast} />
  // Nothing to show on the bar — but a sheet opened from it stays up (the
  // reward just taken there is what made the chip go).
  if (!holds && !dailyReady) return <>{sheet}</>
  const ready = (holds && data.available > 0) || dailyReady
  const capReached = holds && data.collectedToday >= data.dailyCap

  return (
    <>
      <button
        type="button"
        data-tour="treasury"
        className={`treasury-chip tap-scale${ready ? ' ready' : ''}${capReached && !dailyReady ? ' done' : ''}`}
        onClick={() => {
          hapticTap()
          setOpen(true)
        }}
        aria-label={
          holds ? `${t('treasury.title')}: ${t('treasury.amount', { available: data.available, cap: data.dailyCap })}` : t('daily.title')
        }
      >
        <CoinIcon size={16} />
        {holds ? (
          <>
            <span className="treasury-chip-num">{data.available}</span>
            <span className="treasury-chip-cap">/{data.dailyCap}</span>
          </>
        ) : (
          <span className="treasury-chip-num">+{daily!.amounts[daily!.day - 1]}</span>
        )}
        {holds && dailyReady && <span className="treasury-chip-dot" aria-hidden />}
      </button>
      {sheet}
    </>
  )
}
