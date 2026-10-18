'use client'

import { HexLoader } from '@/components/app-shell/HexLoader'
import { memo, useEffect, useState } from 'react'
import { useClanRace } from '@/lib/supabase/queries'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { resolveCrest, shadeHex } from '@/lib/data/clanCrests'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { ChallengeCountdown } from '@/components/app-shell/ChallengeCountdown'
import { currentLocale, tn } from '@/lib/i18n/runtime'
import type { CityId } from '@/lib/data/city'
import { ClanWarRosterSheet } from '@/components/app-shell/ClanWarRosterSheet'
import type { ClanRace, ClanRaceEntry } from '@/lib/data/types'

// How far along the river a clan's boat is, 0..1. A clan that crossed the
// line stays on it even if (in theory) its meters were later recounted.
export function raceProgress(c: ClanRaceEntry): number {
  if (c.finishedAt) return 1
  return Math.max(0, Math.min(1, c.meters / Math.max(1, c.finish)))
}

export function formatMeters(m: number): string {
  return m >= 10_000 ? `${(m / 1000).toLocaleString(currentLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${tn('fmt.km')}` : `${m.toLocaleString(currentLocale())} ${tn('fmt.m')}`
}

// A side-on rowing boat — we are rowers: a long hull in the clan's primary
// colour with its secondary stripe, two rowers (a team) in the clan's colours
// pulling their oars (the oars sweep back and forth), and the clan's crest
// flying from the stern pole. The bow points right, at the finish.
const SKIN = '#F0C9A0'
const SKIN_EDGE = '#C99A6B'
const WOOD = '#B98A55'

// One rower facing the bow: hips at x, hands on the oar's handle, the oar
// passing through the oarlock on the gunwale and dipping behind into the water.
function Rower({ x, jersey, cap, blade }: { x: number; jersey: string; cap: string; blade: string }) {
  const sh = x + 5
  const lock = x + 2.5
  const handle = x + 16
  const bladeX = lock - 15.5
  return (
    <>
      <path d={`M${x} 29.5 L${x + 10} 28.2 L${x + 11.5} 31.6`} stroke="#2C3340" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M${x} 29 L${sh} 17.5`} stroke={jersey} strokeWidth="6.4" strokeLinecap="round" />
      <circle cx={sh + 1.6} cy="12.2" r="3.9" fill={SKIN} />
      <path d={`M${sh - 2.3} 11.8Q${sh - 1.8} 6.8 ${sh + 1.8} 7.3Q${sh + 5.2} 7.6 ${sh + 5.5} 11.8Z`} fill={cap} />
      <path d={`M${sh + 4.6} 11.4H${sh + 8.4}`} stroke={cap} strokeWidth="1.7" strokeLinecap="round" />
      {/* the arm has its own darker edge, so a pale shirt never swallows it */}
      <path d={`M${sh + 0.5} 19.6 L${sh + 8} 23.2`} stroke={SKIN_EDGE} strokeWidth="3.4" strokeLinecap="round" />
      <path d={`M${sh + 0.5} 19.6 L${sh + 8} 23.2`} stroke={SKIN} strokeWidth="2.2" strokeLinecap="round" />
      <g className="race-oar" style={{ transformOrigin: `${lock}px 29.2px` }}>
        <path d={`M${handle} 22.5 L${bladeX + 0.5} 38`} stroke={WOOD} strokeWidth="1.7" strokeLinecap="round" />
        <ellipse cx={bladeX} cy="38" rx="5.6" ry="2" transform={`rotate(-28 ${bladeX} 38)`} fill={blade} stroke="rgba(0,0,0,.25)" strokeWidth=".6" />
      </g>
    </>
  )
}

export const RaceBoat = memo(function RaceBoat({ crest, size = 56 }: { crest: unknown; size?: number }) {
  const c = resolveCrest(crest)
  const hull = shadeHex(c.primary, -0.18)
  const height = size * 0.625
  const flag = Math.round(size * 0.3)
  return (
    <span className="race-boat" style={{ width: size, height }}>
      <svg viewBox="0 0 80 50" width={size} height={height} aria-hidden>
        <rect x="8.2" y="9" width="1.6" height="22" rx=".8" fill="#3B2E25" />
        <path d="M4 30H76Q70 41.5 54 42.5H24Q11 41.5 4 30Z" fill={hull} />
        <path d="M7.5 34H72.5" stroke={c.secondary} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M13 40.2Q40 43 67 40.2" stroke="rgba(0,0,0,.18)" strokeWidth="1.2" fill="none" />
        <Rower x={24} jersey={shadeHex(c.primary, 0.2)} cap={c.secondary} blade={c.secondary} />
        <Rower x={46} jersey={shadeHex(c.primary, -0.06)} cap={c.secondary} blade={c.secondary} />
      </svg>
      <span className="race-boat-crest" style={{ left: size * 0.1 - flag / 2 + 1, top: size * 0.02 }}>
        <ClanCrest crest={crest} size={flag} />
      </span>
    </span>
  )
})

// The river itself: one lane per clan in race order, the start on the left
// and a chequered finish line on the right. Boats row in from the start on
// first paint, then glide when their position changes (transform only).
export function RaceRiver({
  clans,
  highlightId,
  onOpenClan,
  boatSize = 70,
}: {
  clans: ClanRaceEntry[]
  highlightId?: number | null
  onOpenClan?: (id: number) => void
  boatSize?: number
}) {
  const laneHeight = Math.round(boatSize * 0.86)
  return (
    <div className="race-river" style={{ ['--boat' as string]: `${boatSize}px`, ['--lane' as string]: `${laneHeight}px` }}>
      <div className="race-river-flow" aria-hidden />
      <div className="race-river-head">
        <span>{tn('race.start')}</span>
        <span>{tn('race.finish')}</span>
      </div>
      {clans.length === 0 ? (
        <div className="race-lane race-lane-empty">
          <span className="race-empty-text">{tn('race.noClans')}</span>
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
              aria-label={tn('race.laneAria', { place: tn('race.place', { rank: c.rank }), name: c.name, done: formatMeters(c.meters), total: formatMeters(c.finish) })}
            >
              <span className="race-lane-rank">{c.rank}</span>
              <span className="race-track">
                <span className="race-boat-pos">
                  <span className="race-trail" />
                  <span className="race-wake" />
                  <span className="race-boat-bob">
                    <RaceBoat crest={c.crest} size={boatSize} />
                  </span>
                  {/* Crossed the line: sparks around the boat, which rests and glows. */}
                  {c.finishedAt && (
                    <>
                      <span className="race-spark s1" aria-hidden />
                      <span className="race-spark s2" aria-hidden />
                      <span className="race-spark s3" aria-hidden />
                    </>
                  )}
                </span>
              </span>
              {mine && <span className="race-lane-you">{tn('race.you')}</span>}
            </Lane>
          )
        })
      )}
      <div className="race-finish" aria-hidden />
    </div>
  )
}

// The sign-up weeks: this clan's own state of the battle. Not started — the
// leader / a co-leader gets «Участвовать в битве кланов» (the roster sheet), the
// others are told who opens it; started — who is in the roster and whether the
// viewer is. Nothing for another clan, nothing before the sign-up weeks begin.
export function ClanWarCard({ race, clanId }: { race: ClanRace; clanId: number }) {
  const [picking, setPicking] = useState(false)
  if (!race.warMode || race.myClanId !== clanId) return null

  if (race.myWar) {
    const w = race.myWar
    return (
      <div className="clan-card war-card in" data-tour="war-card">
        <div className="clan-card-title">{tn('race.warRosterCount', { players: tn('race.warPlayers', { count: w.size }) })}</div>
        <div className="war-roster-faces">
          {w.roster.slice(0, 12).map((m) => (
            <span key={m.userId} className="avatar war-roster-face" title={m.displayName}>
              {m.avatarUrl ? <img src={thumbUrl(m.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : m.displayName.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {w.roster.length > 12 && <span className="war-roster-more">+{w.roster.length - 12}</span>}
        </div>
        <div className={`war-me${w.meIn ? ' in' : ''}`}>{w.meIn ? tn('race.warMeIn') : tn('race.warMeOut')}</div>
      </div>
    )
  }

  const tooSmall = race.myClanActive < 3
  return (
    <div className="clan-card war-card" data-tour="war-card">
      <div className="war-card-kicker">{tn('race.warKicker')}</div>
      <div className="war-card-title">{tn('race.warCardTitle')}</div>
      <p className="war-card-lead">{race.canStart ? tn('race.warLeadLeader') : tooSmall ? tn('race.warTooSmall') : tn('race.warLeadMember')}</p>
      {race.canStart && (
        <button className="btn-primary war-card-btn" onClick={() => setPicking(true)}>
          {tn('race.warJoinBtn')}
        </button>
      )}
      {picking && <ClanWarRosterSheet clanId={clanId} onClose={() => setPicking(false)} />}
    </div>
  )
}

// Clan screen «Битва» tab — the river with this clan's lane lit up, its
// own line, and the way into the full regatta screen.
export function ClanRacePreview({ city, clanId, onOpenRace }: { city: CityId; clanId: number; onOpenRace: () => void }) {
  const { data: race, isLoading } = useClanRace(city, true)
  if (isLoading || !race) return <div className="clan-soon">{isLoading ? <HexLoader size={0.55} /> : tn('common.noData')}</div>

  const mine = race.clans.find((c) => c.id === clanId) ?? null
  // Up to five lanes, always including this clan's.
  let lanes = race.clans.slice(0, 5)
  if (mine && !lanes.some((c) => c.id === mine.id)) lanes = [...race.clans.slice(0, 4), mine]

  return (
    <div className="clan-tab-body">
      <div className="race-card race-card-preview" onClick={onOpenRace}>
        <div className="race-card-head">
          <div>
            <div className="race-kicker">{tn('race.weekKicker')}</div>
            <div className="race-card-title">{mine ? raceHeadline(mine, race) : tn('race.noBoat')}</div>
          </div>
          <ChallengeCountdown endsAt={race.weekEnd} />
        </div>
        <RaceRiver clans={lanes} highlightId={clanId} boatSize={62} />
        <div className="race-card-line">
          <span>
            {mine ? (
              <>
                <b>{formatMeters(mine.meters)}</b> {tn('race.of', { total: formatMeters(mine.finish) })}
              </>
            ) : (
              tn('race.clansCount', { count: race.clans.length })
            )}
          </span>
          <button
            className="race-card-open"
            onClick={(e) => {
              e.stopPropagation()
              onOpenRace()
            }}
          >
            {tn('race.open')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      {/* Each member's metres this week — like the chest's points (the server
          counts them for the viewer's own clan only). */}
      <ClanWarCard race={race} clanId={clanId} />
      {/* Before the battle is opened there are no rowers to list. */}
      {race.myClanId === clanId && !(race.warMode && !race.myWar) && <RaceRowers rowers={race.myRowers} />}
      <RaceRulesCard signup={race.warMode} />
    </div>
  )
}

function RaceRowers({ rowers }: { rowers: ClanRace['myRowers'] }) {
  const max = Math.max(1, ...rowers.map((r) => r.meters))
  return (
    <div className="clan-card">
      <div className="clan-card-title">{tn('race.contribution')}</div>
      {rowers.length === 0 ? (
        <div className="clan-empty" style={{ padding: '14px 0' }}>
          {tn('race.noRowers')}
        </div>
      ) : (
        rowers.map((r, i) => (
          <div key={r.userId} className="clan-member-row" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
            <div className="avatar clan-member-avatar" style={{ cursor: 'default' }}>
              {r.avatarUrl ? <img src={thumbUrl(r.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : r.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="clan-member-name">{r.displayName}</div>
              <div className="clan-contrib-bar">
                <div className="clan-contrib-fill" style={{ transform: `scaleX(${r.meters / max})`, animationDelay: `${Math.min(i, 12) * 50}ms` }} />
              </div>
            </div>
            <div className="clan-member-stats">
              <b>{r.meters}</b>
              <span>{tn('fmt.m')}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export function raceHeadline(c: ClanRaceEntry, race: ClanRace): string {
  const solo = race.clans.length < 2
  if (c.finishedAt) return solo ? tn('race.doneAll') : tn('race.finishPlace', { place: tn('race.place', { rank: c.rank }) })
  if (solo) return tn('race.pctPath', { pct: Math.floor(raceProgress(c) * 100) })
  return tn('race.placeOf', { rank: c.rank, total: race.clans.length })
}

type HowStep = 'roster' | 'meters' | 'finish' | 'prize'
const HOW_STEPS: HowStep[] = ['roster', 'meters', 'finish', 'prize']
const HOW_ACTIONS: { key: 'ruleCatch' | 'ruleChallenge' | 'ruleClaim' | 'ruleSteal'; m: number }[] = [
  { key: 'ruleCatch', m: 10 },
  { key: 'ruleChallenge', m: 20 },
  { key: 'ruleClaim', m: 30 },
  { key: 'ruleSteal', m: 50 },
]
const DAY_CAP = 150

// «How the battle goes» for the sign-up weeks: four steps you can tap through,
// each with something to play with — tap the actions and watch the day's metres
// fill to the 150 m limit, change the roster size and see how long the finish is.
function RaceHowCard() {
  const [step, setStep] = useState<HowStep>('roster')
  const [day, setDay] = useState(0)
  const [players, setPlayers] = useState(5)
  const capped = day >= DAY_CAP
  const idx = HOW_STEPS.indexOf(step)

  return (
    <div className="clan-card race-how" data-tour="race-how">
      <div className="clan-card-title">{tn('race.howTitle')}</div>
      <div className="race-how-steps" role="tablist">
        {HOW_STEPS.map((s, i) => (
          <button key={s} type="button" role="tab" aria-selected={s === step} className={`race-how-step${s === step ? ' on' : ''}${i < idx ? ' past' : ''}`} onClick={() => setStep(s)}>
            <span className="race-how-num">{i + 1}</span>
            <span className="race-how-label">{s === 'roster' ? tn('race.howStep1') : s === 'meters' ? tn('race.howStep2') : s === 'finish' ? tn('race.howStep3') : tn('race.howStep4')}</span>
          </button>
        ))}
      </div>

      <div key={step} className="race-how-panel">
        {step === 'roster' && (
          <>
            <p className="race-how-line" style={{ marginTop: 0 }}>{tn('race.howRoster1')}</p>
            <p className="race-how-line">{tn('race.howRoster2')}</p>
            <p className="race-how-line soft">{tn('race.howRoster3')}</p>
          </>
        )}

        {step === 'meters' && (
          <>
            <p className="race-how-line soft" style={{ marginTop: 0 }}>{tn('race.howMetersHint')}</p>
            <div className="race-how-tiles">
              {HOW_ACTIONS.map((a) => (
                <button key={a.key} type="button" className="race-how-tile" disabled={capped} onClick={() => setDay((d) => Math.min(DAY_CAP, d + a.m))}>
                  <span>{tn(`race.${a.key}`)}</span>
                  <b>+{a.m} {tn('fmt.m')}</b>
                </button>
              ))}
            </div>
            <div className="race-how-gauge">
              <div className="race-how-gauge-bar">
                <span style={{ transform: `scaleX(${day / DAY_CAP})` }} className={capped ? 'full' : ''} />
              </div>
              <div className="race-how-gauge-row">
                <span>{tn('race.howDay', { m: day, cap: DAY_CAP })}</span>
                <button type="button" className="race-how-reset" style={{ visibility: day > 0 ? 'visible' : 'hidden' }} tabIndex={day > 0 ? 0 : -1} onClick={() => setDay(0)}>
                  {tn('race.howReset')}
                </button>
              </div>
              {/* One note slot of a fixed height, so the block never jumps while you tap. */}
              <div className={`race-how-capnote${capped ? ' on' : ''}`}>{capped ? tn('race.howCapReached') : tn('race.howDayLimit')}</div>
            </div>
          </>
        )}

        {step === 'finish' && (
          <>
            <div className="race-how-stepper">
              <span>{tn('race.howFinishLabel')}</span>
              <span className="race-how-count">
                <button type="button" aria-label="−" disabled={players <= 3} onClick={() => setPlayers((n) => Math.max(3, n - 1))}>−</button>
                <b>{players}</b>
                <button type="button" aria-label="+" disabled={players >= 30} onClick={() => setPlayers((n) => Math.min(30, n + 1))}>+</button>
              </span>
            </div>
            <div className="race-how-finish">
              <div className="race-how-finish-total">{tn('race.howFinishResult', { total: formatMeters(players * 200) })}</div>
              <div className="race-how-finish-bar" aria-hidden>
                <span style={{ transform: `scaleX(${Math.min(1, (players * 200) / 6000)})` }} />
              </div>
            </div>
            <p className="race-how-line soft">{tn('race.howFinishNote')}</p>
          </>
        )}

        {step === 'prize' && (
          <>
            <p className="race-how-line" style={{ marginTop: 0 }}>{tn('race.howPrizeFinish')}</p>
            <p className="race-how-line soft">{tn('race.howPrizePlaces')}</p>
            <div className="race-how-places">
              {[
                { rank: 1, coins: 120 },
                { rank: 2, coins: 60 },
                { rank: 3, coins: 30 },
              ].map((r) => (
                <span key={r.rank} className={`race-how-place p${r.rank}`}>
                  <i>{r.rank}</i>
                  <b>+{r.coins}</b>
                </span>
              ))}
            </div>
            <p className="race-how-line soft">{tn('race.howPrizeClan')}</p>
          </>
        )}
      </div>
    </div>
  )
}

export function RaceRulesCard({ signup = false }: { signup?: boolean }) {
  if (signup) return <RaceHowCard />
  return (
    <div className="clan-card race-rules">
      <div className="clan-card-title">{tn('race.rulesTitle')}</div>
      {signup && <p className="race-rule-note" style={{ marginTop: 0, marginBottom: 10 }}>{tn('race.ruleRoster')}</p>}
      <div className="race-rule-grid">
        <span>{tn('race.ruleCatch')}</span>
        <b>+10 {tn('fmt.m')}</b>
        <span>{tn('race.ruleChallenge')}</span>
        <b>+20 {tn('fmt.m')}</b>
        <span>{tn('race.ruleClaim')}</span>
        <b>+30 {tn('fmt.m')}</b>
        <span>{tn('race.ruleSteal')}</span>
        <b>+50 {tn('fmt.m')}</b>
      </div>
      <p className="race-rule-note">
        {tn('race.ruleCap')}
      </p>
      <p className="race-rule-note">
        {tn('race.ruleResults')}
      </p>
    </div>
  )
}

function shortLeft(ms: number): string {
  if (ms <= 0) return tn('race.leftNight')
  const minutes = Math.floor(ms / 60_000)
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  if (d >= 1) return tn('race.leftDH', { d, h })
  if (h >= 1) return tn('race.leftH', { h })
  return tn('race.leftM', { m: minutes % 60 })
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
  if (!race) return null
  // Sign-up weeks, the clan has not opened the war: «Битва не начата» — the leader is asked to start.
  const notStarted = race.warMode && !mine && race.myClanId === clanId
  if (!mine && !notStarted) return null
  const progress = mine ? raceProgress(mine) : 0
  const status = !mine
    ? tn('race.warStatusNot')
    : mine.finishedAt
      ? tn('race.statusFinish')
      : race.clans.length < 2
        ? tn('race.pctShort', { pct: Math.floor(progress * 100) })
        : tn('race.place', { rank: mine.rank })
  const startable = !mine && race.canStart
  const left = startable ? tn('race.warPillStart') : shortLeft(new Date(race.weekEnd).getTime() - now)
  // The brand-orange card is the one thing on the map that isn't a sector
  // or a control — it has to read at a glance over both sea and land.
  return (
    <button data-tour="race-pill" className={`map-race-pill tap-scale${startable ? ' has-cta' : ''}`} onClick={onOpen} aria-label={tn('race.pillAria', { status, left })}>
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
          <span className="map-race-pill-title">{tn('race.pillTitle')}</span>
          {mine && <b className="map-race-pill-status">{status}</b>}
          {!startable && <span className="map-race-pill-left">{left}</span>}
        </span>
        {/* Not started: «не начата» on the second line, and no strip — there is nothing to fill. */}
        {mine ? (
          <span className="map-race-pill-track">
            <span className="map-race-pill-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        ) : (
          <b className="map-race-pill-status map-race-pill-status-line">{status}</b>
        )}
      </span>
      {/* To the leader of a clan not in the battle: a white button, not a time. */}
      {startable && <span className="map-race-pill-cta">{left}</span>}
      {/* The white button says it already — no arrow beside it. */}
      {!startable && (
        <svg className="map-race-pill-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </button>
  )
}
