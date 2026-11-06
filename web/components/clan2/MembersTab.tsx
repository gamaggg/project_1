'use client'

import { C2Avatar, C2Card, C2Coins, fmtAgo, useC2 } from '@/components/clan2/C2Common'
import { meOf, nudge, useDemoState } from '@/lib/clan2/demoStore'
import type { ClanRole } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// «Участники»: who is in the clan, how active, and the tool to call a member to the water.
// Handing leadership over and disbanding are in the FAQ and the real clan screen, not here.

const ROLE_KEY: Record<ClanRole, 'roleLeader' | 'roleCo' | 'roleElder' | 'roleMember'> = { leader: 'roleLeader', co_leader: 'roleCo', elder: 'roleElder', member: 'roleMember' }
const AWAY_MIN = 14 * 24 * 60

export function MembersTab() {
  const s = useDemoState()
  const { act, say } = useC2()
  const me = meOf(s)
  const canNudge = !!me && me.role !== 'member'
  const order = { leader: 0, co_leader: 1, elder: 2, member: 3 } as const
  const list = [...s.members].sort((a, b) => order[a.role] - order[b.role] || b.weekMeters - a.weekMeters)

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.members.title')} hint={canNudge ? tn('clan2.members.nudgeHint') : undefined} tour="members-list">
        <ul className="c2-members">
          {list.map((m) => {
            const away = m.lastCatchMin !== null && m.lastCatchMin >= AWAY_MIN
            return (
              <li key={m.id}>
                <span className="c2-avatar-wrap">
                  <C2Avatar member={m} size={38} />
                  {m.online && <i className="c2-online" title={tn('clan2.members.online')} />}
                </span>
                <div className="c2-member-main">
                  <div className="c2-member-top">
                    <span className="c2-name">
                      {m.name}
                      {m.id === s.myId && <em className="c2-you">{tn('clan2.treasury.you')}</em>}
                    </span>
                    <span className={`c2-role ${m.role}`}>{tn(`clan2.members.${ROLE_KEY[m.role]}`)}</span>
                  </div>
                  <div className="c2-muted small">
                    {away ? tn('clan2.members.away') : m.lastCatchMin === null ? tn('clan2.time.never') : fmtAgo(m.lastCatchMin * 60_000)}
                    {m.weekDeposit > 0 && (
                      <>
                        {' · '}
                        <C2Coins n={m.weekDeposit} />
                      </>
                    )}
                  </div>
                </div>
                {canNudge && m.id !== s.myId && !m.online && (
                  <button className="c2-link" onClick={() => act(nudge(m.id), undefined) && say(tn('clan2.ok.nudged', { name: m.name }))}>
                    {tn('clan2.members.nudge')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </C2Card>

    </div>
  )
}
