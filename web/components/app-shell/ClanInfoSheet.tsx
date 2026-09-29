'use client'

import { createPortal } from 'react-dom'
import { useTerritories } from '@/lib/supabase/queries'
import { CLAN_LEVEL_XP, LEAGUES, clanCapacity, clanLevelProgress, leagueFor } from '@/lib/data/clanLevels'
import { CREST_SHAPES, CREST_SYMBOLS } from '@/lib/data/clanCrests'
import { CLAN_BACKGROUNDS } from '@/lib/data/clanBackgrounds'
import { KIND_LABEL } from '@/lib/data/species'
import type { ClanDetail } from '@/lib/data/types'

export type ClanInfoKind = 'level' | 'league' | 'sectors'

// What a clan level brings: more members, new crest shapes, symbols and
// backgrounds (the same `level` fields the editor locks by), the golden
// crest frame at the top. Numbers match public._clan_capacity/_clan_level.
function levelPerks(level: number): string[] {
  const perks: string[] = []
  const capacity = clanCapacity(level)
  if (level === 1) perks.push(`До ${capacity} участников`)
  else if (capacity > clanCapacity(level - 1)) perks.push(`До ${capacity} участников`)
  const shapes = CREST_SHAPES.filter((s) => s.level === level).map((s) => s.label)
  const symbols = CREST_SYMBOLS.filter((s) => s.level === level).map((s) => s.label)
  const backgrounds = CLAN_BACKGROUNDS.filter((b) => b.level === level).map((b) => b.label)
  if (level > 1) {
    if (shapes.length) perks.push(`Формы герба: ${shapes.join(', ')}`)
    if (symbols.length) perks.push(`Символы: ${symbols.join(', ')}`)
    if (backgrounds.length) perks.push(`Фон: ${backgrounds.join(', ')}`)
  } else {
    perks.push('Базовые формы, символы и фоны герба')
  }
  if (level === 10) perks.push('Золотая рамка герба')
  return perks
}

function LevelInfo({ clan }: { clan: ClanDetail }) {
  const progress = clanLevelProgress(clan.xp)
  const extra = clan.extraSlots ?? 0
  return (
    <>
      <div className="clan-info-head">
        <div className="clan-info-title">Уровень {clan.level}</div>
        <div className="clan-info-sub">
          {progress.to === null ? `Максимальный уровень · ${clan.xp} опыта` : `${clan.xp} из ${progress.to} опыта до уровня ${clan.level + 1}`}
        </div>
        <div className="clan-info-bar">
          <div className="clan-info-bar-fill" style={{ width: `${Math.round(progress.pct * 100)}%` }} />
        </div>
      </div>

      <div className="clan-info-section">Как клан получает опыт</div>
      <ul className="clan-info-rules">
        <li>
          <b>+15</b> за каждую открытую ступень сундука недели
        </li>
        <li>
          <b>+40</b>, если клан доплыл в битве кланов
        </li>
      </ul>

      <div className="clan-info-section">Уровни и бонусы</div>
      <div className="clan-info-levels">
        {CLAN_LEVEL_XP.map((xp, i) => {
          const level = i + 1
          const state = level < clan.level ? 'done' : level === clan.level ? 'current' : 'next'
          return (
            <div key={level} className={`clan-info-level ${state}`}>
              <div className="clan-info-level-badge">{state === 'done' ? '✓' : level}</div>
              <div className="clan-info-level-body">
                <div className="clan-info-level-title">
                  Уровень {level}
                  <span>{xp === 0 ? 'сразу' : `${xp} опыта`}</span>
                </div>
                {levelPerks(level).map((p) => (
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
          Сейчас мест: {clan.capacity} — {clan.capacity - extra} по уровню и +{extra} от модератора.
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
          {clan.trophies} трофеев{next ? ` · до лиги «${next.label}» ещё ${next.min - clan.trophies}` : ' · высшая лига'}
        </div>
      </div>

      <div className="clan-info-section">Как получить трофеи</div>
      <ul className="clan-info-rules">
        <li>
          <b>+10</b>, если клан доплыл в битве кланов
        </li>
        <li>
          <b>+30 / +15 / +5</b> за 1–3 место, если в городе два клана и больше
        </li>
      </ul>

      <div className="clan-info-section">Лиги</div>
      <div className="clan-info-leagues">
        {LEAGUES.map((l) => (
          <div key={l.id} className={`clan-info-league${l.id === current.id ? ' current' : ''}`}>
            <span className="clan-league-dot" style={{ background: l.color }} />
            <span className="clan-info-league-name">{l.label}</span>
            <span className="clan-info-league-min">{l.min === 0 ? 'с начала' : `от ${l.min}`}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function SectorsInfo({ clan, onOpenTerritory }: { clan: ClanDetail; onOpenTerritory: (id: string) => void }) {
  const { data: territories = [], isPending } = useTerritories()
  const held = territories.filter((t) => t.ownerClanId === clan.id)
  return (
    <>
      <div className="clan-info-head">
        <div className="clan-info-title">Сектора клана</div>
        <div className="clan-info-sub">
          {isPending ? 'Загрузка…' : held.length ? `Держат участники: ${held.length}` : 'Пока ни одного — захватывайте сектора вместе'}
        </div>
      </div>
      {held.length > 0 && (
        <div className="clan-info-sectors">
          {held.map((t) => (
            <button key={t.id} className="clan-info-sector tap-scale" onClick={() => onOpenTerritory(t.id)}>
              <span className="clan-info-sector-id">{t.id}</span>
              <span className="clan-info-sector-meta">
                {KIND_LABEL[t.kind]} · {t.ownerDisplayName ?? 'Рыбак'}
                {t.coHolders.length > 1 ? ` и ещё ${t.coHolders.length - 1}` : ''}
              </span>
              <span className="clan-info-sector-count">{t.catchCount} ул.</span>
            </button>
          ))}
        </div>
      )}
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
}: {
  kind: ClanInfoKind
  clan: ClanDetail
  onClose: () => void
  onOpenTerritory: (id: string) => void
}) {
  const title = kind === 'level' ? 'Уровень клана' : kind === 'league' ? 'Лига клана' : 'Сектора клана'
  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet clan-info-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="move-sheet-handle" />
        <div className="clan-info-scroll">
          {kind === 'level' && <LevelInfo clan={clan} />}
          {kind === 'league' && <LeagueInfo clan={clan} />}
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
          Закрыть
        </button>
      </div>
    </div>,
    document.body,
  )
}
