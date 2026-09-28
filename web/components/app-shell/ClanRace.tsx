'use client'

import { memo, useEffect, useState } from 'react'
import { useClanRace } from '@/lib/supabase/queries'
import { resolveCrest, shadeHex } from '@/lib/data/clanCrests'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { ChallengeCountdown } from '@/components/app-shell/ChallengeCountdown'
import type { CityId } from '@/lib/data/city'
import type { ClanRace, ClanRaceEntry } from '@/lib/data/types'

// How far along the river a clan's boat is, 0..1. A clan that crossed the
// line stays on it even if (in theory) its meters were later recounted.
export function raceProgress(c: ClanRaceEntry): number {
  if (c.finishedAt) return 1
  return Math.max(0, Math.min(1, c.meters / Math.max(1, c.finish)))
}

export function formatMeters(m: number): string {
  return m >= 10_000 ? `${(m / 1000).toFixed(1).replace('.', ',')} км` : `${m.toLocaleString('ru-RU')} м`
}

// A side-on sailing boat: the sail is the clan's own canvas (its secondary
// colour) carrying the crest, the hull and pennant are the primary colour.
export const RaceBoat = memo(function RaceBoat({ crest, size = 52 }: { crest: unknown; size?: number }) {
  const c = resolveCrest(crest)
  const hull = shadeHex(c.primary, -0.18)
  return (
    <span className="race-boat" style={{ width: size, height: size * 0.93 }}>
      <svg viewBox="0 0 60 56" width={size} height={size * 0.93} aria-hidden>
        <path d="M31 2.5 41 5.2 31 8Z" fill={c.primary} />
        <rect x="29.2" y="2" width="1.8" height="40" rx=".9" fill="#3B2E25" />
        <path d="M13 9Q30 4.5 47 9Q51.5 22 47 35Q30 31 13 35Q17 22 13 9Z" fill={c.secondary} />
        <path d="M13 9Q30 4.5 47 9Q51.5 22 47 35Q30 31 13 35Q17 22 13 9Z" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="1" />
        <path d="M3 39.5H57L50.5 51Q30 55.5 9.5 51Z" fill={hull} />
        <path d="M5.2 43.5H54.8" stroke={c.primary} strokeWidth="2.2" />
        <path d="M9 51Q30 54.5 51 51" stroke="rgba(0,0,0,.18)" strokeWidth="1.2" fill="none" />
      </svg>
      <span className="race-boat-crest" style={{ left: size * 0.335, top: size * 0.19 }}>
        <ClanCrest crest={crest} size={Math.round(size * 0.36)} />
      </span>
    </span>
  )
})

// The river itself: one lane per clan in race order, the start on the left
// and a chequered finish line on the right. Boats sail in from the start on
// first paint, then glide when their position changes (transform only).
export function RaceRiver({
  clans,
  highlightId,
  onOpenClan,
  boatSize = 52,
}: {
  clans: ClanRaceEntry[]
  highlightId?: number | null
  onOpenClan?: (id: number) => void
  boatSize?: number
}) {
  const laneHeight = Math.round(boatSize * 1.08)
  return (
    <div className="race-river" style={{ ['--boat' as string]: `${boatSize}px`, ['--lane' as string]: `${laneHeight}px` }}>
      <div className="race-river-flow" aria-hidden />
      <div className="race-river-head">
        <span>Старт</span>
        <span>Финиш</span>
      </div>
      {clans.length === 0 ? (
        <div className="race-lane race-lane-empty">
          <span className="race-empty-text">В городе пока нет кланов — первая лодка может быть твоей</span>
        </div>
      ) : (
        clans.map((c, i) => {
          const p = raceProgress(c)
          const primary = resolveCrest(c.crest).primary
          const mine = c.id === highlightId
          const Lane = onOpenClan ? 'button' : 'div'
          return (
            <Lane
              key={c.id}
              className={`race-lane${mine ? ' mine' : ''}${c.finishedAt ? ' finished' : ''}`}
              style={{ ['--c' as string]: primary, ['--p' as string]: p, ['--i' as string]: i }}
              onClick={onOpenClan ? () => onOpenClan(c.id) : undefined}
              aria-label={`${c.rank}-е место: ${c.name}, ${formatMeters(c.meters)} из ${formatMeters(c.finish)}`}
            >
              <span className="race-lane-rank">{c.rank}</span>
              <span className="race-track">
                <span className="race-boat-pos">
                  <span className="race-trail" />
                  <span className="race-wake" />
                  <span className="race-boat-bob">
                    <RaceBoat crest={c.crest} size={boatSize} />
                  </span>
                </span>
              </span>
              {mine && <span className="race-lane-you">Вы</span>}
            </Lane>
          )
        })
      )}
      <div className="race-finish" aria-hidden />
    </div>
  )
}

// Clan screen «Битва» tab — the river with this clan's lane lit up, its
// own line, and the way into the full regatta screen.
export function ClanRacePreview({ city, clanId, onOpenRace }: { city: CityId; clanId: number; onOpenRace: () => void }) {
  const { data: race, isLoading } = useClanRace(city, true)
  if (isLoading || !race) return <div className="clan-soon">{isLoading ? 'Загрузка…' : 'Нет данных'}</div>

  const mine = race.clans.find((c) => c.id === clanId) ?? null
  // Up to five lanes, always including this clan's.
  let lanes = race.clans.slice(0, 5)
  if (mine && !lanes.some((c) => c.id === mine.id)) lanes = [...race.clans.slice(0, 4), mine]

  return (
    <div className="clan-tab-body">
      <div className="race-card race-card-preview" onClick={onOpenRace}>
        <div className="race-card-head">
          <div>
            <div className="race-kicker">Битва кланов недели</div>
            <div className="race-card-title">{mine ? raceHeadline(mine, race) : 'Лодка клана ещё не спущена'}</div>
          </div>
          <ChallengeCountdown endsAt={race.weekEnd} />
        </div>
        <RaceRiver clans={lanes} highlightId={clanId} boatSize={44} />
        <div className="race-card-line">
          <span>
            {mine ? (
              <>
                <b>{formatMeters(mine.meters)}</b> из {formatMeters(mine.finish)}
              </>
            ) : (
              'Кланов в битве: ' + race.clans.length
            )}
          </span>
          <button
            className="race-card-open"
            onClick={(e) => {
              e.stopPropagation()
              onOpenRace()
            }}
          >
            Открыть битву кланов
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      <RaceRulesCard />
    </div>
  )
}

export function raceHeadline(c: ClanRaceEntry, race: ClanRace): string {
  const solo = race.clans.length < 2
  if (c.finishedAt) return solo ? 'Доплыли до финиша!' : `Финиш · ${c.rank}-е место`
  if (solo) return `Пройдено ${Math.floor(raceProgress(c) * 100)}% пути`
  return `${c.rank}-е место из ${race.clans.length}`
}

export function RaceRulesCard() {
  return (
    <div className="clan-card race-rules">
      <div className="clan-card-title">Как плывёт лодка</div>
      <div className="race-rule-grid">
        <span>Улов</span>
        <b>+10 м</b>
        <span>Недельный челлендж</span>
        <b>+20 м</b>
        <span>Захват сектора</span>
        <b>+30 м</b>
        <span>Отбить сектор у другого клана</span>
        <b>+50 м</b>
      </div>
      <p className="race-rule-note">
        Один рыбак приносит не больше 150 м в день — грести нужно всем. Финиш зависит от размера клана: 200 м на участника (минимум как для троих).
      </p>
      <p className="race-rule-note">
        Итоги — в ночь на понедельник. Доплыли — 80 монет каждому, кто грёб. Если кланов в городе два и больше, за 1–3 место ещё +120 / +60 / +30 и трофеи клану.
      </p>
    </div>
  )
}

function shortLeft(ms: number): string {
  if (ms <= 0) return 'итоги ночью'
  const minutes = Math.floor(ms / 60_000)
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  if (d >= 1) return `ещё ${d} д ${h} ч`
  if (h >= 1) return `ещё ${h} ч`
  return `ещё ${minutes % 60} мин`
}

// Map plaque for clan members: where their boat is right now. Only mounted
// for someone in a clan, so nobody else pays for the extra request.
export function MapRacePill({ city, clanId, onOpen }: { city: CityId; clanId: number; onOpen: () => void }) {
  const { data: race } = useClanRace(city, true)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5 * 60_000)
    return () => clearInterval(id)
  }, [])
  const mine = race?.clans.find((c) => c.id === clanId)
  if (!race || !mine) return null
  const progress = raceProgress(mine)
  const status = mine.finishedAt ? 'Финиш!' : race.clans.length < 2 ? `${Math.floor(progress * 100)}% пути` : `${mine.rank}-е место`
  const left = shortLeft(new Date(race.weekEnd).getTime() - now)
  // The brand-orange card is the one thing on the map that isn't a sector
  // or a control — it has to read at a glance over both sea and land.
  return (
    <button className="map-race-pill tap-scale" onClick={onOpen} aria-label={`Битва кланов: ${status}, ${left}`}>
      <span className="map-race-pill-icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
          <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
          <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
          <path d="m5 14 4 4M7 17l-3 3M3 19l2 2" />
        </svg>
      </span>
      <span className="map-race-pill-body">
        <span className="map-race-pill-row">
          <span className="map-race-pill-title">Битва кланов</span>
          <b className="map-race-pill-status">{status}</b>
          <span className="map-race-pill-left">{left}</span>
        </span>
        <span className="map-race-pill-track">
          <span className="map-race-pill-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      </span>
      <svg className="map-race-pill-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}
