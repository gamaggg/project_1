'use client'

import { useState } from 'react'
import { alertText } from '@/components/clan2/alertText'
import { C2Avatar, C2Coins, C2Sheet, fmtAgo, fmtLeft, speciesName, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { DEMO_GEO } from '@/components/clan2/BaseScene'
import { ExitTab } from '@/components/clan2/ExitTab'
import { MembersTab } from '@/components/clan2/MembersTab'
import { WeekTab, questLabel } from '@/components/clan2/WeekTab'
import { buildingsOn, canManage, markAlertsRead, rentPerDay, rsvpBuff, useDemoState } from '@/lib/clan2/demoStore'
import { BUILD_CLAN_LEVEL, DEFENSE_MAX, PROJECTS, PROJECT_IDS } from '@/lib/clan2/rules'
import type { ProjectId, RecentCatch } from '@/lib/clan2/types'
import { formatCatchMeta } from '@/lib/format'
import { tn, tnd } from '@/lib/i18n/runtime'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useLiveUi } from '@/lib/clan2/live/ui'
import { previewStaticUrl } from '@/lib/mapbox/rasterTiles'

// «Клан»: the clan's home screen («Причал»). One glance answers what is burning, who is on the water today, what the
// clan is doing together and what the player can do now; everything else is one tap away (the tabs «Общак», «База»,
// «Люди», and the outing and the week as sheets). Nothing here changes a rule or a number — it only puts the pieces
// in the order a player needs them.

type Go = 'treasury' | 'hq' | 'people'

// Where the boats sit on the water: x and y (the top of the avatar) in % of the band, in the order the members are
// shown. Two rows on the sea below the horizon; the second row keeps clear of the pier on the left.
const BOATS: [number, number][] = [
  [5, 36],
  [38, 36],
  [71, 36],
  [54, 69],
  [82, 69],
]

// The scene behind the boats: sky, the horizon, the sea, a sandy shore and a wooden pier on posts (side view).
function WaterScene() {
  return (
    <svg className="c2-water-scene" viewBox="0 0 400 196" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="c2w-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EEF5FB" />
          <stop offset="1" stopColor="#DCEAF5" />
        </linearGradient>
        <linearGradient id="c2w-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B9D8EE" />
          <stop offset="1" stopColor="#86B9DD" />
        </linearGradient>
      </defs>
      <rect width="400" height="68" fill="url(#c2w-sky)" />
      <rect y="66" width="400" height="130" fill="url(#c2w-sea)" />
      <path d="M0 66.5 H400" stroke="#fff" strokeOpacity=".85" strokeWidth="1.6" />
      <path d="M0 70 H400" stroke="#fff" strokeOpacity=".3" strokeWidth="3" />
      <g stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M96 128 q 7 -3 14 0" />
        <path d="M112 186 q 7 -3 14 0" />
      </g>
      <path d="M0 150 C 34 144 64 150 92 166 L 118 196 H 0 Z" fill="#E7DABB" />
      <path d="M0 150 C 34 144 64 150 92 166 L 118 196" fill="none" stroke="#D2C097" strokeWidth="2" />
      <g>
        {[30, 66, 102, 138].map((x) => (
          <g key={x}>
            <rect x={x - 2.5} y="152" width="5" height="26" rx="1.5" fill="#6F4A24" />
            <ellipse cx={x} cy="178" rx="8" ry="2" fill="#fff" opacity={x > 80 ? 0.6 : 0} />
          </g>
        ))}
        <rect x="14" y="145" width="132" height="8" rx="2" fill="#A06E3B" />
        <rect x="14" y="145" width="132" height="2.5" rx="1.2" fill="#C99A5F" />
        {[30, 48, 66, 84, 102, 120].map((x) => (
          <rect key={x} x={x} y="145" width="1" height="8" fill="#6F4A24" opacity=".45" />
        ))}
      </g>
    </svg>
  )
}

// A small hull under a member's avatar, sitting on the water.
function Hull() {
  return (
    <svg className="c2-boat-hull" viewBox="0 0 40 12" aria-hidden="true">
      <ellipse cx="20" cy="10.5" rx="18" ry="1.6" fill="#fff" opacity=".6" />
      <path d="M2 2 H38 L32 9.5 H8 Z" fill="#fff" stroke="#163C58" strokeOpacity=".35" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 4.5 H35" stroke="#FC5200" strokeWidth="1.4" />
    </svg>
  )
}

// «12 мин», «3 ч», «2 дн.»: the boats' labels are short.
function shortAgo(min: number): string {
  if (min < 60) return `${Math.max(1, Math.round(min))} ${tn('clan2.time.m')}`
  if (min < 48 * 60) return `${Math.round(min / 60)} ${tn('clan2.time.h')}`
  return `${Math.round(min / 1440)} ${tn('clan2.time.d')}`
}

export function HubTab({ onGo, onOpenSector }: { onGo: (to: Go) => void; onOpenSector?: (id: string) => void }) {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const manage = canManage(s)
  const [sheet, setSheet] = useState<null | 'exit' | 'week'>(null)
  const { hqGeo } = useLiveUi()
  // The base's thumbnail: the same light map of the HQ's place as the base itself.
  const geo = s.live ? hqGeo : DEMO_GEO
  const baseMap = geo ? previewStaticUrl(geo.lat, geo.lng, geo.widthDeg, 140, 122) : null

  // What is burning: the HQ under siege, the HQ fallen, or the newest unread clan event.
  const siege = s.hq.siege && now < s.hq.siege.endsAt ? s.hq.siege : null
  const ruins = s.hq.ruins && now < s.hq.ruins.until ? s.hq.ruins : null
  const unread = s.alerts.find((a) => !a.read) ?? null

  // On the water today: the members whose last catch was after midnight, freshest first.
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const todayMin = (now - midnight.getTime()) / 60_000
  const recent = s.recentCatches ?? []
  const lastOf = (id: string, name: string): RecentCatch | undefined => recent.find((c) => (c.userId ? c.userId === id : c.member === name))
  // Live: from the real catches (the same as the feed below). The sandbox: from its own members' clock.
  const minutesAgo = (m: (typeof s.members)[number]): number | null => {
    if (!s.live) return m.lastCatchMin
    const c = lastOf(m.id, m.name)
    return c ? (now - c.at) / 60_000 : null
  }
  const fishers = s.members
    .map((m) => ({ m, ago: minutesAgo(m) }))
    .filter((x): x is { m: (typeof s.members)[number]; ago: number } => x.ago !== null && x.ago <= todayMin)
    .sort((a, b) => a.ago - b.ago)

  const b = s.buff
  const imIn = b.rsvp.includes(s.myId)
  const need = s.settings.buffMinRsvp

  const q = s.quest
  const qDone = q.progress >= q.target
  const hqSector = s.hq.sectorId ? s.sectors.find((x) => x.id === s.hq.sectorId) : null

  const built = PROJECT_IDS.filter((id) => s.projects[id] > 0).length
  const canBuild = PROJECT_IDS.filter((id) => s.projects[id] < 3 && s.clan.level >= BUILD_CLAN_LEVEL[s.projects[id] as 0 | 1 | 2] && s.treasury.balance >= PROJECTS[id].costs[s.projects[id] as 0 | 1 | 2])

  return (
    <div className="c2-hub">
      {siege ? (
        <div className="c2-hub-alert bad" role="alert">
          <span className="c2-hub-alert-dot" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M12 6v7M12 17.5h.01" /></svg>
          </span>
          <span className="c2-hub-alert-text">{tn('clan2.hub.siege', { id: s.hq.sectorId ?? '', t: fmtLeft(siege.endsAt - now) })}</span>
          {s.hq.sectorId && onOpenSector && (
            <button type="button" className="c2-hub-alert-go" onClick={() => onOpenSector(s.hq.sectorId!)}>
              {tn('clan2.hub.route')}
            </button>
          )}
        </div>
      ) : ruins ? (
        <div className="c2-hub-alert bad" role="status">
          <span className="c2-hub-alert-dot" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M12 6v7M12 17.5h.01" /></svg>
          </span>
          <span className="c2-hub-alert-text">{tn('clan2.hub.fell', { t: fmtLeft(ruins.until - now) })}</span>
        </div>
      ) : unread ? (
        <div className={`c2-hub-alert ${unread.kind === 'sector_attack' || unread.kind === 'hq_fallen' ? 'bad' : unread.kind === 'quest_done' || unread.kind === 'project_done' || unread.kind === 'hq_saved' ? 'good' : 'info'}`} role="status">
          <span className="c2-hub-alert-dot" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" /></svg>
          </span>
          <span className="c2-hub-alert-text">
            {alertText(unread)}
            <small>{fmtAgo(now - unread.at)}</small>
          </span>
          <button type="button" className="c2-hub-alert-go" onClick={() => act(markAlertsRead())}>
            {tn('clan2.hub.ok')}
          </button>
        </div>
      ) : null}

      {/* On the water today: the clan's living part, at the top. */}
      <section className="c2-water" aria-label={tn('clan2.hub.water')}>
        <WaterScene />
        <div className="c2-water-head">
          <b>{tn('clan2.hub.water')}</b>
          <span>{tn('clan2.hub.waterCount', { a: fishers.length, b: s.members.length })}</span>
        </div>
        {fishers.length === 0 ? (
          <p className="c2-water-empty">{tn('clan2.hub.waterEmpty')}</p>
        ) : (
          fishers.slice(0, BOATS.length).map(({ m, ago }, i) => {
            const last = lastOf(m.id, m.name)
            return (
              <div key={m.id} className="c2-boat" style={{ left: `${BOATS[i][0]}%`, top: `${BOATS[i][1]}%`, animationDelay: `${i * -1.3}s` }}>
                <C2Avatar member={m} size={30} />
                <Hull />
                <span title={last ? speciesName(last.species) : undefined}>{shortAgo(ago)}</span>
              </div>
            )
          })
        )}
        {fishers.length > BOATS.length && <span className="c2-water-more">+{fishers.length - BOATS.length}</span>}
      </section>

      {/* The outing: the one big action of the screen. */}
      <section className="c2-hub-block c2-hub-exit">
        {b.phase === 'planned' && b.startsAt ? (
          <>
            <div className="c2-hub-bt">
              <b>{tn('clan2.hub.exitPlanned', { t: fmtLeft(b.startsAt - now) })}</b>
              <span>{tn('clan2.hub.exitX2')}</span>
            </div>
            <p className="c2-hub-sub">{tn('clan2.hub.exitGoing', { n: b.rsvp.length, min: need })}</p>
            <button type="button" className={imIn ? 'btn-secondary' : 'btn-primary'} onClick={() => act(rsvpBuff(!imIn), imIn ? 'rsvpOff' : 'rsvpOn')}>
              {imIn ? tn('clan2.hub.notGo') : tn('clan2.hub.go')}
            </button>
          </>
        ) : b.phase === 'active' && b.endsAt ? (
          <>
            <div className="c2-hub-bt">
              <b>{tn('clan2.hub.exitActive', { t: fmtLeft(b.endsAt - now) })}</b>
              <span>{tn('clan2.hub.exitX2')}</span>
            </div>
            <p className="c2-hub-sub">{tn('clan2.hub.exitGoing', { n: b.rsvp.length, min: need })}</p>
            {imIn ? (
              <span className="c2-ok">{tn('clan2.hub.going')}</span>
            ) : (
              <button type="button" className="btn-primary" onClick={() => act(rsvpBuff(true), 'rsvpOn')}>
                {tn('clan2.hub.go')}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="c2-hub-bt">
              <b>{b.phase === 'cooldown' && b.cooldownUntil ? tn('clan2.hub.exitCooldown', { t: fmtLeft(b.cooldownUntil - now) }) : tn('clan2.hub.exitIdle')}</b>
            </div>
            <p className="c2-hub-sub">{manage ? tn('clan2.hub.exitIdleHint') : tn('clan2.hub.exitIdleMember')}</p>
            {manage && b.phase === 'idle' && (
              <button type="button" className="btn-primary" onClick={() => setSheet('exit')}>
                {tn('clan2.hub.exitCall')}
              </button>
            )}
          </>
        )}
        <button type="button" className="c2-hub-more" onClick={() => setSheet('exit')}>
          {tn('clan2.hub.more')}
        </button>
      </section>

      {/* The three things the clan has together. */}
      <div className="c2-hub-tiles">
        <button type="button" className="c2-hub-tile" onClick={() => onGo('treasury')}>
          <small>{tn('clan2.hub.tTreasury')}</small>
          <b>
            <C2Coins n={s.treasury.balance} />
          </b>
          <i>{tn('clan2.hub.tRent', { n: rentPerDay(s) })}</i>
        </button>
        <button type="button" className="c2-hub-tile" onClick={() => setSheet('week')} aria-label={questLabel(q.kind, q.target, q.param)}>
          <small>{tn('clan2.hub.tWeek')}</small>
          <b>
            {Math.round(Math.min(q.progress, q.target) * 10) / 10}/{q.target}
          </b>
          <span className={`c2-hub-bar ${qDone || q.claimed ? 'good' : 'ink'}`} aria-hidden="true">
            <span style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }} />
          </span>
          <i>{q.claimed ? tn('clan2.hub.tWeekClaimed') : qDone ? tn('clan2.hub.tWeekDone') : tn('clan2.hub.tWeekLeft', { n: Math.ceil((q.target - q.progress) * 10) / 10 })}</i>
        </button>
        <button type="button" className={`c2-hub-tile${siege ? ' bad' : ''}`} onClick={() => onGo('hq')}>
          <small>{tn('clan2.hub.tHq')}</small>
          <b>{hqSector ? `${Math.min(DEFENSE_MAX, hqSector.defense)}/${DEFENSE_MAX}` : '—'}</b>
          {hqSector && (
            <span className={`c2-hub-bar ${hqSector.defense >= DEFENSE_MAX ? 'good' : hqSector.defense >= 2 ? 'warn' : 'bad'}`} aria-hidden="true">
              <span style={{ width: `${(Math.min(DEFENSE_MAX, hqSector.defense) / DEFENSE_MAX) * 100}%` }} />
            </span>
          )}
          <i>{!hqSector ? tn('clan2.hub.tHqNone') : siege ? tn('clan2.hub.tHqSiege') : tn('clan2.hub.tHqDef')}</i>
        </button>
      </div>

      {/* The clan's catches: what everybody is bringing in. */}
      <section className="c2-hub-block">
        <div className="c2-hub-bt">
          <b>{tn('clan2.hub.catches')}</b>
        </div>
        {recent.length === 0 ? (
          <p className="c2-hub-sub">{tn('clan2.hub.catchesEmpty')}</p>
        ) : (
          <ul className="c2-hub-feed">
            {recent.slice(0, 5).map((c, i) => (
              <li key={`${c.at}-${i}`}>
                <span className="c2-hub-ph" style={{ background: `hsl(${c.hue} 45% 88%)` }}>
                  {c.photo ? <img src={thumbUrl(c.photo, 120)} alt="" loading="lazy" decoding="async" /> : <C2Avatar member={{ name: c.member, hue: c.hue }} size={26} />}
                </span>
                <span className="c2-hub-feed-text">
                  <b>
                    {speciesName(c.species)}
                    {c.cm ? ` ${formatCatchMeta(c.cm, null)}` : ''}
                  </b>
                  <span>
                    {c.member}
                    {c.sectorId ? ` · ${c.sectorId}` : ''} · {fmtAgo(now - c.at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The base, one line: what is being built, what can be. */}
      <button type="button" className="c2-hub-block c2-hub-base" onClick={() => onGo('hq')}>
        <span className="c2-hub-base-hex hex-aspect hex-shape" aria-hidden="true">{baseMap && <img src={baseMap} alt="" loading="lazy" decoding="async" />}</span>
        <span className="c2-hub-base-text">
          <b>{tn('clan2.hub.base')}</b>
          {!buildingsOn(s) ? (
            <span>{tn('clan2.hub.baseNoHq')}</span>
          ) : s.build ? (
            <span>{tn('clan2.hub.baseBuilding', { name: tnd(`clan2.project.${s.build.id}.name`), n: s.build.toLevel, t: fmtLeft(s.build.endsAt - now) })}</span>
          ) : (
            <span>{tn('clan2.hub.baseBuilt', { n: built })}</span>
          )}
          {buildingsOn(s) && !s.build && canBuild.length > 0 && <span>{tn('clan2.hub.baseCan', { list: canBuild.map((id: ProjectId) => tnd(`clan2.project.${id}.name`)).join(', ') })}</span>}
        </span>
        <svg className="c2-hub-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      <C2Sheet open={sheet === 'exit'} onClose={() => setSheet(null)} title={tn('clan2.hub.exitSheet')}>
        <ExitTab onOpenSector={onOpenSector} />
        <MembersTab />
      </C2Sheet>
      <C2Sheet open={sheet === 'week'} onClose={() => setSheet(null)} title={tn('clan2.hub.weekSheet')}>
        <WeekTab />
      </C2Sheet>
    </div>
  )
}
