'use client'

import { C2Avatar, C2Bar, C2Card, C2Coins, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { canManage, claimQuest, useDemoState } from '@/lib/clan2/demoStore'
import { fmt } from '@/lib/clan2/rules'
import type { QuestKind } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// «Неделя»: what the whole clan does together this week — one task for everybody,
// and the friends invited to the clan.

export function questLabel(kind: QuestKind, n: number, param?: number): string {
  switch (kind) {
    case 'catches':
      return tn('clan2.week.q_catches', { n })
    case 'species':
      return tn('clan2.week.q_species', { n })
    case 'rare':
      return tn('clan2.week.q_rare', { n })
    case 'big':
      return tn('clan2.week.q_big', { n: param ?? 60 })
    case 'length':
      return tn('clan2.week.q_length', { n })
    case 'members':
      return tn('clan2.week.q_members', { n })
    case 'days':
      return tn('clan2.week.q_days', { n })
    case 'sectors':
      return tn('clan2.week.q_sectors', { n })
  }
}

export function WeekTab() {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const manage = canManage(s)
  const q = s.quest
  const done = q.progress >= q.target
  const claimed = q.claimed
  const helpers = s.members.filter((m) => (q.helpers ?? []).includes(m.id))
  const by = s.members.find((m) => m.id === q.claimedBy)

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.week.questTitle')} hint={tn('clan2.week.questHint')} tour="week-quest" focus="quest">
        {/* Like a finished challenge: a done task keeps its card, tinted, with a tick, and says what it brought. */}
        <div className={`c2-quest${claimed ? ' claimed' : done ? ' ready' : ''}`}>
          {claimed && (
            <span className="c2-quest-badge" aria-label={tn('clan2.week.doneTitle')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          )}
          <div className="c2-quest-head">
            <strong>{questLabel(q.kind, q.target, q.param)}</strong>
            {!claimed && (
              <span className="c2-quest-prize" title={tn('clan2.week.reward', { n: fmt(q.reward) })}>
                <C2Coins n={q.reward} sign />
              </span>
            )}
          </div>
          {(claimed || done) && <div className="c2-quest-state">{claimed ? tn('clan2.week.doneTitle') : tn('clan2.week.readyTitle')}</div>}
          <div className="c2-quest-count">
            <b>{Math.round(Math.min(q.progress, q.target) * 10) / 10}</b>
            <span>/ {q.target}</span>
          </div>
          <C2Bar value={q.progress / q.target} tone={claimed ? 'good' : 'accent'} label={questLabel(q.kind, q.target, q.param)} />
          <div className="c2-goal-foot">
            <span className="c2-muted">{claimed ? tn('clan2.week.nextIn', { t: fmtLeft(q.endsAt - now) }) : tn('clan2.week.endsIn', { t: fmtLeft(q.endsAt - now) })}</span>
          </div>
          {claimed && (
            <div className="c2-quest-facts">
              <span className="challenge-fact paid">
                {tn('clan2.week.paidTo')}
                <b>
                  <C2Coins n={q.reward} sign />
                </b>
              </span>
              {by && <span className="challenge-fact">{tn('clan2.week.claimedBy', { name: by.name })}</span>}
            </div>
          )}
          {helpers.length > 0 && (
            <div className="c2-quest-helpers">
              <span className="c2-quest-helpers-faces" aria-hidden>
                {helpers.slice(0, 6).map((m) => (
                  <C2Avatar key={m.id} member={m} size={24} />
                ))}
                {helpers.length > 6 && <i>+{helpers.length - 6}</i>}
              </span>
              <span className="c2-muted small">{tn('clan2.week.helpers', { count: helpers.length })}</span>
            </div>
          )}
        </div>
        {!claimed &&
          (done ? (
            manage ? (
              <button className="btn-primary c2-quest-claim" onClick={() => act(claimQuest(), 'questClaimed')}>
                {tn('clan2.week.claimFor', { n: fmt(q.reward) })}
              </button>
            ) : (
              <p className="c2-quest-left ready">{tn('clan2.week.claimLeader')}</p>
            )
          ) : (
            <p className="c2-quest-left">{tn('clan2.week.left', { n: Math.ceil((q.target - q.progress) * 10) / 10 })}</p>
          ))}
      </C2Card>

      <C2Card title={tn('clan2.week.recruitTitle')} hint={tn('clan2.week.recruitHint', { n: s.settings.recruitReward })} tour="week-recruit">
        {s.recruit.length === 0 ? (
          <p className="c2-muted">{tn('clan2.week.recruitNone')}</p>
        ) : (
          <ul className="c2-recruits">
            {s.recruit.map((r) => (
              <li key={r.name}>
                <span className="c2-name">{r.name}</span>
                <span className="c2-steps" aria-hidden>
                  {(['invited', 'joined', 'caught', 'paid'] as const).map((st, i) => (
                    <i key={st} className={['invited', 'joined', 'caught', 'paid'].indexOf(r.state) >= i ? 'on' : undefined} />
                  ))}
                </span>
                <span className={`c2-chip ${r.state === 'paid' ? 'accent' : ''}`}>
                  {r.state === 'invited' ? tn('clan2.week.recruitInvited') : r.state === 'joined' ? tn('clan2.week.recruitJoined') : r.state === 'caught' ? tn('clan2.week.recruitCaught') : tn('clan2.week.recruitPaid')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </C2Card>
    </div>
  )
}
