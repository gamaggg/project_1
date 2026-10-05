'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { useFishingSession, useStartFishing, useStopFishing } from '@/lib/supabase/queries'
import { useI18n } from '@/lib/i18n'
import { useNow } from '@/lib/useNow'

const ROD = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 21 17.5 4.5" />
    <path d="M17.5 4.5 20 8.5v6.5" />
    <path d="M20 15a2 2 0 1 1-2 2" />
  </svg>
)

// «Я на рыбалке» on the map, right of the «Неделя» sticker: one tap turns it
// on (the bot pins a reminder with a camera button — lib/telegram/fishing.ts),
// and while it's on the pill shows for how long, with «Закончить».
export function FishingPill({ onToast }: { onToast?: (msg: string) => void }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const { data: session } = useFishingSession()
  const start = useStartFishing()
  const stop = useStopFishing()
  const now = useNow(60_000)
  if (!user) return null

  if (!session || new Date(session.endsAt).getTime() <= now) {
    return (
      <button
        className="fishing-pill tap-scale"
        disabled={start.isPending}
        onClick={() =>
          start.mutate(undefined, {
            onSuccess: () => onToast?.(t('fishing.started')),
            onError: () => onToast?.(t('common.tryAgain')),
          })
        }
      >
        {ROD}
        {t('fishing.start')}
      </button>
    )
  }

  const min = Math.max(1, Math.floor((now - new Date(session.startedAt).getTime()) / 60000))
  const h = Math.floor(min / 60)
  const m = min % 60
  return (
    <div className="fishing-pill on" role="status">
      <span className="fishing-pill-dot" aria-hidden />
      <span className="fishing-pill-text">{h > 0 ? t('fishing.forHm', { h, m }) : t('fishing.forM', { m })}</span>
      <button className="fishing-pill-stop" disabled={stop.isPending} onClick={() => stop.mutate(undefined, { onSuccess: () => onToast?.(t('fishing.stopped')) })}>
        {t('fishing.stop')}
      </button>
    </div>
  )
}
