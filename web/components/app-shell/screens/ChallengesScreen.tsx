'use client'

import { SkeletonBlock } from '@/components/app-shell/Skeleton'
import { useEffect, useRef, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { ChallengeCompletionModal } from '@/components/app-shell/ChallengeCompletionModal'
import { ChallengeCountdown } from '@/components/app-shell/ChallengeCountdown'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { usePurchaseFlow } from '@/components/app-shell/usePurchaseFlow'
import { useAuth } from '@/components/providers/AuthProvider'
import { useMyChallenges, useChallengeWeekState, useSwapChallenge, useBuyExtraChallenge, useBuffs, useProfile, type WeeklyChallenge } from '@/lib/supabase/queries'
import { tn } from '@/lib/i18n/runtime'

const TIER_LABEL: Record<WeeklyChallenge['tier'], string> = {
  get soft() {
    return tn('weekly.tierSoft')
  },
  get light() {
    return tn('weekly.tierLight')
  },
  get medium() {
    return tn('weekly.tierMedium')
  },
  get hard() {
    return tn('weekly.tierHard')
  },
}

const TIER_HINT = { soft: 'weekly.hintSoft', light: 'weekly.hintLight', medium: 'weekly.hintMedium', hard: 'weekly.hintHard' } as const

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

// Not city-prop-driven: challenges are the account's own, real weekly
// progress with real coin payouts, so they're scoped to profile.city (the
// stored, account-level city) rather than whichever map tab happens to be
// showing — that's just a same-device browsing lens (see lib/data/city),
// and keying a reward-bearing week off it let a player rack up a second,
// parallel challenge week (and a second payout) just by switching city tabs
// mid-week (found via a live "Картограф" completion nobody could find in
// the visible set — it belonged to the other city's week).
export function ChallengesScreen({ onBack, active }: { onBack: () => void; active: boolean }) {
  const { user } = useAuth()
  const { data: myProfile } = useProfile(user?.id ?? null)
  const city = myProfile?.city ?? 'batumi'
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
  // Unfinished tasks are always unfolded and sit first; a finished one folds away
  // below them and unfolds on a tap (openId). `fresh` = just flipped to done.
  const [openId, setOpenId] = useState<number | null>(null)
  const [fresh, setFresh] = useState<Set<number>>(new Set())

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
        if (newlyDone.length > 0) setFresh(new Set(newlyDone.map((c) => c.id)))
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
  const earnedCoins = challenges.reduce((sum, c) => sum + (c.completedAt ? c.coinReward : 0), 0)
  const allDone = total > 0 && doneCount === total
  const curId = challenges.find((c) => !c.completedAt)?.id ?? null
  // The path fills left to right: ticks first, then the numbers still to do.
  const pathOrder = [...challenges.filter((c) => !!c.completedAt), ...challenges.filter((c) => !c.completedAt)]
  const ordered = [...challenges.filter((c) => !c.completedAt), ...challenges.filter((c) => !!c.completedAt)]
  const ringR = 30
  const ringC = 2 * Math.PI * ringR

  // A node on the week's path: unfold that task's card and bring it into view.
  const jumpTo = (id: number) => {
    setOpenId(id)
    requestAnimationFrame(() => document.getElementById(`challenge-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{tn('weekly.title')}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {/* The week card and three task cards in outline while they load —
            not an empty screen they then pop into. */}
        {isLoading && (
          <div aria-busy="true">
            <SkeletonBlock height={150} radius={22} style={{ marginBottom: 14 }} />
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} height={104} radius={18} style={{ marginBottom: 10 }} />
            ))}
          </div>
        )}
        {!isLoading && total > 0 && (
          // Re-keyed each time the screen becomes the visible one, so the card plays its entrance again.
          <div key={active ? 'on' : 'off'} className={`challenges-week-card${allDone ? ' all-done' : ''}`}>
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
                  <div className="challenges-week-title">{allDone ? tn('weekly.weekClosed') : tn('weekly.weekTasks')}</div>
                  <div className="challenges-week-reward">
                    <CoinIcon size={16} />
                    <span>{tn('weekly.earned', { got: earnedCoins, total: weekCoins })}</span>
                  </div>
                </div>
              </div>
              <div className="wk-path" data-tour="week-path" aria-label={tn('weekly.path')}>
                {pathOrder.map((ch, i) => {
                  const d = !!ch.completedAt
                  return (
                    <div key={ch.id} className="wk-path-seg" style={{ ['--i' as string]: i }}>
                      {i > 0 && <span className={`wk-path-line${d ? ' full' : pathOrder[i - 1].completedAt ? ' on' : ''}`} />}
                      <button
                        className={`wk-node${d ? ' done' : ''}${curId === ch.id ? ' cur' : ''}`}
                        style={{ ['--tier-color' as string]: TIER_COLOR[ch.tier] }}
                        onClick={() => jumpTo(ch.id)}
                        aria-label={ch.name}
                      >
                        {d ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        ) : (
                          <b>{i + 1}</b>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="challenges-week-note">{tn('weekly.note')}</div>
            </div>
            <div className="challenges-week-glow-panel" />
          </div>
        )}

        {!isLoading &&
          ordered.map((ch, i) => {
            const done = !!ch.completedAt
            const pct = Math.min(1, ch.progress / ch.target)
            const canSwap = !done && (ch.tier === 'medium' || ch.tier === 'hard')
            const isOpen = !done || openId === ch.id
            const partial = Math.floor(pct * ch.coinReward)
            return (
              <div
                key={ch.challengeId}
                id={`challenge-${ch.id}`}
                data-tour={!done && ordered[0]?.id === ch.id ? 'challenge-card' : undefined}
                className={`challenge-card${done ? ' challenge-done' : ' pinned'}${isOpen ? ' open' : ''}${fresh.has(ch.id) ? ' fresh' : ''}`}
                style={
                  {
                    '--tier-color': TIER_COLOR[ch.tier],
                    background: done ? TIER_TINT[ch.tier] : undefined,
                    animationDelay: `${i * 60}ms`,
                  } as React.CSSProperties
                }
              >
                <button className="challenge-head" onClick={() => done && setOpenId(isOpen ? null : ch.id)} aria-expanded={isOpen}>
                  <span className="challenge-tier-row">
                    <span className="challenge-tier-dot" style={{ background: TIER_COLOR[ch.tier] }} />
                    <span className="challenge-tier-label">{TIER_LABEL[ch.tier]}</span>
                    {done ? (
                      <span className="challenge-done-badge" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path className="challenge-check" d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                    ) : (
                      <span className="challenge-reward">
                        <CoinIcon size={16} />
                        {ch.coinReward}
                      </span>
                    )}
                    <svg className="challenge-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                  <span className="challenge-name">{ch.name}</span>
                  <span className="challenge-progress-track">
                    <span className="challenge-progress-fill" style={{ transform: `scaleX(${pct})`, background: TIER_COLOR[ch.tier] }} />
                  </span>
                  <span className="challenge-progress-label">
                    {ch.progress}/{ch.target}
                  </span>
                </button>
                <div className="challenge-more">
                  <div className="challenge-more-in">
                    <div className="challenge-desc">{ch.description}</div>
                    <div className="challenge-facts">
                      {done ? (
                        <span className="challenge-fact paid">{tn('weekly.paid')}</span>
                      ) : (
                        <>
                          <span className="challenge-fact">{tn('weekly.left', { n: ch.target - ch.progress })}</span>
                          <span className="challenge-fact">
                            {tn('weekly.inCredit')}
                            <b>
                              {partial}
                              <CoinIcon size={16} />
                            </b>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="challenge-tip">{done ? tn(TIER_HINT[ch.tier]) : tn('weekly.partialHint')}</div>
                    {canSwap && (
                      <button
                        className="challenge-swap-btn"
                        disabled={swapChallenge.isPending}
                        onClick={() => request(swapPrice, tn('weekly.swapReason', { name: ch.name }), () => swapChallenge.mutate(ch.id))}
                      >
                        {tn('weekly.swap', { price: swapPrice })}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

        {!isLoading && (weekState?.slotCount ?? 0) < 4 && !(weekState?.extraSlotBought ?? false) && (
          <button
            className="challenge-extra-btn"
            disabled={buyExtraChallenge.isPending}
            onClick={() => request(extraPrice, tn('weekly.fourthReason'), () => buyExtraChallenge.mutate())}
          >
            <span className="challenge-extra-lock">🔓</span>
            <span>{tn('weekly.openFourth')}</span>
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
