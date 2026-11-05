'use client'

import '../clan2.css'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { C2ToastProvider, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { ClanScreen2 } from '@/components/clan2/ClanScreen2'
import {
  advanceTime,
  attackHq,
  attackSector,
  defendHq,
  leaderAway,
  recruitCatch,
  resetDemo,
  setPersona,
  settleWeek,
  simulateCatch,
  tick,
  toggleHot,
  useDemoState,
} from '@/lib/clan2/demoStore'
import { HOURS } from '@/lib/clan2/rules'
import type { Persona } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'
import { speciesName } from '@/components/clan2/C2Common'

// The shell of the demo: a control panel on the left (who you are, the clock,
// things that happen), a phone with the app on the right. On a phone-sized
// window the frame goes away and the panel folds above the screen.

type Tab = 'map' | 'clan' | 'profile' | 'admin'
const noop = () => () => {}

export function ClanPreview() {
  // Rendered on the client only: the demo's world is read from localStorage.
  const ready = useSyncExternalStore(noop, () => true, () => false)
  if (!ready) return null
  return (
    <C2ToastProvider>
      <Shell />
    </C2ToastProvider>
  )
}

function Shell() {
  const s = useDemoState()
  const [tab, setTab] = useState<Tab>('clan')
  const now = useDemoNow()

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const current: Tab = tab === 'admin' && s.persona !== 'admin' ? 'clan' : tab
  const tabs: Tab[] = s.persona === 'admin' ? ['map', 'clan', 'profile', 'admin'] : ['map', 'clan', 'profile']
  const unread = s.alerts.filter((a) => !a.read).length
  const clock = new Date(now).toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

  let body: ReactNode
  if (current === 'clan') body = <ClanScreen2 />
  else body = <div className="c2-pad c2-muted">…</div>

  return (
    <div className="c2-stage">
      <DemoPanel clock={clock} />
      <div className="c2-phone-wrap">
        <div className="c2-phone">
          <div className="c2-status" aria-hidden>
            <span>{new Date(now).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>RANGE</span>
          </div>
          <div className="c2-phone-body" key={current}>
            {body}
          </div>
          <nav className="c2-tabbar" aria-label="RANGE">
            {tabs.map((t) => (
              <button key={t} className={current === t ? 'on' : undefined} onClick={() => setTab(t)} data-tour={`tab-${t}`}>
                {tn(`clan2.tab.${t}`)}
                {t === 'clan' && unread > 0 && <i className="c2-badge">{unread}</i>}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

const PERSONAS: Persona[] = ['leader', 'member', 'solo', 'admin']
const PERSONA_KEY = { leader: 'roleLeader', member: 'roleMember', solo: 'roleSolo', admin: 'roleAdmin' } as const

function DemoPanel({ clock }: { clock: string }) {
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
    <aside className="c2-panel">
      <h1>{tn('clan2.demo.title')}</h1>
      <p className="c2-muted small">{tn('clan2.demo.note')}</p>

      <h2>{tn('clan2.demo.role')}</h2>
      <div className="c2-seg c2-seg-wrap">
        {PERSONAS.map((p) => (
          <button key={p} className={s.persona === p ? 'on' : undefined} onClick={() => setPersona(p)}>
            {tn(`clan2.demo.${PERSONA_KEY[p]}`)}
          </button>
        ))}
      </div>

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
        <button
          className="btn-secondary"
          onClick={() => {
            resetDemo()
            say(tn('clan2.demo.resetDone'))
          }}
        >
          {tn('clan2.demo.reset')}
        </button>
      </div>
    </aside>
  )
}
