'use client'

import { useEffect, useRef, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { ChallengeCompletionModal } from '@/components/app-shell/ChallengeCompletionModal'
import { ChallengeCountdown } from '@/components/app-shell/ChallengeCountdown'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { usePurchaseFlow } from '@/components/app-shell/usePurchaseFlow'
import { useAuth } from '@/components/providers/AuthProvider'
import { useMyChallenges, useChallengeWeekState, useSwapChallenge, useBuyExtraChallenge, useBuffs, useProfile, type WeeklyChallenge } from '@/lib/supabase/queries'
import type { CityId } from '@/lib/data/city'

const TIER_LABEL: Record<WeeklyChallenge['tier'], string> = {
  soft: 'Простое',
  light: 'Лёгкое',
  medium: 'Среднее',
  hard: 'Сложное',
}

const TIER_COLOR: Record<WeeklyChallenge['tier'], string> = {
  soft: '#7A8896',
  light: '#2FA84F',
  medium: '#C98A00',
  hard: '#D3401A',
}

const TIER_TINT: Record<WeeklyChallenge['tier'], string> = {
  soft: 'rgba(122,136,150,0.12)',
  light: 'rgba(47,168,79,0.12)',
  medium: 'rgba(201,138,0,0.14)',
  hard: 'rgba(211,64,26,0.13)',
}

type Completion = { doneCount: number; total: number; coinsEarned: number; coinsBefore: number; allDone: boolean }

export function ChallengesScreen({ city, onBack, active }: { city: CityId; onBack: () => void; active: boolean }) {
  const { user } = useAuth()
  const { data: myProfile } = useProfile(user?.id ?? null)
  const { data: challenges = [], isLoading, refetch } = useMyChallenges(city)
  const { data: weekState, refetch: refetchWeekState } = useChallengeWeekState(city)
  const { data: buffs = [] } = useBuffs()
  const swapChallenge = useSwapChallenge(city)
  const buyExtraChallenge = useBuyExtraChallenge(city)
  const swapPrice = buffs.find((b) => b.id === 'challenge_swap')?.price ?? 20
  const extraPrice = buffs.find((b) => b.id === 'extra_challenge')?.price ?? 70
  const coins = myProfile?.coins ?? 0
  const { request, modal: purchaseModal } = usePurchaseFlow(coins)
  const [completion, setCompletion] = useState<Completion | null>(null)

  // <Screen> never unmounts (see DECISIONS.md), so useQuery's own
  // fetch-on-mount only ever fires once, at app boot — progress made
  // elsewhere (a catch, a like, a sector viewed) would otherwise sit stale
  // here until a hard reload. Refetch every time this screen becomes the
  // visible one instead — and since sync_my_challenges is also the ONLY
  // place a challenge's completedAt actually flips (it settles+pays out as
  // a side effect of being called), this refetch is also the one moment we
  // can catch a fresh completion: snapshot completedAt per row before, diff
  // against the resolved result after, and celebrate whatever newly flipped.
  const wasActiveRef = useRef(active)
  useEffect(() => {
    if (active && !wasActiveRef.current) {
      const before = new Map(challenges.map((c) => [c.id, c.completedAt]))
      const coinsBeforeSync = myProfile?.coins ?? 0
      refetch().then((res) => {
        const after = res.data ?? []
        const newlyDone = after.filter((c) => before.has(c.id) && !before.get(c.id) && !!c.completedAt)
        if (newlyDone.length > 0 && after.length > 0) {
          setCompletion({
            doneCount: after.filter((c) => !!c.completedAt).length,
            total: after.length,
            coinsEarned: newlyDone.reduce((sum, c) => sum + c.coinReward, 0),
            coinsBefore: coinsBeforeSync,
            allDone: after.every((c) => !!c.completedAt),
          })
        }
      })
      refetchWeekState()
    }
    wasActiveRef.current = active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, refetch, refetchWeekState])

  const doneCount = challenges.filter((c) => !!c.completedAt).length
  const total = challenges.length
  const weekPct = total ? doneCount / total : 0
  const weekCoins = challenges.reduce((sum, c) => sum + c.coinReward, 0)
  const ringR = 30
  const ringC = 2 * Math.PI * ringR

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Челленджи недели</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {!isLoading && total > 0 && (
          <div className="challenges-week-card">
            <div className="challenges-week-pattern" />
            <ChallengeCountdown endsAt={weekState?.weekEndsAt ?? null} />
            <div className="challenges-week-body">
              <div className="challenges-week-top">
                <div className="challenges-week-ring-wrap">
                  <svg width="76" height="76" viewBox="0 0 76 76">
                    <circle cx="38" cy="38" r={ringR} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="7" />
                    <circle
                      cx="38"
                      cy="38"
                      r={ringR}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={ringC}
                      strokeDashoffset={ringC * (1 - weekPct)}
                      transform="rotate(-90 38 38)"
                      className="challenges-week-ring-fill"
                    />
                  </svg>
                  <div className="challenges-week-ring-label">
                    {doneCount}/{total}
                  </div>
                </div>
                <div className="challenges-week-info">
                  <div className="challenges-week-title">{doneCount === total ? 'Неделя закрыта 🎉' : 'Задания недели'}</div>
                  <div className="challenges-week-reward">
                    <CoinIcon size={16} />
                    <span>до {weekCoins} монет</span>
                  </div>
                </div>
              </div>
              <div className="challenges-week-note">Три задания на неделю. Не успел — часть монет всё равно капнет по прогрессу.</div>
            </div>
            <div className="challenges-week-glow-panel" />
          </div>
        )}

        {!isLoading &&
          challenges.map((ch, i) => {
            const done = !!ch.completedAt
            const pct = Math.min(1, ch.progress / ch.target)
            const canSwap = !done && (ch.tier === 'medium' || ch.tier === 'hard')
            return (
              <div
                key={ch.challengeId}
                className={`challenge-card${done ? ' challenge-done' : ''}`}
                style={
                  {
                    '--tier-color': TIER_COLOR[ch.tier],
                    background: done ? TIER_TINT[ch.tier] : undefined,
                    animationDelay: `${i * 60}ms`,
                  } as React.CSSProperties
                }
              >
                {done && <div className="challenge-done-badge">✓</div>}
                <div className="challenge-tier-row">
                  <span className="challenge-tier-dot" style={{ background: TIER_COLOR[ch.tier] }} />
                  <span className="challenge-tier-label">{TIER_LABEL[ch.tier]}</span>
                  {!done && (
                    <span className="challenge-reward">
                      <CoinIcon size={16} />
                      {ch.coinReward}
                    </span>
                  )}
                </div>
                <div className="challenge-name">{ch.name}</div>
                <div className="challenge-desc">{ch.description}</div>
                <div className="challenge-progress-track">
                  <div className="challenge-progress-fill" style={{ transform: `scaleX(${pct})`, background: TIER_COLOR[ch.tier] }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <div className="challenge-progress-label">
                    {ch.progress}/{ch.target}
                  </div>
                  {canSwap && (
                    <button
                      className="challenge-swap-btn"
                      disabled={swapChallenge.isPending}
                      onClick={() => request(swapPrice, `Замена: ${ch.name}`, () => swapChallenge.mutate(ch.id))}
                    >
                      Заменить · {swapPrice}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

        {!isLoading && (weekState?.slotCount ?? 0) < 4 && !(weekState?.extraSlotBought ?? false) && (
          <button
            className="challenge-extra-btn"
            disabled={buyExtraChallenge.isPending}
            onClick={() => request(extraPrice, 'Четвёртый челлендж', () => buyExtraChallenge.mutate())}
          >
            <span className="challenge-extra-lock">🔓</span>
            <span>Открыть 4-й челлендж</span>
            <span className="challenge-extra-price">
              <CoinIcon size={16} />
              {extraPrice}
            </span>
          </button>
        )}
      </div>

      {purchaseModal}
      {completion && (
        <ChallengeCompletionModal
          doneCount={completion.doneCount}
          total={completion.total}
          coinsEarned={completion.coinsEarned}
          coinsBefore={completion.coinsBefore}
          allDone={completion.allDone}
          onClose={() => setCompletion(null)}
        />
      )}
    </>
  )
}
