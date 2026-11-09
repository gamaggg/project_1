'use client'

import { HexLoader } from '@/components/app-shell/HexLoader'
import { useClanList, useClanListsOfCities } from '@/lib/supabase/queries'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { leagueFor } from '@/lib/data/clanLevels'
import { pluralSectors } from '@/lib/format'
import { CITIES, CITY_LIST, type CityId } from '@/lib/data/city'
import type { ClanSummary } from '@/lib/data/types'
import { tn } from '@/lib/i18n'

// How many clans of each other city the tab lists (the city's own list goes to 30).
const OTHER_CITY_LIMIT = 10

function ClanRow({ clan, rank, onOpenClan }: { clan: ClanSummary; rank: number; onOpenClan: (id: number) => void }) {
  const league = leagueFor(clan.trophies)
  return (
    <button className="clan-list-row tap-scale" onClick={() => onOpenClan(clan.id)}>
      <span className="clan-list-rank">{rank}</span>
      <ClanCrest crest={clan.crest} size={40} />
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span className="clan-list-name">{clan.name}</span>
        <span className="clan-list-meta">
          {clan.sectorsHeld} {pluralSectors(clan.sectorsHeld)} · {tn('clanRating.members', { count: clan.members })}
        </span>
      </span>
      <span className="clan-list-trophies">
        <span>
          <span className="clan-league-dot" style={{ background: league.color }} /> {clan.trophies}
        </span>
        <span className="clan-list-league">{league.label}</span>
      </span>
    </button>
  )
}

// «Кланы» tab of the rating: the city's clans ranked by trophies (the
// regatta result), with how many sectors each currently holds; under them the
// clans of the other cities, city by city (to look at: a clan of another city
// cannot be joined, its screen says so).
export function ClanRating({ city, onOpenClan, onOpenClans }: { city: CityId; onOpenClan: (id: number) => void; onOpenClans: () => void }) {
  const { data: clans = [], isLoading } = useClanList(city, '')
  const otherCityIds = CITY_LIST.map((c) => c.id).filter((id) => id !== city)
  const others = useClanListsOfCities(otherCityIds)
  const top = clans.slice(0, 3)
  const rest = clans.slice(3, 30)
  const otherBlocks = otherCityIds
    .map((id, i) => ({ id, clans: (others[i]?.data ?? []).slice(0, OTHER_CITY_LIMIT) }))
    .filter((b) => b.clans.length > 0)

  if (isLoading)
    return (
      <div style={{ padding: 26 }}>
        <HexLoader size={0.55} />
      </div>
    )
  return (
    <>
      {!clans.length ? (
        <div className="clan-empty">
          {tn('clanRating.none')}
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={onOpenClans}>
            {tn('clanRating.createFind')}
          </button>
        </div>
      ) : (
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
              {rest.map((c, i) => (
                <ClanRow key={c.id} clan={c} rank={i + 4} onOpenClan={onOpenClan} />
              ))}
            </div>
          )}
          <button className="btn-secondary" style={{ marginTop: 14 }} onClick={onOpenClans}>
            {tn('clanRating.all')}
          </button>
        </>
      )}
      {otherBlocks.length > 0 && (
        <>
          <div className="clan-section-label">{tn('clanRating.otherCities')}</div>
          {otherBlocks.map((b) => (
            <div key={b.id} className="clan-card" style={{ marginBottom: 12 }}>
              <div className="clan-card-title">{CITIES[b.id].name}</div>
              {b.clans.map((c, i) => (
                <ClanRow key={c.id} clan={c} rank={i + 1} onOpenClan={onOpenClan} />
              ))}
            </div>
          ))}
        </>
      )}
    </>
  )
}
