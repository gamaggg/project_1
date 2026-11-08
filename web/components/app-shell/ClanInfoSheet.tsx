'use client'

import { createPortal } from 'react-dom'
import { useTerritories } from '@/lib/supabase/queries'
import { CLAN_LEVEL_XP, LEAGUES, clanCapacity, clanLevelProgress, leagueFor } from '@/lib/data/clanLevels'
import { CREST_SHAPES, CREST_SYMBOLS } from '@/lib/data/clanCrests'
import { CLAN_BACKGROUNDS } from '@/lib/data/clanBackgrounds'
import { KIND_LABEL } from '@/lib/data/species'
import { sectorCapturer } from '@/lib/data/sectorHolders'
import { tn } from '@/lib/i18n/runtime'
import { BUILD_CLAN_LEVEL, SHOP_ITEMS, fmt, treasuryCap } from '@/lib/clan2/rules'
import type { ClanDetail } from '@/lib/data/types'

export type ClanInfoKind = 'level' | 'league' | 'sectors' | 'race'

// What a clan level brings: more members, new crest shapes, symbols and
// backgrounds (the same `level` fields the editor locks by), the golden
// crest frame at the top. Numbers match public._clan_capacity/_clan_level.
// clan2: the clan update is on — a level also raises the treasury's cap, opens the next level of the base's
// buildings and items of the clan shop (lib/clan2/rules.ts).
function levelPerks(level: number, clan2 = false): string[] {
  const perks: string[] = []
  const capacity = clanCapacity(level)
  if (level === 1) perks.push(tn('clanInfo.perkCapacity', { capacity }))
  else if (capacity > clanCapacity(level - 1)) perks.push(tn('clanInfo.perkCapacity', { capacity }))
  const shapes = CREST_SHAPES.filter((s) => s.level === level).map((s) => s.label)
  const symbols = CREST_SYMBOLS.filter((s) => s.level === level).map((s) => s.label)
  const backgrounds = CLAN_BACKGROUNDS.filter((b) => b.level === level).map((b) => b.label)
  if (level > 1) {
    if (shapes.length) perks.push(tn('clanInfo.perkShapes', { list: shapes.join(', ') }))
    if (symbols.length) perks.push(tn('clanInfo.perkSymbols', { list: symbols.join(', ') }))
    if (backgrounds.length) perks.push(tn('clanInfo.perkBackgrounds', { list: backgrounds.join(', ') }))
  } else {
    perks.push(tn('clanInfo.perkBasic'))
  }
  if (level === 10) perks.push(tn('clanInfo.perkGold'))
  if (clan2) {
    const cap = treasuryCap(level, 0)
    if (level === 1 || cap > treasuryCap(level - 1, 0)) perks.push(tn('clan2.levels.cap', { n: fmt(cap) }))
    const build = BUILD_CLAN_LEVEL.indexOf(level as 2 | 4 | 6)
    if (build >= 0) perks.push(tn('clan2.levels.build', { n: build + 1 }))
    const items = SHOP_ITEMS.filter((x) => x.minLevel === level).length
    if (items > 0) perks.push(tn('clan2.levels.shop', { count: items }))
  }
  return perks
}

function LevelInfo({ clan, clan2 }: { clan: ClanDetail; clan2?: boolean }) {
  const progress = clanLevelProgress(clan.xp)
  const extra = clan.extraSlots ?? 0
  return (
    <>
      <div className="clan-info-head">
        <div className="clan-info-title">{tn('clanInfo.level', { level: clan.level })}</div>
        <div className="clan-info-sub">
          {progress.to === null ? tn('clanInfo.xpMax', { xp: clan.xp }) : tn('clanInfo.xpTo', { xp: clan.xp, to: progress.to, next: clan.level + 1 })}
        </div>
        <div className="clan-info-bar">
          <div className="clan-info-bar-fill" style={{ width: `${Math.round(progress.pct * 100)}%` }} />
        </div>
      </div>

      <div className="clan-info-section">{tn('clanInfo.xpTitle')}</div>
      <ul className="clan-info-rules">
        <li>
          <b>+15</b> {tn('clanInfo.xpChest')}
        </li>
        <li>
          <b>+40</b>{tn('clanInfo.xpRace')}
        </li>
      </ul>

      <div className="clan-info-section">{tn('clanInfo.levelsTitle')}</div>
      <div className="clan-info-levels">
        {CLAN_LEVEL_XP.map((xp, i) => {
          const level = i + 1
          const state = level < clan.level ? 'done' : level === clan.level ? 'current' : 'next'
          return (
            <div key={level} className={`clan-info-level ${state}`}>
              <div className="clan-info-level-badge">{state === 'done' ? '✓' : level}</div>
              <div className="clan-info-level-body">
                <div className="clan-info-level-title">
                  {tn('clanInfo.level', { level })}
                  <span>{xp === 0 ? tn('clanInfo.xpNow') : tn('clanInfo.xpNeed', { xp })}</span>
                </div>
                {levelPerks(level, clan2).map((p) => (
                  <div key={p} className="clan-info-level-perk">
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {extra > 0 && (
        <div className="clan-info-note">
          {tn('clanInfo.capacityNote', { capacity: clan.capacity, base: clan.capacity - extra, extra })}
        </div>
      )}
    </>
  )
}

function LeagueInfo({ clan }: { clan: ClanDetail }) {
  const current = leagueFor(clan.trophies)
  const next = LEAGUES.find((l) => l.min > clan.trophies)
  return (
    <>
      <div className="clan-info-head">
        <div className="clan-info-title">
          <span className="clan-league-dot" style={{ background: current.color }} />
          {current.label}
        </div>
        <div className="clan-info-sub">
          {tn('clanInfo.trophies', { count: clan.trophies })}
          {next ? tn('clanInfo.toLeague', { label: next.label, left: next.min - clan.trophies }) : tn('clanInfo.topLeague')}
        </div>
      </div>

      <div className="clan-info-section">{tn('clanInfo.trophyTitle')}</div>
      <ul className="clan-info-rules">
        <li>
          <b>+10</b>{tn('clanInfo.trophyFinish')}
        </li>
        <li>
          <b>+30 / +15 / +5</b> {tn('clanInfo.trophyPlaces')}
        </li>
      </ul>

      <div className="clan-info-section">{tn('clanInfo.leagues')}</div>
      <div className="clan-info-leagues">
        {LEAGUES.map((l) => (
          <div key={l.id} className={`clan-info-league${l.id === current.id ? ' current' : ''}`}>
            <span className="clan-league-dot" style={{ background: l.color }} />
            <span className="clan-info-league-name">{l.label}</span>
            <span className="clan-info-league-min">{l.min === 0 ? tn('clanInfo.leagueFromStart') : tn('clanInfo.leagueFrom', { min: l.min })}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function SectorsInfo({ clan, onOpenTerritory }: { clan: ClanDetail; onOpenTerritory: (id: string) => void }) {
  const { data: territories = [], isPending } = useTerritories(clan.city)
  const held = territories.filter((t) => t.ownerClanId === clan.id)
  return (
    <>
      <div className="clan-info-head">
        <div className="clan-info-title">{tn('clanInfo.sectorsTitle')}</div>
        <div className="clan-info-sub">
          {isPending ? tn('common.loading') : held.length ? tn('clanInfo.sectorsHeld', { count: held.length }) : tn('clanInfo.sectorsNone')}
        </div>
      </div>
      {held.length > 0 && (
        <div className="clan-info-sectors">
          {held.map((t) => (
            <button key={t.id} className="clan-info-sector tap-scale" onClick={() => onOpenTerritory(t.id)}>
              <span className="clan-info-sector-id">{t.id}</span>
              <span className="clan-info-sector-meta">
                {KIND_LABEL[t.kind]} · {sectorCapturer(t)?.displayName ?? tn('common.angler')}
                {t.coHolders.length > 0 ? tn('clanInfo.andMore', { count: t.coHolders.length }) : ''}
              </span>
              <span className="clan-info-sector-count">{tn('clanInfo.catchesShort', { count: t.catchCount })}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// The battle wins chip: what it counts and where the battle is.
function RaceInfo({ clan, onOpenRace }: { clan: ClanDetail; onOpenRace: () => void }) {
  return (
    <>
      <div className="clan-info-head">
        <div className="clan-info-title">
          {tn('clanInfo.raceWins', { count: clan.raceWins })}
        </div>
        <div className="clan-info-sub">{clan.wonLastWeek ? tn('clanInfo.wonLastWeek') : tn('clanInfo.winsHint')}</div>
      </div>
      <div className="clan-info-section">{tn('clanInfo.howWin')}</div>
      <ul className="clan-info-rules">
        <li>{tn('clanInfo.howWin1')}</li>
        <li>{tn('clanInfo.howWin2')}</li>
      </ul>
      <button className="btn-primary clan-info-action" onClick={onOpenRace}>
        {tn('race.open')}
      </button>
    </>
  )
}

// Tapping a chip in the clan hero (level, league, members, sectors) opens
// what's behind the number, instead of leaving it a bare figure.
export function ClanInfoSheet({
  kind,
  clan,
  onClose,
  onOpenTerritory,
  onOpenRace,
  clan2,
}: {
  kind: ClanInfoKind
  clan: ClanDetail
  onClose: () => void
  onOpenTerritory: (id: string) => void
  onOpenRace: () => void
  clan2?: boolean
}) {
  const title = kind === 'level' ? tn('clanInfo.levelTitle') : kind === 'league' ? tn('clanInfo.leagueTitle') : kind === 'race' ? tn('race.title') : tn('clanInfo.sectorsTitle')
  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet clan-info-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="move-sheet-handle" />
        <div className="clan-info-scroll">
          {kind === 'level' && <LevelInfo clan={clan} clan2={clan2} />}
          {kind === 'league' && <LeagueInfo clan={clan} />}
          {kind === 'race' && (
            <RaceInfo
              clan={clan}
              onOpenRace={() => {
                onClose()
                onOpenRace()
              }}
            />
          )}
          {kind === 'sectors' && (
            <SectorsInfo
              clan={clan}
              onOpenTerritory={(id) => {
                onClose()
                onOpenTerritory(id)
              }}
            />
          )}
        </div>
        <button className="btn-secondary clan-info-close" onClick={onClose}>
          {tn('common.close')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
