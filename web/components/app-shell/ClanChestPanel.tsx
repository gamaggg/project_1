'use client'

import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useClanChest } from '@/lib/supabase/queries'
import { ChallengeCountdown } from '@/components/app-shell/ChallengeCountdown'
import { CoinIcon } from '@/components/app-shell/CoinIcon'

const ROMAN = ['I', 'II', 'III', 'IV', 'V']

// A small treasure chest — grey while locked, wood and gold once its tier is
// reached; the fifth one is the golden one.
function ChestIcon({ state, legendary }: { state: 'locked' | 'open' | 'next'; legendary?: boolean }) {
  const reached = state === 'open'
  const body = reached ? (legendary ? '#C9861A' : '#8B5A2B') : '#D5D2CB'
  const lid = reached ? (legendary ? '#E2A43A' : '#A5692F') : '#E4E1DA'
  const band = reached ? (legendary ? '#FFE08A' : '#E0A63A') : '#C3C0B8'
  return (
    <svg viewBox="0 0 48 44" width="44" height="40" aria-hidden>
      <path d="M6 17C6 9 12 4 24 4s18 5 18 13Z" fill={lid} />
      <rect x="6" y="17" width="36" height="23" rx="4" fill={body} />
      <rect x="6" y="17" width="36" height="4" fill={band} />
      <rect x="12" y="5" width="4" height="35" fill={band} opacity={0.9} />
      <rect x="32" y="5" width="4" height="35" fill={band} opacity={0.9} />
      <rect x="20" y="19" width="8" height="10" rx="2" fill={reached ? '#FFE7BE' : '#B8B5AD'} />
      <circle cx="24" cy="23.5" r="1.6" fill={body} />
      {reached && <path d="M9 12c2-3 5-4.6 9-5.2" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" fill="none" />}
    </svg>
  )
}

// Where `points` sits on a track whose 5 stops are the tier thresholds,
// spaced evenly — so each chest sits at the same place however far apart
// the thresholds themselves are.
function trackFraction(points: number, thresholds: number[]): number {
  if (!thresholds.length) return 0
  let prev = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (points < thresholds[i]) {
      const within = (points - prev) / (thresholds[i] - prev)
      return (i + Math.max(0, Math.min(1, within))) / thresholds.length
    }
    prev = thresholds[i]
  }
  return 1
}

export function ClanChestPanel({ clanId, isMember }: { clanId: number; isMember: boolean }) {
  const { data: chest, isLoading } = useClanChest(clanId)
  if (isLoading || !chest) return <div className="clan-soon">{isLoading ? 'Загрузка…' : 'Нет данных'}</div>

  const next = chest.tier < chest.thresholds.length ? chest.thresholds[chest.tier] : null
  const fraction = trackFraction(chest.points, chest.thresholds)
  const maxPoints = Math.max(1, ...chest.contributors.map((c) => c.points))

  return (
    <div className="clan-tab-body">
      <div className="clan-chest-card">
        <div className="clan-chest-head">
          <div>
            <div className="clan-chest-kicker">Сундук недели</div>
            <div className="clan-chest-points">
              <b>{chest.points}</b> {chest.points === 1 ? 'очко' : chest.points % 10 >= 2 && chest.points % 10 <= 4 && (chest.points % 100 < 12 || chest.points % 100 > 14) ? 'очка' : 'очков'}
            </div>
          </div>
          <ChallengeCountdown endsAt={chest.weekEnd} />
        </div>

        <div className="clan-chest-track">
          <div className="clan-chest-bar">
            <div className="clan-chest-fill" style={{ transform: `scaleX(${fraction})` }} />
          </div>
          <div className="clan-chest-stops">
            {chest.thresholds.map((t, i) => {
              const state = i < chest.tier ? 'open' : i === chest.tier ? 'next' : 'locked'
              return (
                <div key={i} className={`clan-chest-stop ${state}`} style={{ animationDelay: `${i * 70}ms` }}>
                  <ChestIcon state={state} legendary={i === 4} />
                  <span className="clan-chest-roman">{ROMAN[i]}</span>
                  <span className="clan-chest-threshold">{t}</span>
                  <span className="clan-chest-reward">
                    <CoinIcon size={16} />
                    {chest.rewards[i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="clan-chest-status">
          {chest.tier === 0
            ? `До первого сундука ${next! - chest.points} очк.`
            : next === null
              ? 'Все 5 сундуков открыты — максимум недели!'
              : `Открыто ${chest.tier} из 5 · до следующего ${next - chest.points} очк.`}
        </div>
        <div className="clan-chest-rules">
          <span>Улов <b>+1</b></span>
          <span>Захват <b>+3</b></span>
          <span>Челлендж <b>+2</b></span>
        </div>
        <div className="clan-chest-note">
          В ночь на понедельник каждый, кто принёс хотя бы 1 очко, получит монеты за самый большой открытый сундук. Пороги растут вместе с числом участников.
        </div>
        {chest.lastWeek && (
          <div className="clan-chest-last">
            Прошлая неделя: {chest.lastWeek.tier > 0 ? `сундук ${ROMAN[chest.lastWeek.tier - 1]}, ${chest.lastWeek.points} очк.` : 'сундук не открыли'}
          </div>
        )}
      </div>

      <div className="clan-card">
        <div className="clan-card-title">Вклад участников</div>
        {chest.contributors.length === 0 ? (
          <div className="clan-empty" style={{ padding: '14px 0' }}>
            {isMember ? 'Пока ни одного очка на этой неделе — лови и захватывай!' : 'На этой неделе клан ещё не набрал очков'}
          </div>
        ) : (
          chest.contributors.map((c, i) => (
            <div key={c.userId} className="clan-member-row" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
              <div className="avatar clan-member-avatar" style={{ cursor: 'default' }}>
                {c.avatarUrl ? <img src={thumbUrl(c.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : c.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="clan-member-name">{c.displayName}</div>
                <div className="clan-contrib-bar">
                  <div className="clan-contrib-fill" style={{ transform: `scaleX(${c.points / maxPoints})`, animationDelay: `${Math.min(i, 12) * 50}ms` }} />
                </div>
              </div>
              <div className="clan-member-stats">
                <b>{c.points}</b>
                <span>очк.</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
