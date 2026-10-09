'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useAuth } from '@/components/providers/AuthProvider'
import { useClaimDailyReward, useCollectTreasury, useDailyRewardState, useProfile, type TreasuryState } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import { nowInZone } from '@/lib/forecast/bite'
import { CITIES } from '@/lib/data/city'
import { useNow } from '@/lib/useNow'
import { hapticSuccess } from '@/lib/telegram/haptics'

// The coin chip's sheet (TreasuryChip): today's login reward and the Казна,
// as two tabs of one card in the style of the «×2» and shields sheets — a
// coin in a ring up top, the number that matters big, one «Забрать» each.
// Opens on the tab with something to take.
export function RewardsModal({ treasury, onClose, onToast }: { treasury: TreasuryState | null; onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { data: daily } = useDailyRewardState()
  const dailyReady = !!daily && !daily.claimedToday
  const treasuryReady = !!treasury && treasury.available > 0
  const [tab, setTab] = useState<'daily' | 'treasury'>(dailyReady || !treasuryReady ? 'daily' : 'treasury')

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card double-modal rewards-modal" role="dialog" aria-label={t('treasury.rewardsTitle')} onClick={(e) => e.stopPropagation()}>
        <div className="boosts-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'daily'} className={`boosts-tab orange${tab === 'daily' ? ' on' : ''}`} onClick={() => setTab('daily')}>
            {t('daily.tab')}
            {dailyReady && <span className="boosts-tab-dot" aria-hidden />}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'treasury'} className={`boosts-tab gold${tab === 'treasury' ? ' on' : ''}`} onClick={() => setTab('treasury')}>
            {t('treasury.title')}
            {treasuryReady && <span className="boosts-tab-dot" aria-hidden />}
          </button>
        </div>
        <div key={tab} className="boosts-tab-body">
          {tab === 'daily' ? <DailyTab onToast={onToast} /> : <TreasuryTab data={treasury} onToast={onToast} />}
        </div>
        <button className="shield-modal-close" onClick={onClose}>
          {t('treasury.close')}
        </button>
      </div>
    </div>,
    document.body
  )
}

// Ten dots round the coin — the ten-day run, today's lit.
function DailyTab({ onToast }: { onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { data: state } = useDailyRewardState()
  const claim = useClaimDailyReward()
  const [spinKey, setSpinKey] = useState(0)
  if (!state) return <div className="rewards-loading" />

  const claimed = state.claimedToday
  // Before the claim `day` is today's (to take); after it, the one just taken.
  const today = state.day
  const nextDay = (today % 10) + 1
  const coins = state.amounts[today - 1]

  return (
    <>
      <div className="double-modal-hero rewards-hero" aria-hidden>
        {state.amounts.map((_, i) => {
          const day = i + 1
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
          const done = day < today || (day === today && claimed)
          const current = day === today && !claimed
          return (
            <span
              key={day}
              className={`rewards-dot${done ? ' done' : ''}${current ? ' current' : ''}${day === 10 ? ' last' : ''}`}
              style={{ left: `calc(50% + ${Math.cos(angle) * 60}px)`, top: `calc(50% + ${Math.sin(angle) * 60}px)` }}
            />
          )
        })}
        <div className="double-modal-coin">
          <CoinIcon key={spinKey} size={56} animated="spin" />
        </div>
        <div className="double-modal-badge">+{claimed ? state.amounts[nextDay - 1] : coins}</div>
      </div>

      <div className="modal-title double-modal-title">{t('daily.title')}</div>
      <div className="double-modal-timer">
        <b>
          {today}
          <small>{t('daily.ofTen')}</small>
        </b>
        <span>{claimed ? t('daily.tomorrow', { coins: state.amounts[nextDay - 1] }) : t('daily.streakDay')}</span>
      </div>

      <div className="daily-strip rewards-strip">
        {state.amounts.map((c, i) => {
          const day = i + 1
          const done = day < today || (day === today && claimed)
          const current = day === today && !claimed
          return (
            <div key={day} className={`daily-cell${done ? ' done' : ''}${current ? ' current' : ''}${day === 10 ? ' last' : ''}`}>
              {done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : (
                c
              )}
            </div>
          )
        })}
      </div>

      {claimed ? (
        <div className="rewards-done">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          {t('daily.claimed')}
        </div>
      ) : (
        <button
          className="btn-primary rewards-take"
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(undefined, {
              onSuccess: (res) => {
                hapticSuccess()
                setSpinKey((k) => k + 1)
                onToast(t('treasury.collected', { coins: res.coins }))
              },
              onError: () => onToast(t('common.tryAgain')),
            })
          }
        >
          {claim.isPending ? (
            t('daily.claiming')
          ) : (
            <>
              {t('daily.claim', { coins })} <CoinIcon size={16} />
            </>
          )}
        </button>
      )}
      <div className="rewards-note">{state.broken && !claimed ? t('daily.broken') : t('daily.hint')}</div>
    </>
  )
}

// The ring is today's take against the daily limit.
const RING_R = 58
const RING_C = 2 * Math.PI * RING_R

function TreasuryTab({ data, onToast }: { data: TreasuryState | null; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const collect = useCollectTreasury()
  const now = useNow(30_000)
  // The coin flips once on opening and again on each «Забрать», like the
  // daily reward's.
  const [spinKey, setSpinKey] = useState(0)

  if (!data) {
    return (
      <>
        <div className="double-modal-hero rewards-hero" aria-hidden>
          <div className="double-modal-coin rewards-coin-idle">
            <CoinIcon size={56} />
          </div>
        </div>
        <div className="modal-title double-modal-title">{t('treasury.title')}</div>
        <div className="rewards-note rewards-note-big">{t('treasury.noSectors')}</div>
      </>
    )
  }

  const ready = data.available > 0
  const capReached = data.collectedToday >= data.dailyCap
  const share = Math.min(1, data.collectedToday / data.dailyCap)
  // The daily limit resets at midnight in the player's city.
  const tz = CITIES[profile?.city ?? 'batumi'].timezone
  const local = nowInZone(tz, now)
  const minutesLeft = 24 * 60 - (Number(local.slice(11, 13)) * 60 + new Date(now).getUTCMinutes())
  const duration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h && m ? t('treasury.hoursMin', { h, m }) : h ? t('treasury.hoursOnly', { h }) : t('treasury.minutesOnly', { m })
  }
  // With enough sectors the daily limit, not the income, is what counts.
  const fillMinutes = data.perDay > 0 ? Math.round(((data.dailyCap / data.perDay) * 24 * 60) / 10) * 10 : 0
  const incomeLine =
    data.perDay >= data.dailyCap
      ? t('treasury.fillsIn', { cap: data.dailyCap, time: duration(Math.max(10, fillMinutes)) })
      : t('treasury.perDayShort', { count: data.perDay })

  return (
    <>
      <div className="double-modal-hero rewards-hero" aria-hidden>
        <svg className="double-modal-ring" width="140" height="140" viewBox="0 0 140 140">
          <defs>
            <linearGradient id="treasury-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFD86B" />
              <stop offset="1" stopColor="#D98E0B" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={RING_R} fill="none" stroke="rgba(217,142,11,.14)" strokeWidth="7" />
          <circle
            className="double-modal-ring-left"
            cx="70"
            cy="70"
            r={RING_R}
            fill="none"
            stroke="url(#treasury-ring-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - share)}
            style={{ ['--ring-c' as string]: RING_C }}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="double-modal-coin">
          <CoinIcon key={spinKey} size={56} animated="spin" />
        </div>
        {ready && <div className="double-modal-badge">+{data.available}</div>}
      </div>

      <div className="modal-title double-modal-title">{t('treasury.title')}</div>
      {/* Something to take: that's the big number. Otherwise how much of
          today's limit is in. */}
      <div className="double-modal-timer">
        {ready ? (
          <b className="rewards-ready-num">
            +{data.available} <CoinIcon size={28} />
          </b>
        ) : (
          <b>
            {data.collectedToday}
            <small>{t('treasury.ofCap', { cap: data.dailyCap })}</small>
          </b>
        )}
        <span>
          {ready
            ? t('treasury.readySub', { collected: data.collectedToday, cap: data.dailyCap })
            : capReached
              ? `${t('treasury.capDone')} · ${t('treasury.resetsIn', { time: duration(minutesLeft) })}`
              : t('treasury.accruing')}
        </span>
      </div>

      <div className="double-modal-chips rewards-chips">
        <span>{t('treasury.sectors', { count: data.sectors })}</span>
        <span>{incomeLine}</span>
      </div>

      {ready && (
        <button
          className="btn-primary rewards-take"
          disabled={collect.isPending}
          onClick={() =>
            collect.mutate(undefined, {
              onSuccess: (res) => {
                hapticSuccess()
                setSpinKey((k) => k + 1)
                onToast(t('treasury.collected', { coins: res.coins }))
              },
              onError: () => onToast(t('common.tryAgain')),
            })
          }
        >
          {t('treasury.collectBtn', { coins: data.available })} <CoinIcon size={16} />
        </button>
      )}
      <div className="rewards-note">{t('treasury.how1')}</div>
    </>
  )
}
