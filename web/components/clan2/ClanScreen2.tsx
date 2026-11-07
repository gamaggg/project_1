'use client'

import { useState, type ReactNode } from 'react'
import { ClanHero } from '@/components/app-shell/ClanHero'
import { ExitTab } from '@/components/clan2/ExitTab'
import { GloryTab } from '@/components/clan2/GloryTab'
import { HqTab, type MapFocus } from '@/components/clan2/HqTab'
import { MembersTab } from '@/components/clan2/MembersTab'
import { WeekTab } from '@/components/clan2/WeekTab'
import { TreasuryTab } from '@/components/clan2/TreasuryTab'
import { C2Bar, useC2 } from '@/components/clan2/C2Common'
import { inClan, joinDemoClan, useDemoState } from '@/lib/clan2/demoStore'
import { CLAN_LEVEL_XP, clanCapacity, leagueFor } from '@/lib/data/clanLevels'
import { tn } from '@/lib/i18n/runtime'

// The clan screen of the update: the banner of the clan and, under it, the
// sections — Общак, Выход, Неделя, Штаб, Слава, Участники. A player with no
// clan sees what joining gives instead.

export type SubTab = 'treasury' | 'exit' | 'week' | 'hq' | 'glory' | 'members'
const SUBS: SubTab[] = ['treasury', 'exit', 'week', 'hq', 'glory', 'members']

export function ClanScreen2({ sections, onOpenSector, onGoMap, sub: subProp, onSub }: { sections?: Partial<Record<SubTab, ReactNode>>; onOpenSector?: (id: string) => void; onGoMap?: (focus?: MapFocus) => void; sub?: SubTab; onSub?: (sub: SubTab) => void }) {
  const s = useDemoState()
  const { act } = useC2()
  const [subOwn, setSubOwn] = useState<SubTab>('treasury')
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
          <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? 'on' : undefined} onClick={() => setSub(id)} data-tour={`sub-${id}`}>
            {tn(`clan2.sub.${id}`)}
          </button>
        ))}
      </nav>
      <div className="c2-pad">{body[sub]}</div>
    </div>
  )
}
