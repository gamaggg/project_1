'use client'

import { useC2, speciesName } from '@/components/clan2/C2Common'
import {
  advanceTime,
  attackHq,
  attackSector,
  defendHq,
  leaderAway,
  othersRsvp,
  recruitCatch,
  resetDemo,
  setPersona,
  setViewAs,
  settleWeek,
  simulateCatch,
  toggleHot,
  useDemoState,
} from '@/lib/clan2/demoStore'
import { HOURS } from '@/lib/clan2/rules'
import type { Persona } from '@/lib/clan2/types'
import type { Lang } from '@/lib/i18n/core'
import { tn } from '@/lib/i18n/runtime'

const PERSONAS: Persona[] = ['leader', 'member', 'solo', 'admin']
const PERSONA_KEY = { leader: 'roleLeader', member: 'roleMember', solo: 'roleSolo', admin: 'roleAdmin' } as const

export type DemoPanelProps = {
  clock: string
  lang?: Lang
  onLang?: (l: Lang) => void
  onTour?: () => void
  // Live mode (the real clan, in the real app): no language/persona switch of the fictional clan, the role is a «look as».
  live?: boolean
  onResetLive?: () => void
  onOff?: () => void
}

export function DemoPanel({ clock, lang, onLang, onTour, live, onResetLive, onOff }: DemoPanelProps) {
  const s = useDemoState()
  const { act, say } = useC2()

  const catchBy = (own: boolean) => {
    const res = simulateCatch(own ? { memberId: s.myId } : {})
    if (!res.ok || !res.summary) {
      act(res)
      return
    }
    const x = res.summary
    const parts = [tn('clan2.demo.caught', { member: x.member, species: speciesName(x.species), cm: x.cm })]
    if (x.tax > 0) parts.push(tn('clan2.demo.taxed', { n: x.tax }))
    if (x.bounty > 0) parts.push(tn('clan2.demo.bountyDone', { n: x.bounty }))
    if (x.record) parts.push(tn('clan2.demo.recordSet'))
    say(parts.join(' · '))
  }
  const shift = (ms: number) => {
    advanceTime(ms)
    say(tn('clan2.demo.timeShift'))
  }

  return (
    <aside className={`c2-panel${live ? ' c2-panel-live' : ''}`}>
      {!live && (
        <>
          <h1>{tn('clan2.demo.title')}</h1>
          <p className="c2-muted small">{tn('clan2.demo.note')}</p>
        </>
      )}

      {live ? (
        <>
          <p className="c2-live-note">{tn('clan2.demo.liveNote')}</p>
          <h2>{tn('clan2.demo.viewAs')}</h2>
          <div className="c2-seg c2-seg-wrap">
            <button className={!s.live?.viewAs && s.persona !== 'admin' ? 'on' : undefined} onClick={() => act(setViewAs(null))}>
              {tn('clan2.demo.asIs')}
            </button>
            <button className={s.live?.viewAs === 'leader' && s.persona !== 'admin' ? 'on' : undefined} onClick={() => act(setViewAs('leader'))}>
              {tn('clan2.demo.roleLeader')}
            </button>
            <button className={s.live?.viewAs === 'member' && s.persona !== 'admin' ? 'on' : undefined} onClick={() => act(setViewAs('member'))}>
              {tn('clan2.demo.roleMember')}
            </button>
            {s.live?.isSuperAdmin && (
              <button className={s.persona === 'admin' ? 'on' : undefined} onClick={() => act(setViewAs('admin'))}>
                {tn('clan2.demo.roleAdmin')}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <h2>{tn('clan2.demo.lang')}</h2>
          <div className="c2-seg">
            {(['ru', 'en', 'ka'] as const).map((l) => (
              <button key={l} className={lang === l ? 'on' : undefined} onClick={() => onLang?.(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <h2>{tn('clan2.demo.role')}</h2>
          <div className="c2-seg c2-seg-wrap">
            {PERSONAS.map((p) => (
              <button key={p} className={s.persona === p ? 'on' : undefined} onClick={() => setPersona(p)}>
                {tn(`clan2.demo.${PERSONA_KEY[p]}`)}
              </button>
            ))}
          </div>
        </>
      )}

      <h2>
        {tn('clan2.demo.time')} · <span className="c2-clock">{clock}</span>
      </h2>
      <div className="c2-panel-row">
        <button className="btn-secondary" onClick={() => shift(30 * 60_000)}>
          {tn('clan2.demo.t30')}
        </button>
        <button className="btn-secondary" onClick={() => shift(2 * HOURS)}>
          {tn('clan2.demo.t2h')}
        </button>
        <button className="btn-secondary" onClick={() => shift(24 * HOURS)}>
          {tn('clan2.demo.t1d')}
        </button>
      </div>

      <h2>{tn('clan2.demo.events')}</h2>
      <div className="c2-panel-col">
        <button className="btn-secondary" onClick={() => catchBy(false)}>
          {tn('clan2.demo.evCatch')}
        </button>
        <button className="btn-secondary" onClick={() => catchBy(true)} disabled={s.persona === 'solo'}>
          {tn('clan2.demo.evCatchMe')}
        </button>
        <button className="btn-secondary" onClick={() => (attackSector(), say(tn('clan2.demo.attackDone')))}>
          {tn('clan2.demo.evAttackSector')}
        </button>
        <button className="btn-secondary" onClick={() => act(attackHq())}>
          {tn('clan2.demo.evAttackHq')}
        </button>
        <button className="btn-secondary" onClick={() => act(defendHq())}>
          {tn('clan2.demo.evDefendHq')}
        </button>
        <button className="btn-secondary" onClick={() => (settleWeek(), say(tn('clan2.demo.settled')))}>
          {tn('clan2.demo.evSettle')}
        </button>
        <button className="btn-secondary" onClick={() => act(othersRsvp(3))}>
          {tn('clan2.demo.evRsvp')}
        </button>
        <button className="btn-secondary" onClick={() => act(recruitCatch())}>
          {tn('clan2.demo.evRecruit')}
        </button>
        <button className="btn-secondary" onClick={() => (toggleHot(s.sectors.find((x) => x.owner === 'mine' && x.hq !== 'mine')?.id ?? ''), say(tn('clan2.demo.hotDone')))}>
          {tn('clan2.demo.evHot')}
        </button>
        <button className="btn-secondary" onClick={() => (leaderAway(), say(tn('clan2.demo.leaderGone')))}>
          {tn('clan2.demo.evLeaderAway')}
        </button>
      </div>

      <div className="c2-panel-row" style={{ marginTop: 14 }}>
        {onTour && (
          <button className="btn-secondary" onClick={onTour}>
            {tn('clan2.demo.tourAgain')}
          </button>
        )}
        <button
          className="btn-secondary"
          onClick={() => {
            if (live) onResetLive?.()
            else resetDemo()
            say(tn('clan2.demo.resetDone'))
          }}
        >
          {live ? tn('clan2.demo.resetLive') : tn('clan2.demo.reset')}
        </button>
      </div>
      {live && onOff && (
        <button className="c2-link" style={{ marginTop: 10 }} onClick={onOff}>
          {tn('clan2.demo.off')}
        </button>
      )}
    </aside>
  )
}
