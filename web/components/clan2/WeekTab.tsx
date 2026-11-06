'use client'

import { C2Bar, C2Card, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { canManage, claimQuest, useDemoState } from '@/lib/clan2/demoStore'
import { fmt } from '@/lib/clan2/rules'
import type { QuestKind } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// «Неделя»: what the whole clan does together this week — one task for everybody,
// and the friends invited to the clan.

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
  const q = s.quest
  const done = q.progress >= q.target

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
          <button className="btn-primary" disabled={!done || !manage} onClick={() => act(claimQuest(), 'questClaimed')}>
            {manage ? tn('clan2.week.claim') : tn('clan2.week.claimLeader')}
          </button>
        )}
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
                <span className={`c2-chip ${r.state === 'paid' ? 'good' : ''}`}>
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
