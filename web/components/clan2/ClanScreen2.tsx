'use client'

import { useState, type ReactNode } from 'react'
import { ClanGroupIcon, type ClanGroupId } from '@/components/clan2/ClanGroupIcon'
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
// sections in pairs — Общак + Штаб, Выход + Неделя, Участники + Слава. A player with no
// clan sees what joining gives instead.

export type SubTab = 'treasury' | 'exit' | 'week' | 'hq' | 'glory' | 'members'
// The sections pair up under tabs, each with a two-way switch inside (the clan battle and the chest, the live
// app's fourth pair, need a real clan and are not in the sandbox).
const GROUPS: { id: ClanGroupId; label: string; subs: [SubTab, SubTab] }[] = [
  { id: 'money', label: 'clan2.sub.treasury', subs: ['treasury', 'hq'] },
  { id: 'outing', label: 'clan2.sub.exit', subs: ['exit', 'week'] },
  { id: 'people', label: 'clan2.sub.people', subs: ['members', 'glory'] },
]
const PART_LABEL: Record<SubTab, string> = {
  treasury: 'clan2.sub.treasury',
  hq: 'clan2.sub.hq',
  exit: 'clan2.sub.exit',
  week: 'clan2.sub.week',
  members: 'guest.members',
  glory: 'clan2.sub.glory',
}
type TKey = Parameters<typeof tn>[0]

export function ClanScreen2({ sections, onOpenSector, onGoMap, sub: subProp, onSub }: { sections?: Partial<Record<SubTab, ReactNode>>; onOpenSector?: (id: string) => void; onGoMap?: (focus?: MapFocus) => void; sub?: SubTab; onSub?: (sub: SubTab) => void }) {
  const s = useDemoState()
  const { act } = useC2()
  const [subOwn, setSubOwn] = useState<SubTab>('treasury')
  const sub = subProp ?? subOwn
  const setSub = (next: SubTab) => (onSub ? onSub(next) : setSubOwn(next))
  const group = GROUPS.find((g) => g.subs.includes(sub)) ?? GROUPS[0]
  // The part last opened in each pair, so a tab reopens where the player left it.
  const [lastPart, setLastPart] = useState<Record<string, SubTab>>({})

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
      <nav className="c2-subtabs c2-groups-nav" role="tablist" aria-label={tn('clan2.tab.clan')}>
        {GROUPS.map((g) => (
          <button key={g.id} role="tab" aria-selected={group.id === g.id} className={group.id === g.id ? 'on' : undefined} onClick={() => setSub(group.id === g.id ? sub : (lastPart[g.id] ?? g.subs[0]))} data-tour={`sub-${g.subs[0]}`}>
            <ClanGroupIcon id={g.id} />
            <span>{tn(g.label as TKey)}</span>
          </button>
        ))}
      </nav>
      <div className="c2-pad">
        <div className="c2-pair" role="tablist">
          {group.subs.map((part) => (
            <button
              key={part}
              role="tab"
              aria-selected={sub === part}
              className={sub === part ? 'on' : undefined}
              onClick={() => {
                setLastPart((was) => ({ ...was, [group.id]: part }))
                setSub(part)
              }}
            >
              {tn(PART_LABEL[part] as TKey)}
            </button>
          ))}
        </div>
        {body[sub]}
      </div>
    </div>
  )
}
