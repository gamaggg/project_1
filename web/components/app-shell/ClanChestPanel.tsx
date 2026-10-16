'use client'

import { useEffect, useRef, useState } from 'react'
import { HexLoader } from '@/components/app-shell/HexLoader'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useClanChest } from '@/lib/supabase/queries'
import { ChallengeCountdown } from '@/components/app-shell/ChallengeCountdown'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { formatMeters } from '@/components/app-shell/ClanRace'
import { useAuth } from '@/components/providers/AuthProvider'
import { tn } from '@/lib/i18n/runtime'

const ROMAN = ['I', 'II', 'III', 'IV', 'V']

// A small treasure chest — grey while locked, wood and gold once its tier is
// reached; the fifth one is the golden one. `popped` lifts the lid on the
// back hinge and lights the inside (a tap on an opened chest).
function ChestIcon({ state, legendary, popped }: { state: 'locked' | 'open' | 'next'; legendary?: boolean; popped?: boolean }) {
  const reached = state === 'open'
  const body = reached ? (legendary ? '#C9861A' : '#8B5A2B') : '#D5D2CB'
  const lid = reached ? (legendary ? '#E2A43A' : '#A5692F') : '#E4E1DA'
  const band = reached ? (legendary ? '#FFE08A' : '#E0A63A') : '#C3C0B8'
  return (
    <svg viewBox="0 0 48 44" width="44" height="40" aria-hidden overflow="visible">
      <rect x="6" y="17" width="36" height="23" rx="4" fill={body} />
      <rect x="6" y="17" width="36" height="4" fill={band} />
      <rect x="12" y="17" width="4" height="23" fill={band} opacity={0.9} />
      <rect x="32" y="17" width="4" height="23" fill={band} opacity={0.9} />
      <rect x="20" y="19" width="8" height="10" rx="2" fill={reached ? '#FFE7BE' : '#B8B5AD'} />
      <circle cx="24" cy="23.5" r="1.6" fill={body} />
      {popped && <rect className="chest-glow" x="8" y="14.5" width="32" height="4.5" rx="2.2" fill="#FFE9A8" />}
      <g className={`chest-lid${popped ? ' up' : ''}`} style={{ transformOrigin: '6px 17px' }}>
        <path d="M6 17C6 9 12 4 24 4s18 5 18 13Z" fill={lid} />
        <rect x="12" y="5" width="4" height="12" fill={band} opacity={0.9} />
        <rect x="32" y="5" width="4" height="12" fill={band} opacity={0.9} />
        {reached && <path d="M9 12c2-3 5-4.6 9-5.2" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" fill="none" />}
      </g>
    </svg>
  )
}

// The chest counts in metres, like the battle: the server's points × 10
// (catch +1 = 10 m, challenge +2 = 20 m, capture +3 = 30 m — the same numbers
// the battle gives), so one unit runs through the whole clan screen.
const METERS_PER_POINT = 10

// Where `points` sits along the bar, 0..1. The bar runs the full width of the
// track and the five chests sit at 10 / 30 / 50 / 70 / 90 % of it (each in
// the middle of its fifth), so the fill reaches a chest exactly when its
// threshold is reached and lies between two chests in between — however far
// apart the thresholds themselves are. The first tenth is the way to chest I.
function trackFraction(points: number, thresholds: number[]): number {
  if (!thresholds.length) return 0
  let prev = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (points < thresholds[i]) {
      const within = Math.max(0, Math.min(1, (points - prev) / (thresholds[i] - prev)))
      return i === 0 ? 0.1 * within : 0.1 + 0.2 * (i - 1) + 0.2 * within
    }
    prev = thresholds[i]
  }
  return 0.9
}

// A number that ticks up to its target (and from the last shown value on a
// refetch) — on the next frame, never synchronously, like CoinCountUp.
function useCountUp(target: number, ms = 1000) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    let t0: number | null = null
    let raf = 0
    const tick = (ts: number) => {
      if (t0 === null) t0 = ts
      const t = reduced ? 1 : Math.min(1, (ts - t0) / ms)
      const val = Math.round(start + (target - start) * (1 - (1 - t) ** 3))
      from.current = val
      setV(val)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function ClanChestPanel({ clanId, isMember }: { clanId: number; isMember: boolean }) {
  const { data: chest, isLoading } = useClanChest(clanId)
  if (isLoading || !chest) return <div className="clan-soon">{isLoading ? <HexLoader size={0.55} /> : tn('common.noData')}</div>
  return <ChestBody chest={chest} isMember={isMember} />
}

type Chest = NonNullable<ReturnType<typeof useClanChest>['data']>

function ChestBody({ chest, isMember }: { chest: Chest; isMember: boolean }) {
  const { user } = useAuth()
  const [sel, setSel] = useState<number | null>(null)
  const [burst, setBurst] = useState<{ i: number; k: number } | null>(null)
  const burstTimer = useRef(0)
  useEffect(() => () => clearTimeout(burstTimer.current), [])

  const next = chest.tier < chest.thresholds.length ? chest.thresholds[chest.tier] : null
  const fraction = trackFraction(chest.points, chest.thresholds)
  const maxPoints = Math.max(1, ...chest.contributors.map((c) => c.points))
  const meters = chest.points * METERS_PER_POINT
  const shown = useCountUp(meters)
  const selected = sel ?? Math.min(chest.tier, chest.thresholds.length - 1)
  const mine = chest.contributors.find((c) => c.userId === user?.id)
  const stateOf = (i: number) => (i < chest.tier ? 'open' : i === chest.tier ? 'next' : 'locked')

  const pick = (i: number) => {
    setSel(i)
    if (i < chest.tier) {
      setBurst({ i, k: i * 1000 + (burst?.k ?? 0) + 1 })
      clearTimeout(burstTimer.current)
      burstTimer.current = window.setTimeout(() => setBurst(null), 1500)
    }
  }
  const selState = stateOf(selected)
  const selThreshold = chest.thresholds[selected] ?? 0
  const selProgress = selThreshold ? Math.min(1, chest.points / selThreshold) : 0

  return (
    <div className="clan-tab-body">
      <div className="clan-chest-card">
        <div className="clan-chest-head">
          <div>
            <div className="clan-chest-kicker">{tn('chest.kicker')}</div>
            <div className="clan-chest-points">
              <b>{formatMeters(shown)}</b>
            </div>
          </div>
          <ChallengeCountdown endsAt={chest.weekEnd} />
        </div>

        <div className="clan-chest-track">
          <div className="clan-chest-bar">
            <div className="clan-chest-fill" style={{ transform: `scaleX(${fraction})` }} />
          </div>
          <div className="clan-chest-stops" data-tour="chest-stops">
            {chest.thresholds.map((t, i) => {
              const state = stateOf(i)
              const popped = burst?.i === i
              return (
                <button
                  key={i}
                  className={`clan-chest-stop ${state}${selected === i ? ' sel' : ''}`}
                  style={{ animationDelay: `${i * 70}ms`, ['--open-delay' as string]: `${0.9 + i * 0.16}s` }}
                  onClick={() => pick(i)}
                  aria-pressed={selected === i}
                  aria-label={tn('chest.tier', { roman: ROMAN[i] })}
                >
                  {popped && (
                    <span key={burst?.k} className="chest-coins" aria-hidden>
                      {[0, 1, 2, 3, 4].map((n) => (
                        <i key={n} style={{ ['--dx' as string]: `${(n - 2) * 9}px`, ['--dy' as string]: `${-34 - (n % 2) * 12}px`, animationDelay: `${n * 40}ms` }}>
                          <CoinIcon size={16} />
                        </i>
                      ))}
                    </span>
                  )}
                  <ChestIcon state={state} legendary={i === 4} popped={popped} />
                  <span className="clan-chest-roman">{ROMAN[i]}</span>
                  <span className="clan-chest-threshold">{formatMeters(t * METERS_PER_POINT)}</span>
                  <span className="clan-chest-reward">
                    <CoinIcon size={16} />
                    {chest.rewards[i]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div key={selected} className={`clan-chest-detail ${selState}`}>
          <div className="clan-chest-detail-top">
            <b>{tn('chest.tier', { roman: ROMAN[selected] })}</b>
            <span className="clan-chest-chip">{selState === 'open' ? tn('chest.stOpen') : selState === 'next' ? tn('chest.stNext') : tn('chest.stLocked')}</span>
          </div>
          <div className="clan-chest-detail-bar">
            <span style={{ transform: `scaleX(${selProgress})` }} />
          </div>
          <div className="clan-chest-detail-meta">
            <span>
              {selState === 'open'
                ? tn('chest.reachedAt', { m: formatMeters(selThreshold * METERS_PER_POINT) })
                : `${tn('chest.needTotal', { m: formatMeters(selThreshold * METERS_PER_POINT) })} · ${tn('chest.toGo', { m: formatMeters((selThreshold - chest.points) * METERS_PER_POINT) })}`}
            </span>
            <span className="clan-chest-detail-coins">
              +{chest.rewards[selected]}
              <CoinIcon size={16} />
            </span>
          </div>
          <div className="clan-chest-detail-sub">{tn('chest.rewardEach')}</div>
        </div>

        <div className="clan-chest-status">
          {chest.tier === 0
            ? tn('chest.toFirst', { m: formatMeters((next! - chest.points) * METERS_PER_POINT) })
            : next === null
              ? tn('chest.allOpen')
              : tn('chest.opened', { tier: chest.tier, m: formatMeters((next - chest.points) * METERS_PER_POINT) })}
        </div>
        <div className="clan-chest-rules">
          <span>{tn('race.ruleCatch')} <b>+10 {tn('fmt.m')}</b></span>
          <span>{tn('chest.ruleClaim')} <b>+30 {tn('fmt.m')}</b></span>
          <span>{tn('chest.ruleChallenge')} <b>+20 {tn('fmt.m')}</b></span>
        </div>
        <div className="clan-chest-note">
          {tn('chest.note')}
        </div>
        {chest.lastWeek && (
          <div className="clan-chest-last">
            {chest.lastWeek.tier > 0 ? tn('chest.lastOpened', { roman: ROMAN[chest.lastWeek.tier - 1], m: formatMeters(chest.lastWeek.points * METERS_PER_POINT) }) : tn('chest.lastNone')}
          </div>
        )}
      </div>

      {isMember && (
        <div className="clan-card chest-me" data-tour="chest-me">
          <div className="clan-card-title">{tn('chest.myTitle')}</div>
          {mine ? (
            <>
              <div className="chest-me-row">
                <b>{formatMeters(mine.points * METERS_PER_POINT)}</b>
                <span>{tn('chest.myShare', { percent: Math.max(1, Math.round((mine.points / Math.max(1, chest.points)) * 100)) })}</span>
              </div>
              <div className="chest-me-rewards">
                {chest.tier > 0 && (
                  <span className="chest-me-now">
                    {tn('chest.myNow')}
                    <b>
                      +{chest.rewards[chest.tier - 1]}
                      <CoinIcon size={16} />
                    </b>
                  </span>
                )}
                {next !== null && (
                  <span className="chest-me-next">
                    {tn('chest.myNext')}
                    <b>
                      +{chest.rewards[chest.tier]}
                      <CoinIcon size={16} />
                    </b>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="clan-empty" style={{ padding: '4px 0 2px' }}>{tn('chest.myNone')}</div>
          )}
        </div>
      )}

      <div className="clan-card">
        <div className="clan-card-title">{tn('race.contribution')}</div>
        {chest.contributors.length === 0 ? (
          <div className="clan-empty" style={{ padding: '14px 0' }}>
            {isMember ? tn('chest.emptyMember') : tn('chest.emptyOther')}
          </div>
        ) : (
          chest.contributors.map((c, i) => (
            <div key={c.userId} className={`clan-member-row${c.userId === user?.id ? ' me' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
              <div className="avatar clan-member-avatar" style={{ cursor: 'default' }}>
                {c.avatarUrl ? <img src={thumbUrl(c.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : c.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="clan-member-name">
                  {c.displayName}
                  {i === 0 && chest.contributors.length > 1 && <span className="clan-mvp">{tn('chest.mvp')}</span>}
                  {c.userId === user?.id && <span className="clan-you">{tn('chest.you')}</span>}
                </div>
                <div className="clan-contrib-bar">
                  <div className="clan-contrib-fill" style={{ transform: `scaleX(${c.points / maxPoints})`, animationDelay: `${Math.min(i, 12) * 50}ms` }} />
                </div>
              </div>
              <div className="clan-member-stats">
                <b>{c.points * METERS_PER_POINT}</b>
                <span>{tn('fmt.m')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
