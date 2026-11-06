'use client'

import { useState, type ReactNode } from 'react'
import { ClanHero } from '@/components/app-shell/ClanHero'
import { ExitTab } from '@/components/clan2/ExitTab'
import { GloryTab } from '@/components/clan2/GloryTab'
import { HqTab, type MapFocus } from '@/components/clan2/HqTab'
import { HubTab } from '@/components/clan2/HubTab'
import { MembersTab } from '@/components/clan2/MembersTab'
import { WeekTab } from '@/components/clan2/WeekTab'
import { TreasuryTab } from '@/components/clan2/TreasuryTab'
import { C2Bar, useC2 } from '@/components/clan2/C2Common'
import { inClan, joinDemoClan, useDemoState } from '@/lib/clan2/demoStore'
import { CLAN_LEVEL_XP, clanCapacity, leagueFor } from '@/lib/data/clanLevels'
import { tn } from '@/lib/i18n/runtime'

// The clan screen of the update: the banner of the clan and, under it, the
// tabs — Клан (the hub), Общак, База, Люди. A player with no
// clan sees what joining gives instead.

// The four tabs of the clan screen: the hub «Клан», «Общак», «База», «Люди». The older sections (outing, week, hall,
// members) stay addressable for the sandbox's guided tours; on the screen they open from the hub and from «Люди».
export type SubTab = 'hub' | 'treasury' | 'hq' | 'people' | 'exit' | 'week' | 'glory' | 'members'
const SUBS: SubTab[] = ['hub', 'treasury', 'hq', 'people']
const SUB_LABEL: Record<string, string> = { hub: 'clan2.sub.hub', treasury: 'clan2.sub.treasury', hq: 'clan2.sub.base', people: 'clan2.sub.people' }

export function ClanScreen2({ sections, onOpenSector, onGoMap, sub: subProp, onSub }: { sections?: Partial<Record<SubTab, ReactNode>>; onOpenSector?: (id: string) => void; onGoMap?: (focus?: MapFocus) => void; sub?: SubTab; onSub?: (sub: SubTab) => void }) {
  const s = useDemoState()
  const { act } = useC2()
  const [subOwn, setSubOwn] = useState<SubTab>('hub')
  const sub = subProp ?? subOwn
  const setSub = (next: SubTab) => (onSub ? onSub(next) : setSubOwn(next))

  if (!inClan(s)) {
    return (
      <div className="c2-pad c2-stack">
        <div className="c2-solo">
          <div className="c2-solo-title">{tn('clan2.solo.title')}</div>
          <p>{tn('clan2.solo.text')}</p>
          <ul>
            <li>{tn('clan2.solo.p1')}</li>
            <li>{tn('clan2.solo.p2')}</li>
            <li>{tn('clan2.solo.p3')}</li>
            <li>{tn('clan2.solo.p4')}</li>
          </ul>
          <button className="btn-primary" onClick={() => act(joinDemoClan(), 'joined')}>
            {tn('clan2.solo.join')}
          </button>
        </div>
      </div>
    )
  }

  const level = s.clan.level
  const from = CLAN_LEVEL_XP[level - 1]
  const to = CLAN_LEVEL_XP[level] ?? null
  const league = leagueFor(s.clan.trophies)
  const body: Record<SubTab, ReactNode> = {
    hub: <HubTab onGo={(to) => setSub(to)} onOpenSector={onOpenSector} />,
    people: (
      <div className="c2-stack">
        <MembersTab />
        <GloryTab />
      </div>
    ),
    treasury: (
      <TreasuryTab
        onGo={(to) => {
          if (to === 'map') onGoMap?.({ place: true })
          else setSub(to === 'hq' ? 'hq' : to === 'week' ? 'week' : to === 'exit' ? 'exit' : 'treasury')
        }}
      />
    ),
    exit: <ExitTab onOpenSector={onOpenSector} />,
    week: <WeekTab />,
    hq: <HqTab onGoMap={onGoMap} />,
    glory: <GloryTab />,
    members: <MembersTab />,
    ...sections,
  }

  return (
    <div className="c2-clan">
      <ClanHero crest={s.clan.crest} name={s.clan.name} motto={s.clan.motto} background={s.clan.background} compact>
        <div className="c2-hero-meta">
          <span>{tn('clan2.clan.level', { n: level })}</span>
          <span>{league.label}</span>
          <span>{tn('clan2.clan.members', { n: s.members.length, max: clanCapacity(level) })}</span>
        </div>
        {to !== null && (
          <div className="c2-hero-xp">
            <C2Bar value={(s.clan.xp - from) / (to - from)} tone="warn" label={tn('clan2.clan.xp')} />
            <small>{tn('clan2.clan.xpLeft', { n: to - s.clan.xp })}</small>
          </div>
        )}
      </ClanHero>
      <nav className="c2-subtabs" role="tablist" aria-label={tn('clan2.tab.clan')}>
        {SUBS.map((id) => (
          <button key={id} role="tab" aria-selected={sub === id || (id === 'hub' && (sub === 'exit' || sub === 'week')) || (id === 'people' && (sub === 'glory' || sub === 'members'))} className={sub === id || (id === 'hub' && (sub === 'exit' || sub === 'week')) || (id === 'people' && (sub === 'glory' || sub === 'members')) ? 'on' : undefined} onClick={() => setSub(id)} data-tour={`sub-${id}`}>
            {tn(SUB_LABEL[id] as Parameters<typeof tn>[0])}
          </button>
        ))}
      </nav>
      <div className="c2-pad">{body[sub]}</div>
    </div>
  )
}
