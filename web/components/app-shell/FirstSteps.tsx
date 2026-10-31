'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useClaimFirstSteps, useFirstSteps, type FirstStepKey } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import { currentLocale } from '@/lib/i18n/runtime'

const ORDER: FirstStepKey[] = ['catch', 'fortify', 'treasury', 'daily', 'challenge', 'clan']

// «Задание новичка»: what's left of the 7 days for the first catch to pay triple,
// or null when there's no such task (already caught, too late, an older server).
function newbieDeadline(until: string | null | undefined, t: ReturnType<typeof useI18n>['t']) {
  if (!until) return null
  const ms = new Date(until).getTime() - Date.now()
  if (!(ms > 0)) return null
  const left = ms >= 86_400_000 ? t('firstSteps.leftDays', { count: Math.floor(ms / 86_400_000) }) : t('firstSteps.leftHours', { count: Math.ceil(ms / 3_600_000) })
  const date = new Date(until).toLocaleString(currentLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return { left, date }
}

// «Первые шаги» on the map, right of the «Неделя» sticker: a newcomer's six
// steps with progress, then «Забрать 100» once all are done (the server
// checks and pays — supabase-drafts/first_steps.sql). Gone after that, and
// for anyone who isn't a newcomer.
export function FirstStepsPill({ onToast }: { onToast?: (msg: string) => void }) {
  const { t } = useI18n()
  const { data, refetch } = useFirstSteps()
  const [open, setOpen] = useState(false)
  if (!data || !data.eligible || data.claimed) return null
  const done = ORDER.filter((k) => data.steps[k]).length
  const all = done === ORDER.length
  const newbie = data.steps.catch ? null : newbieDeadline(data.newbie_until, t)
  return (
    <>
      <button
        data-tour="first-steps"
        className={`first-steps-pill tap-scale${all ? ' ready' : ''}${newbie ? ' newbie' : ''}`}
        onClick={() => {
          void refetch()
          setOpen(true)
        }}
      >
        {all ? (
          // Done: the reward itself, not a full ring with «6» in it.
          <span className="first-steps-coin" aria-hidden>
            <CoinIcon size={20} />
          </span>
        ) : (
          <span className="first-steps-ring" style={{ '--p': `${(done / ORDER.length) * 360}deg` } as React.CSSProperties} aria-hidden>
            <span>{done}</span>
          </span>
        )}
        {all ? t('firstSteps.pillReady', { coins: data.reward }) : newbie ? t('firstSteps.pillNewbie', { left: newbie.left }) : t('firstSteps.pill', { done, total: ORDER.length })}
      </button>
      {open && <FirstStepsSheet onClose={() => setOpen(false)} onToast={onToast} />}
    </>
  )
}

function FirstStepsSheet({ onClose, onToast }: { onClose: () => void; onToast?: (msg: string) => void }) {
  const { t } = useI18n()
  const { data } = useFirstSteps()
  const claim = useClaimFirstSteps()
  if (!data) return null
  const done = ORDER.filter((k) => data.steps[k]).length
  const all = done === ORDER.length
  const newbie = data.steps.catch ? null : newbieDeadline(data.newbie_until, t)
  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('firstSteps.title')}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">{t('firstSteps.kicker')}</div>
            <div className="move-title">{t('firstSteps.title')}</div>
          </div>
        </div>
        <div className="move-body">
          <div className="first-steps-sub">
            {t('firstSteps.sub', { coins: data.reward })} <CoinIcon size={16} />
          </div>
          {newbie && (
            <div className="first-steps-newbie">
              <b>{t('firstSteps.newbieTitle')}</b>
              <span>{t('firstSteps.newbieText', { date: newbie.date })}</span>
              <span className="first-steps-newbie-left">{t('firstSteps.newbieLeft', { left: newbie.left })}</span>
            </div>
          )}
          <ul className="first-steps-list">
            {ORDER.map((k) => (
              <li key={k} className={data.steps[k] ? 'done' : ''}>
                <span className="first-steps-check" aria-hidden>
                  {data.steps[k] && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
                <span className="first-steps-text">
                  <b>{t(`firstSteps.steps.${k}.title`)}</b>
                  <span>{t(`firstSteps.steps.${k}.hint`)}</span>
                </span>
              </li>
            ))}
          </ul>
          {all ? (
            <button
              className="btn-primary shop-price-btn"
              style={{ margin: '16px 0 18px' }}
              disabled={claim.isPending}
              onClick={() =>
                claim.mutate(undefined, {
                  onSuccess: (r) => {
                    onToast?.(t('firstSteps.claimed', { coins: r.coins }))
                    onClose()
                  },
                  onError: () => onToast?.(t('common.tryAgain')),
                })
              }
            >
              {t('firstSteps.claim')} <CoinIcon size={16} /> {data.reward}
            </button>
          ) : (
            <button className="btn-secondary" style={{ margin: '16px 0 18px' }} onClick={onClose}>
              {t('firstSteps.progress', { done, total: ORDER.length })}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
