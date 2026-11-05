'use client'

import { useState } from 'react'
import { C2Avatar, C2Card, C2Coins, C2Sheet, fmtAgo, useC2 } from '@/components/clan2/C2Common'
import { isLeader, meOf, nudge, transferLeadership, useDemoState } from '@/lib/clan2/demoStore'
import type { ClanRole } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// «Участники»: who is in the clan, how active, the leader's tools (calling a
// member to the water, handing leadership over) and how a clan is disbanded.

const ROLE_KEY: Record<ClanRole, 'roleLeader' | 'roleCo' | 'roleElder' | 'roleMember'> = { leader: 'roleLeader', co_leader: 'roleCo', elder: 'roleElder', member: 'roleMember' }
const AWAY_MIN = 14 * 24 * 60

export function MembersTab() {
  const s = useDemoState()
  const { act, say } = useC2()
  const me = meOf(s)
  const canNudge = !!me && me.role !== 'member'
  const [handOver, setHandOver] = useState<string | null>(null)
  const [disband, setDisband] = useState(false)
  const target = s.members.find((m) => m.id === handOver)
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

      <C2Card title={tn('clan2.members.leadTitle')} hint={tn('clan2.members.leadHint')} tour="members-lead">
        {isLeader(s) ? (
          <div className="c2-row-btns" style={{ flexDirection: 'column' }}>
            {s.members
              .filter((m) => m.role === 'co_leader' || m.role === 'elder')
              .map((m) => (
                <button key={m.id} className="btn-secondary" onClick={() => setHandOver(m.id)}>
                  {tn('clan2.members.transfer', { name: m.name })}
                </button>
              ))}
          </div>
        ) : null}
        <button className="c2-link" style={{ marginTop: 10 }} onClick={() => setDisband(true)}>
          {tn('clan2.members.disbandBtn')}
        </button>
      </C2Card>

      <C2Sheet open={!!target} onClose={() => setHandOver(null)} title={tn('clan2.members.leadTitle')}>
        <p className="c2-muted">{tn('clan2.members.transferAsk', { name: target?.name ?? '' })}</p>
        <div className="c2-row-btns">
          <button className="btn-secondary" onClick={() => setHandOver(null)}>
            {tn('clan2.members.cancel')}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (target && act(transferLeadership(target.id), 'leaderMoved')) setHandOver(null)
            }}
          >
            {tn('clan2.members.confirm')}
          </button>
        </div>
      </C2Sheet>

      <C2Sheet open={disband} onClose={() => setDisband(false)} title={tn('clan2.members.disbandTitle')}>
        <p className="c2-muted">{tn('clan2.members.disbandHint')}</p>
        <button className="btn-secondary" onClick={() => setDisband(false)}>
          {tn('clan2.members.cancel')}
        </button>
      </C2Sheet>
    </div>
  )
}
