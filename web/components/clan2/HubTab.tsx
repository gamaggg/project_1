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

// Where the boats sit on the water band: x and y in % of the band, in the order the members are shown.
// Kept clear of the pier in the middle of the shore.
const BOATS: [number, number][] = [
  [5, 30],
  [58, 28],
  [22, 64],
  [68, 64],
  [33, 32],
]

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
  const fishers = s.members.filter((m) => m.lastCatchMin !== null && m.lastCatchMin <= todayMin).sort((a, b) => (a.lastCatchMin ?? 0) - (b.lastCatchMin ?? 0))
  const recent = s.recentCatches ?? []
  const lastOf = (id: string, name: string): RecentCatch | undefined => recent.find((c) => (c.userId ? c.userId === id : c.member === name))

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
        <span className="c2-water-wave" style={{ left: '8%', top: '58%', width: 52 }} />
        <span className="c2-water-wave" style={{ left: '64%', top: '36%', width: 40 }} />
        <span className="c2-water-wave" style={{ left: '34%', top: '86%', width: 36 }} />
        <div className="c2-water-head">
          <b>{tn('clan2.hub.water')}</b>
          <span>{tn('clan2.hub.waterCount', { a: fishers.length, b: s.members.length })}</span>
        </div>
        {fishers.length === 0 ? (
          <p className="c2-water-empty">{tn('clan2.hub.waterEmpty')}</p>
        ) : (
          fishers.slice(0, BOATS.length).map((m, i) => {
            const last = lastOf(m.id, m.name)
            return (
              <div key={m.id} className="c2-boat" style={{ left: `${BOATS[i][0]}%`, top: `${BOATS[i][1]}%`, animationDelay: `${i * -1.3}s` }}>
                <C2Avatar member={m} size={30} />
                <span>
                  {last ? `${speciesName(last.species)} · ` : ''}
                  {shortAgo(m.lastCatchMin ?? 0)}
                </span>
              </div>
            )
          })
        )}
        {fishers.length > BOATS.length && <span className="c2-water-more">+{fishers.length - BOATS.length}</span>}
        <span className="c2-water-shore" aria-hidden="true" />
        <span className="c2-water-pier" aria-hidden="true" />
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
        <button type="button" className="c2-link c2-hub-more" onClick={() => setSheet('exit')}>
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
          <span className="c2-hub-bar" aria-hidden="true">
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
