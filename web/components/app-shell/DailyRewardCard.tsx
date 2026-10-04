'use client'

import { useEffect, useState } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useClaimDailyReward, useDailyRewardState } from '@/lib/supabase/queries'
import { useT } from '@/lib/i18n'
import { hapticSuccess } from '@/lib/telegram/haptics'

// The 10-day login reward, right under the Shop's balance. Until today's
// reward is taken it's the full run of ten days with a claim button; after
// that it folds into one line saying what tomorrow brings.
export function DailyRewardCard() {
  const t = useT()
  const { data: state } = useDailyRewardState()
  const claim = useClaimDailyReward()
  // The day just claimed here, so its cell turns into a tick with a small
  // pop before the card folds — the server state alone would fold it at once.
  const [justClaimed, setJustClaimed] = useState<number | null>(null)

  // Fold to the one-line "claimed" state a moment after the pop, so the
  // Shop's sticky header shrinks back.
  useEffect(() => {
    if (justClaimed === null) return
    const id = window.setTimeout(() => setJustClaimed(null), 1800)
    return () => window.clearTimeout(id)
  }, [justClaimed])

  if (!state) return null
  const amounts = state.amounts
  const nextDay = (state.day % 10) + 1

  if (state.claimedToday && justClaimed === null) {
    return (
      <div className="daily-card daily-card-done">
        <span className="daily-done-tick" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <span className="daily-done-text">{t('daily.claimed')}</span>
        <span className="daily-done-next">
          {t('daily.tomorrow', { coins: amounts[nextDay - 1] })} <CoinIcon size={16} />
        </span>
      </div>
    )
  }

  const today = justClaimed ?? state.day

  return (
    <div className="daily-card">
      <div className="daily-head">
        <span className="daily-title">{t('daily.title')}</span>
        <span className="daily-day">{t('daily.dayOf', { day: today })}</span>
      </div>
      <div className="daily-strip">
        {amounts.map((coins, i) => {
          const day = i + 1
          const done = day < today || (day === today && justClaimed !== null)
          const current = day === today && justClaimed === null
          return (
            <div key={day} className={`daily-cell${done ? ' done' : ''}${current ? ' current' : ''}${day === 10 ? ' last' : ''}`}>
              {done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : (
                coins
              )}
            </div>
          )
        })}
      </div>
      {justClaimed === null ? (
        <button
          className="btn-primary daily-claim"
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(undefined, {
              onSuccess: (res) => {
                hapticSuccess()
                setJustClaimed(res.day)
              },
            })
          }
        >
          {claim.isPending ? (
            t('daily.claiming')
          ) : (
            <>
              {t('daily.claim', { coins: amounts[state.day - 1] })} <CoinIcon size={16} />
            </>
          )}
        </button>
      ) : (
        <div className="daily-claimed-line">
          {t('daily.tomorrow', { coins: amounts[nextDay - 1] })} <CoinIcon size={16} />
        </div>
      )}
      <div className="daily-hint">{state.broken && justClaimed === null ? t('daily.broken') : t('daily.hint')}</div>
      {claim.isError && <div className="daily-hint daily-error">{t('common.tryAgain')}</div>}
    </div>
  )
}
