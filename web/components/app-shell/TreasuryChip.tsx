'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useAuth } from '@/components/providers/AuthProvider'
import { useCollectTreasury, useProfile, useTreasury, type TreasuryState } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import { nowInZone } from '@/lib/forecast/bite'
import { CITIES } from '@/lib/data/city'
import { useNow } from '@/lib/useNow'
import { hapticSuccess, hapticTap } from '@/lib/telegram/haptics'

// Казна in the map's top panel: what the player's sectors have earned.
// Small on purpose — it shares the bar with the logo and the layer switch,
// so the panel keeps its height. A tap opens a sheet that says how it
// works, how much is ready, how much of today's limit is used and when it
// resets — and collects from there. Only for someone who holds at least
// one sector (the map already knows, so no request otherwise).
export function TreasuryChip({ enabled, onToast }: { enabled: boolean; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { data } = useTreasury(enabled)
  const [open, setOpen] = useState(false)

  if (!enabled || !data || data.sectors === 0) return null
  const ready = data.available > 0
  const capReached = data.collectedToday >= data.dailyCap

  return (
    <>
      <button
        type="button"
        data-tour="treasury"
        className={`treasury-chip tap-scale${ready ? ' ready' : ''}${capReached ? ' done' : ''}`}
        onClick={() => {
          hapticTap()
          setOpen(true)
        }}
        aria-label={`${t('treasury.title')}: ${t('treasury.amount', { available: data.available, cap: data.dailyCap })}`}
      >
        <CoinIcon size={16} />
        <span className="treasury-chip-num">{data.available}</span>
        <span className="treasury-chip-cap">/{data.dailyCap}</span>
      </button>
      {open && <TreasurySheet data={data} onClose={() => setOpen(false)} onToast={onToast} />}
    </>
  )
}

function TreasurySheet({ data, onClose, onToast }: { data: TreasuryState; onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const collect = useCollectTreasury()
  const now = useNow(30_000)
  const ready = data.available > 0
  const capReached = data.collectedToday >= data.dailyCap

  // The daily limit resets at midnight in the player's city.
  const tz = CITIES[profile?.city ?? 'batumi'].timezone
  const local = nowInZone(tz, now)
  const minutesLeft = 24 * 60 - (Number(local.slice(11, 13)) * 60 + new Date(now).getUTCMinutes())
  const duration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h && m ? t('treasury.hoursMin', { h, m }) : h ? t('treasury.hoursOnly', { h }) : t('treasury.minutesOnly', { m })
  }
  const resetIn = duration(minutesLeft)
  // With enough sectors the daily limit, not the income, is what counts:
  // say how fast it fills rather than an income that can't all be taken.
  const fillMinutes = data.perDay > 0 ? Math.round(((data.dailyCap / data.perDay) * 24 * 60) / 10) * 10 : 0
  const incomeLine =
    data.perDay >= data.dailyCap
      ? t('treasury.fillsIn', { cap: data.dailyCap, time: duration(Math.max(10, fillMinutes)) })
      : t('treasury.perDayShort', { count: data.perDay })

  function onCollect() {
    collect.mutate(undefined, {
      onSuccess: (res) => {
        hapticSuccess()
        onToast(t('treasury.collected', { coins: res.coins }))
        onClose()
      },
      onError: () => onToast(t('common.tryAgain')),
    })
  }

  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet treasury-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('treasury.title')}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">{t('treasury.sheetKicker')}</div>
            <div className="move-title">{t('treasury.title')}</div>
          </div>
        </div>
        <div className="move-body treasury-sheet-body">
          <div className={`treasury-now${ready ? ' ready' : ''}`}>
            <CoinIcon size={56} />
            <div className="treasury-now-text">
              {ready ? (
                <>
                  <span>{t('treasury.readyNow')}</span>
                  <b>+{data.available}</b>
                </>
              ) : capReached ? (
                <>
                  <b className="small">{t('treasury.capDone')}</b>
                  <span>{t('treasury.resetsIn', { time: resetIn })}</span>
                </>
              ) : (
                <b className="small">{t('treasury.accruing')}</b>
              )}
            </div>
          </div>

          <div className="treasury-progress">
            <div className="treasury-progress-head">
              <span>{t('treasury.todayProgress', { collected: data.collectedToday, cap: data.dailyCap })}</span>
            </div>
            <div className="treasury-progress-bar">
              <i style={{ transform: `scaleX(${Math.min(1, data.collectedToday / data.dailyCap)})` }} />
            </div>
            <div className="treasury-progress-sub">
              {t('treasury.sectors', { count: data.sectors })} · {incomeLine}
            </div>
          </div>

          <div className="treasury-how">
            <div className="treasury-how-title">{t('treasury.howTitle')}</div>
            <ul>
              <li>{t('treasury.how1')}</li>
              <li>{t('treasury.how2')}</li>
              <li>{t('treasury.how3', { cap: data.dailyCap })}</li>
            </ul>
          </div>

          {ready ? (
            <button className="btn-primary" disabled={collect.isPending} onClick={onCollect}>
              {t('treasury.collectBtn', { coins: data.available })}
            </button>
          ) : (
            <button className="btn-secondary" onClick={onClose}>
              {t('treasury.gotIt')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
