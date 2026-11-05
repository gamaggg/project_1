'use client'

import { useState } from 'react'
import { C2Bar, C2Card, C2Coins, C2Sheet, fmtLeft, speciesName, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { canManage, claimQuest, createBounty, useDemoState } from '@/lib/clan2/demoStore'
import { BOUNTY_DAILY_CAP, DAY, fmt } from '@/lib/clan2/rules'
import type { BountyKind, QuestKind } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// «Неделя»: what the whole clan does together this week — one quest, the
// bounties the leader posts, the tournament of the week's fish, the season and
// the friends invited to the clan.

const BOUNTY_SPECIES = ['katran', 'sibas', 'lufar', 'zubar', 'kefal']
const SIZES = [40, 60, 80]
const REWARDS = [50, 100, 150, 200]

function questLabel(kind: QuestKind, n: number): string {
  switch (kind) {
    case 'catches':
      return tn('clan2.week.q_catches', { n })
    case 'species':
      return tn('clan2.week.q_species', { n })
    case 'capture':
      return tn('clan2.week.q_capture', { n })
    default:
      return tn('clan2.week.q_rare', { n })
  }
}

export function WeekTab() {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const manage = canManage(s)
  const [bountyOpen, setBountyOpen] = useState(false)
  const [kind, setKind] = useState<BountyKind>('species')
  const [species, setSpecies] = useState('katran')
  const [minCm, setMinCm] = useState(60)
  const [reward, setReward] = useState(100)
  const q = s.quest
  const done = q.progress >= q.target
  const maxStanding = Math.max(1, ...s.tournament.standings.map((x) => x.score))
  const standings = [...s.tournament.standings].sort((a, b) => b.score - a.score)
  const week = Math.min(4, Math.floor((now - s.season.startedAt) / (7 * DAY)) + 1)

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.week.questTitle')} hint={tn('clan2.week.questHint')} tour="week-quest">
        <div className="c2-goal-row">
          <strong>{questLabel(q.kind, q.target)}</strong>
        </div>
        <C2Bar value={q.progress / q.target} tone={done ? 'good' : 'accent'} label={questLabel(q.kind, q.target)} />
        <div className="c2-goal-foot">
          <span className="c2-muted">{tn('clan2.week.progress', { a: Math.min(q.progress, q.target), b: q.target })}</span>
          <span className="c2-muted">{tn('clan2.week.endsIn', { t: fmtLeft(q.endsAt - now) })}</span>
        </div>
        <p className="c2-hint" style={{ marginTop: 10 }}>
          {tn('clan2.week.reward', { n: fmt(q.reward) })}
        </p>
        {q.claimed ? (
          <span className="c2-ok">{tn('clan2.week.claimed')}</span>
        ) : (
          <button className="btn-primary" disabled={!done} onClick={() => act(claimQuest(), 'questClaimed')}>
            {tn('clan2.week.claim')}
          </button>
        )}
      </C2Card>

      <C2Card title={tn('clan2.week.bountyTitle')} hint={tn('clan2.week.bountyHint')} tour="week-bounty">
        {s.bounties.length === 0 ? (
          <p className="c2-muted">{tn('clan2.week.bountyNone')}</p>
        ) : (
          <ul className="c2-bounties">
            {s.bounties.map((b) => (
              <li key={b.id} className={b.claimedBy ? 'done' : undefined}>
                <div className="c2-bounty-main">
                  <strong>{b.kind === 'species' ? tn('clan2.week.bountySpecies', { species: speciesName(b.species ?? '') }) : tn('clan2.week.bountySize', { n: b.minCm ?? 0 })}</strong>
                  <span className="c2-muted small">
                    {b.claimedBy ? tn('clan2.week.bountyClaimed', { name: s.members.find((m) => m.id === b.claimedBy)?.name ?? '' }) : tn('clan2.week.bountyLeft', { t: fmtLeft(b.expiresAt - now) })}
                  </span>
                </div>
                <C2Coins n={b.reward} />
              </li>
            ))}
          </ul>
        )}
        {manage && (
          <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setBountyOpen(true)}>
            {tn('clan2.week.bountyNew')}
          </button>
        )}
      </C2Card>

      <C2Card title={tn('clan2.week.tourTitle')} hint={tn('clan2.week.tourHint')} tour="week-tournament">
        <div className="c2-chip accent" style={{ marginBottom: 10 }}>
          {tn('clan2.week.tourFish', { species: speciesName(s.tournament.species) })}
        </div>
        <ul className="c2-standings">
          {standings.map((x, i) => (
            <li key={x.clan} className={x.mine ? 'mine' : undefined}>
              <span className="c2-place">{i + 1}</span>
              <div className="c2-stand-main">
                <div className="c2-stand-top">
                  <span className="c2-name">{x.clan}</span>
                  <span className="c2-muted small">{tn('clan2.week.tourPoints', { n: x.score })}</span>
                </div>
                <C2Bar value={x.score / maxStanding} tone={x.mine ? 'accent' : 'good'} />
              </div>
            </li>
          ))}
        </ul>
        <p className="c2-muted small" style={{ marginTop: 8 }}>
          {tn('clan2.week.endsIn', { t: fmtLeft(s.tournament.endsAt - now) })}
        </p>
      </C2Card>

      <C2Card title={tn('clan2.week.seasonTitle', { n: s.season.n })} hint={tn('clan2.week.seasonHint')} tour="week-season">
        <div className="c2-chips-row">
          <span className="c2-chip">{tn('clan2.week.seasonWeek', { a: week })}</span>
          <span className="c2-chip accent">{tn('clan2.week.seasonTrophies', { n: s.season.trophies })}</span>
        </div>
        <C2Bar value={Math.min(1, (now - s.season.startedAt) / (s.season.endsAt - s.season.startedAt))} tone="warn" />
        <p className="c2-muted small" style={{ marginTop: 8 }}>
          {tn('clan2.week.seasonLeft', { t: fmtLeft(s.season.endsAt - now) })}
        </p>
      </C2Card>

      <C2Card title={tn('clan2.week.recruitTitle')} hint={tn('clan2.week.recruitHint')} tour="week-recruit">
        <ul className="c2-recruits">
          {s.recruit.map((r) => (
            <li key={r.name}>
              <span className="c2-name">{r.name}</span>
              <span className="c2-steps" aria-hidden>
                {(['invited', 'joined', 'caught', 'paid'] as const).map((st, i) => (
                  <i key={st} className={['invited', 'joined', 'caught', 'paid'].indexOf(r.state) >= i ? 'on' : undefined} />
                ))}
              </span>
              <span className={`c2-chip ${r.state === 'paid' ? 'good' : ''}`}>
                {r.state === 'invited' ? tn('clan2.week.recruitInvited') : r.state === 'joined' ? tn('clan2.week.recruitJoined') : r.state === 'caught' ? tn('clan2.week.recruitCaught') : tn('clan2.week.recruitPaid')}
              </span>
            </li>
          ))}
        </ul>
      </C2Card>

      <C2Sheet open={bountyOpen} onClose={() => setBountyOpen(false)} title={tn('clan2.week.bountyNew')}>
        <div className="c2-label" style={{ margin: 0 }}>
          {tn('clan2.week.bountyKind')}
        </div>
        <div className="c2-seg">
          <button className={kind === 'species' ? 'on' : undefined} onClick={() => setKind('species')}>
            {tn('clan2.week.bountyKindSpecies')}
          </button>
          <button className={kind === 'size' ? 'on' : undefined} onClick={() => setKind('size')}>
            {tn('clan2.week.bountyKindSize')}
          </button>
        </div>
        {kind === 'species' ? (
          <>
            <div className="c2-label">{tn('clan2.week.bountyPick')}</div>
            <div className="c2-presets">
              {BOUNTY_SPECIES.map((k) => (
                <button key={k} className={`filter-chip${species === k ? ' active' : ''}`} onClick={() => setSpecies(k)}>
                  {speciesName(k)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="c2-label">{tn('clan2.week.bountyMinCm')}</div>
            <div className="c2-presets">
              {SIZES.map((n) => (
                <button key={n} className={`filter-chip${minCm === n ? ' active' : ''}`} onClick={() => setMinCm(n)}>
                  {n}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="c2-label">{tn('clan2.week.bountyRewardLabel')}</div>
        <div className="c2-presets">
          {REWARDS.map((n) => (
            <button key={n} className={`filter-chip${reward === n ? ' active' : ''}`} onClick={() => setReward(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="c2-hint faint">{tn('clan2.week.bountyRules')}</p>
        <button
          className="btn-primary"
          disabled={reward > BOUNTY_DAILY_CAP}
          onClick={() => {
            if (act(createBounty({ kind, species: kind === 'species' ? species : undefined, minCm: kind === 'size' ? minCm : undefined, reward }), 'bountyCreated')) setBountyOpen(false)
          }}
        >
          {tn('clan2.week.bountyPost', { n: reward })}
        </button>
      </C2Sheet>
    </div>
  )
}
