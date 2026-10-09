'use client'

import { SlotSymbol } from '@/components/app-shell/SlotSymbol'
import { useSlotState } from '@/lib/supabase/queries'
import { useT } from '@/lib/i18n'
import { hapticTap } from '@/lib/telegram/haptics'
import type { CityId } from '@/lib/data/city'

// Same cap as SlotsScreen's DAILY_SPINS_MAX (_slot_day_state on the server).
const DAILY_SPINS_MAX = 4

// The slots, right under the Shop's balance: they used to be the last of the
// category tabs, off the edge of the row where nobody scrolled to. Three
// little reels with what they can give (the jackpot fish, the hook of «×2»,
// the shield's hex), how many spins are left, and «Крутить» — a tap opens
// the slots on their own screen.
export function SlotsCard({ city, onOpen }: { city: CityId; onOpen: () => void }) {
  const t = useT()
  const { data: state } = useSlotState()
  const left = state?.left ?? 0
  const total = state?.total ?? 1
  const sub = !state
    ? t('slots.card.prizes')
    : left > 0
      ? t('slots.spinsToday', { left })
      : total < DAILY_SPINS_MAX
        ? t('slots.card.catchForSpin')
        : t('slots.card.tomorrow')

  return (
    <button
      type="button"
      data-tour="slots-card"
      className={`slots-card tap-scale${state && left === 0 ? ' empty' : ''}`}
      aria-label={`${t('slots.title')}: ${sub}`}
      onClick={() => {
        hapticTap()
        onOpen()
      }}
    >
      <span className="slots-card-shine" aria-hidden />
      <span className="slots-card-reels" aria-hidden>
        {(['katran', 'hook', 'hex'] as const).map((s) => (
          <span key={s} className="slots-card-reel">
            <SlotSymbol symbol={s} city={city} size={22} />
          </span>
        ))}
        {left > 0 && <span className="slots-card-count">{left}</span>}
      </span>
      <span className="slots-card-text">
        <span className="slots-card-title">{t('slots.title')}</span>
        <span className="slots-card-sub">{sub}</span>
      </span>
      <span className="slots-card-go" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  )
}
