'use client'

import { useClanList } from '@/lib/supabase/queries'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { leagueFor } from '@/lib/data/clanLevels'
import { pluralSectors } from '@/lib/format'
import type { CityId } from '@/lib/data/city'

// «Кланы» tab of the rating: the city's clans ranked by trophies (the
// regatta result), with how many sectors each currently holds.
export function ClanRating({ city, onOpenClan, onOpenClans }: { city: CityId; onOpenClan: (id: number) => void; onOpenClans: () => void }) {
  const { data: clans = [], isLoading } = useClanList(city, '')
  const top = clans.slice(0, 3)
  const rest = clans.slice(3, 30)

  if (isLoading) return <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
  if (!clans.length) {
    return (
      <div className="clan-empty">
        В городе пока нет кланов.
        <button className="btn-primary" style={{ marginTop: 14 }} onClick={onOpenClans}>
          Создать или найти клан
        </button>
      </div>
    )
  }
  return (
    <>
      <div className="clan-podium">
        {[top[1], top[0], top[2]].map((c, i) =>
          c ? (
            <button key={c.id} className={`clan-podium-item${i === 1 ? ' first' : ''}`} onClick={() => onOpenClan(c.id)}>
              <ClanCrest crest={c.crest} size={i === 1 ? 72 : 56} shine={i === 1} />
              <span className="clan-podium-place">{i === 1 ? 1 : i === 0 ? 2 : 3}</span>
              <span className="clan-podium-name">{c.name}</span>
              <span className="clan-podium-trophies">🏆 {c.trophies}</span>
            </button>
          ) : (
            <div key={`empty-${i}`} className="clan-podium-item" aria-hidden />
          )
        )}
      </div>
      {rest.length > 0 && (
        <div className="clan-card">
          {rest.map((c, i) => {
            const league = leagueFor(c.trophies)
            return (
              <button key={c.id} className="clan-list-row tap-scale" onClick={() => onOpenClan(c.id)}>
                <span className="clan-list-rank">{i + 4}</span>
                <ClanCrest crest={c.crest} size={40} />
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span className="clan-list-name">{c.name}</span>
                  <span className="clan-list-meta">
                    {c.sectorsHeld} {pluralSectors(c.sectorsHeld)} · {c.members} уч.
                  </span>
                </span>
                <span className="clan-list-trophies">
                  <span>
                    <span className="clan-league-dot" style={{ background: league.color }} /> {c.trophies}
                  </span>
                  <span className="clan-list-league">{league.label}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
      <button className="btn-secondary" style={{ marginTop: 14 }} onClick={onOpenClans}>
        Все кланы города
      </button>
    </>
  )
}
